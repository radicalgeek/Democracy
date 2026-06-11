import type { FastifyInstance } from "fastify";
import { sql } from "./db.js";
import { analyzeAndStore } from "./services/ai.js";
import {
  billAggregates,
  castBallot,
  issueCredential,
  runCheckpoint,
  userFromToken,
  verifyReceipt
} from "./services/integrity.js";
import {
  loginUser,
  lookupPostcode,
  publicUserFromToken,
  registerUser,
  verifyIdentity
} from "./services/auth.js";
import { constituencyProfile } from "./services/divisions.js";
import {
  castPetitionVote,
  listPetitions,
  petitionDetail,
  postPetitionDebate
} from "./services/petitions.js";
import { newsForSubject } from "./services/news.js";
import { moderateAndStorePost, publicBanCount } from "./services/moderation.js";
import { runFullImport } from "./worker-jobs.js";

function bearer(headers: Record<string, unknown>) {
  const value = headers.authorization;
  if (typeof value !== "string") return undefined;
  return value.replace(/^Bearer\s+/i, "");
}

export async function registerRoutes(app: FastifyInstance) {
  app.get("/api/health", async () => ({ ok: true, service: "democracy-api" }));

  app.get("/api/status", async () => {
    const [counts] = await sql`
      select
        (select count(*)::int from bills) as bills,
        (select count(*)::int from constituencies) as constituencies,
        (select count(*)::int from representatives) as representatives,
        (select count(*)::int from svg_seat_bindings where match_status <> 'unmatched') as matched_seats,
        (select count(*)::int from svg_seat_bindings) as total_seats,
        (select count(*)::int from anonymous_ballots) as ballots,
        (select count(*)::int from debate_posts) as debate_posts,
        (select count(*)::int from ai_analyses) as ai_analyses,
        (select count(*)::int from checkpoints) as checkpoints
    `;
    const imports = await sql`
      select kind, status, detail, started_at, finished_at
      from data_import_runs order by id desc limit 8
    `;
    return { counts, imports };
  });

  app.get("/api/bills", async (request) => {
    const take = Math.min(Number((request.query as { take?: string }).take ?? 20), 50);
    const bills = await sql`
      select b.id, b.short_title, b.long_title, b.current_house, b.current_stage,
             b.bill_type, b.is_act, b.is_defeated, b.last_updated, b.source_url,
             exists(select 1 from bill_texts t where t.bill_id = b.id and t.text_content is not null) as has_text,
             (select count(*)::int from anonymous_ballots ab where ab.bill_id = b.id) as ballots
      from bills b
      order by b.last_updated desc nulls last
      limit ${take}
    `;
    return { bills };
  });

  app.get("/api/bills/:id", async (request, reply) => {
    const billId = Number((request.params as { id: string }).id);
    const [bill] = await sql`select * from bills where id = ${billId}`;
    if (!bill) return reply.code(404).send({ error: "unknown bill" });

    const texts = await sql`
      select id, publication_id, title, content_type, source_url,
             (text_content is not null) as has_text, length(text_content) as text_length
      from bill_texts where bill_id = ${billId} order by id
    `;
    const events = await sql`
      select stage, house, happened_on from bill_events
      where bill_id = ${billId} order by happened_on nulls last
    `;
    const analyses = await sql`
      select distinct on (kind) kind, model, prompt_version, output, citations, confidence, review_state, generated_at
      from ai_analyses
      where subject_type = 'bill' and subject_id = ${String(billId)} and kind in ('summary', 'compass')
      order by kind, id desc
    `;
    const [checkpoint] = await sql`
      select merkle_root, ballot_count, checkpoint_hash, created_at
      from checkpoints where bill_id = ${billId} order by id desc limit 1
    `;
    const aggregates = await billAggregates(sql, billId);
    const news = await newsForSubject(sql, { billId });
    return { bill, texts, events, analyses, checkpoint: checkpoint ?? null, aggregates, news };
  });

  app.get("/api/bills/:id/aggregates", async (request) => {
    const billId = Number((request.params as { id: string }).id);
    return billAggregates(sql, billId);
  });

  app.post("/api/bills/:id/analyze", async (request, reply) => {
    const billId = Number((request.params as { id: string }).id);
    const [bill] = await sql`select id, short_title, long_title, source_url from bills where id = ${billId}`;
    if (!bill) return reply.code(404).send({ error: "unknown bill" });

    const [text] = await sql`
      select text_content, source_url, title from bill_texts
      where bill_id = ${billId} and text_content is not null
      order by id limit 1
    `;
    const sourceText =
      (text?.text_content as string | undefined) ??
      `${bill.short_title}. ${bill.long_title ?? ""}`;
    const citations = [
      { label: "Bill page", url: bill.source_url as string },
      ...(text ? [{ label: (text.title as string) ?? "Source text", url: text.source_url as string }] : [])
    ];

    const summary = await analyzeAndStore(sql, {
      subjectType: "bill",
      subjectId: String(billId),
      kind: "summary",
      text: sourceText,
      citations
    });
    const compass = await analyzeAndStore(sql, {
      subjectType: "bill",
      subjectId: String(billId),
      kind: "compass",
      text: sourceText,
      citations
    });
    return { summary, compass };
  });

  app.get("/api/map/bindings", async () => {
    const bindings = await sql`
      select sb.svg_id, sb.legacy_name, sb.legacy_party, sb.constituency_id, sb.match_status,
             c.name as constituency_name,
             r.name as mp_name, p.name as party_name, p.background_colour as party_colour
      from svg_seat_bindings sb
      left join constituencies c on c.id = sb.constituency_id
      left join representatives r on r.constituency_id = sb.constituency_id
      left join parties p on p.id = r.party_id
    `;
    const [summary] = await sql`
      select
        count(*) filter (where match_status = 'exact')::int as exact,
        count(*) filter (where match_status = 'normalized')::int as normalized,
        count(*) filter (where match_status = 'unmatched')::int as unmatched
      from svg_seat_bindings
    `;
    return { bindings, summary };
  });

  app.get("/api/constituencies", async () => {
    const constituencies = await sql`
      select c.id, c.name, r.name as mp_name, p.name as party_name
      from constituencies c
      left join representatives r on r.constituency_id = c.id
      left join parties p on p.id = r.party_id
      where c.end_date is null or c.end_date > now()
      order by c.name
    `;
    return { constituencies };
  });

  app.get("/api/constituencies/:id/profile", async (request, reply) => {
    const constituencyId = Number((request.params as { id: string }).id);
    const profile = await constituencyProfile(sql, constituencyId);
    if (!profile) return reply.code(404).send({ error: "constituency not found" });
    return profile;
  });

  app.get("/api/petitions", async () => {
    const petitions = await listPetitions(sql);
    return { petitions };
  });

  app.get("/api/petitions/:id", async (request, reply) => {
    const petitionId = Number((request.params as { id: string }).id);
    const user = await publicUserFromToken(sql, bearer(request.headers as Record<string, unknown>));
    const detail = await petitionDetail(sql, petitionId, user?.id ?? null);
    if (!detail) return reply.code(404).send({ error: "petition not found" });
    const news = await newsForSubject(sql, { petitionId });
    return { ...detail, news };
  });

  app.post("/api/petitions/:id/vote", async (request, reply) => {
    const petitionId = Number((request.params as { id: string }).id);
    const user = await publicUserFromToken(sql, bearer(request.headers as Record<string, unknown>));
    if (!user) return reply.code(401).send({ error: "account required" });
    if (!user.email) return reply.code(403).send({ error: "sign up to vote on petitions" });
    const body = (request.body ?? {}) as { choice?: string };
    if (!["for", "against", "abstain"].includes(body.choice ?? "")) {
      return reply.code(400).send({ error: "choice (for|against|abstain) required" });
    }
    const result = await castPetitionVote(
      sql,
      user.id,
      petitionId,
      body.choice as "for" | "against" | "abstain"
    );
    if ("error" in result) return reply.code(404).send(result);
    return result;
  });

  app.post("/api/petitions/:id/debate", async (request, reply) => {
    const petitionId = Number((request.params as { id: string }).id);
    const user = await publicUserFromToken(sql, bearer(request.headers as Record<string, unknown>));
    if (!user) return reply.code(401).send({ error: "account required" });
    const body = (request.body ?? {}) as { body?: string; stance?: string };
    if (!body.body || body.body.trim().length === 0) {
      return reply.code(400).send({ error: "post body required" });
    }
    const stance = ["for", "against", "abstain"].includes(body.stance ?? "") ? body.stance! : null;
    const result = await postPetitionDebate(sql, {
      petitionId,
      userId: user.id,
      body: body.body.slice(0, 4000),
      stance
    });
    if (result.status === "banned") return reply.code(403).send(result);
    return { ...result, publicBanCount: await publicBanCount(sql, user.id) };
  });

  app.get("/api/postcode/:postcode", async (request, reply) => {
    const postcode = (request.params as { postcode: string }).postcode;
    const result = await lookupPostcode(sql, postcode);
    if ("error" in result) return reply.code(404).send(result);
    return result;
  });

  app.post("/api/auth/register", async (request, reply) => {
    const body = (request.body ?? {}) as {
      email?: string;
      password?: string;
      displayName?: string;
      postcode?: string;
    };
    if (!body.email || !body.password || !body.displayName || !body.postcode) {
      return reply.code(400).send({ error: "email, password, displayName, and postcode required" });
    }
    const result = await registerUser(sql, {
      email: body.email,
      password: body.password,
      displayName: body.displayName,
      postcode: body.postcode
    });
    if ("error" in result) return reply.code(400).send(result);
    return result;
  });

  app.post("/api/auth/login", async (request, reply) => {
    const body = (request.body ?? {}) as { email?: string; password?: string };
    if (!body.email || !body.password) {
      return reply.code(400).send({ error: "email and password required" });
    }
    const result = await loginUser(sql, { email: body.email, password: body.password });
    if ("error" in result) return reply.code(401).send(result);
    return result;
  });

  app.get("/api/auth/me", async (request, reply) => {
    const user = await publicUserFromToken(sql, bearer(request.headers as Record<string, unknown>));
    if (!user) return reply.code(401).send({ error: "not signed in" });
    return { user };
  });

  app.post("/api/auth/verify", async (request, reply) => {
    const user = await publicUserFromToken(sql, bearer(request.headers as Record<string, unknown>));
    if (!user) return reply.code(401).send({ error: "not signed in" });
    const body = (request.body ?? {}) as {
      fullName?: string;
      dateOfBirth?: string;
      addressLine1?: string;
      postcode?: string;
    };
    if (!body.fullName || !body.dateOfBirth || !body.addressLine1 || !body.postcode) {
      return reply.code(400).send({ error: "fullName, dateOfBirth, addressLine1, and postcode required" });
    }
    const result = await verifyIdentity(sql, user.id, {
      fullName: body.fullName,
      dateOfBirth: body.dateOfBirth,
      addressLine1: body.addressLine1,
      postcode: body.postcode
    });
    if (!result.verified) return reply.code(422).send(result);
    return result;
  });

  app.post("/api/bills/:id/credential", async (request, reply) => {
    const billId = Number((request.params as { id: string }).id);
    const user = await userFromToken(sql, bearer(request.headers as Record<string, unknown>));
    if (!user) return reply.code(401).send({ error: "account required" });
    const account = await publicUserFromToken(sql, bearer(request.headers as Record<string, unknown>));
    if (!account?.email) {
      return reply.code(403).send({ error: "sign up with a postcode to cast a civic vote" });
    }

    const result = await issueCredential(sql, user.id as number, billId, user.constituency_id as number | null);
    if ("error" in result) return reply.code(409).send({ error: result.error });
    return result;
  });

  app.post("/api/bills/:id/ballots", async (request, reply) => {
    const billId = Number((request.params as { id: string }).id);
    const body = (request.body ?? {}) as { credential?: string; choice?: string };
    if (!body.credential || !["for", "against", "abstain"].includes(body.choice ?? "")) {
      return reply.code(400).send({ error: "credential and choice (for|against|abstain) required" });
    }
    const result = await castBallot(sql, billId, body.credential, body.choice as "for" | "against" | "abstain");
    if ("error" in result) return reply.code(410).send({ error: result.error });
    await runCheckpoint(sql, billId);
    return result;
  });

  app.get("/api/receipts/:code/verify", async (request) => {
    const code = (request.params as { code: string }).code;
    return verifyReceipt(sql, code);
  });

  app.get("/api/checkpoints", async (request) => {
    const billId = Number((request.query as { billId?: string }).billId ?? 0);
    const checkpoints = billId
      ? await sql`select * from checkpoints where bill_id = ${billId} order by id desc limit 20`
      : await sql`select * from checkpoints order by id desc limit 20`;
    return { checkpoints };
  });

  app.get("/api/bills/:id/debate", async (request) => {
    const billId = Number((request.params as { id: string }).id);
    const posts = await sql`
      select dp.id, dp.stance, dp.moderation_state, dp.created_at,
             case when dp.moderation_state in ('hidden', 'blocked')
                  then null else dp.body end as body,
             u.display_name as author,
             (select count(*)::int from temporary_bans tb where tb.user_id = dp.user_id) as public_ban_count
      from debate_posts dp
      join users u on u.id = dp.user_id
      where dp.bill_id = ${billId} and dp.moderation_state <> 'blocked'
      order by dp.id desc
      limit 100
    `;
    return { posts };
  });

  app.post("/api/bills/:id/debate", async (request, reply) => {
    const billId = Number((request.params as { id: string }).id);
    const user = await userFromToken(sql, bearer(request.headers as Record<string, unknown>));
    if (!user) return reply.code(401).send({ error: "session token required" });

    const body = (request.body ?? {}) as { body?: string; stance?: string };
    if (!body.body || body.body.trim().length === 0) {
      return reply.code(400).send({ error: "post body required" });
    }
    const stance = ["for", "against", "abstain"].includes(body.stance ?? "") ? body.stance! : null;
    const result = await moderateAndStorePost(sql, {
      billId,
      userId: user.id as number,
      body: body.body.slice(0, 4000),
      stance
    });
    if (result.status === "banned") return reply.code(403).send(result);
    return { ...result, publicBanCount: await publicBanCount(sql, user.id as number) };
  });

  app.post("/api/admin/import", async () => {
    const summary = await runFullImport();
    return summary;
  });
}
