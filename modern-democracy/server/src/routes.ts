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
import { importNews, newsForSubject } from "./services/news.js";
import {
  constituencyElections,
  listRepresentatives,
  partySummaries,
  representativeDetail
} from "./services/representatives.js";
import {
  ballotMajorities,
  constituencyLeans,
  leaderApproval,
  mediaArticles,
  mediaCompass,
  mrpProjection,
  nationalCompass,
  partyPopularity,
  pollingSnapshot,
  pollingTrend
} from "./services/insights.js";
import { importMrp } from "./services/polling.js";
import { billStats } from "./services/bills-stats.js";
import { mediaInfluence, newsForParty } from "./services/media-lens.js";
import { moderateAndStorePost, publicBanCount } from "./services/moderation.js";
import { runFullImport } from "./worker-jobs.js";
import { getUserEngagementStats, computeEngagementStatsForUser } from "./services/learning.js";
import {
  civicPostcodeProfile,
  fiscalCivicOverview,
  importCivicData,
  listCivicSources,
  localCivicOverview
} from "./services/civic-data.js";
import { memberInterests } from "./services/interests.js";
import { enrichDebateSpeakers, type SpeakerTally } from "./services/hansard.js";
import { departmentProfile, listDepartments } from "./services/departments.js";

function bearer(headers: Record<string, unknown>) {
  const value = headers.authorization;
  if (typeof value !== "string") return undefined;
  return value.replace(/^Bearer\s+/i, "");
}

function getNextMilestone(
  level: string,
  billsVoted: number,
  topicsViewed: number
): { target: string; billsNeeded: number; billsRemaining: number; topicsNeeded: number; topicsRemaining: number } | null {
  const milestones = [
    { target: "curious", billsNeeded: 1, topicsNeeded: 1 },
    { target: "engaged", billsNeeded: 6, topicsNeeded: 3 },
    { target: "committed", billsNeeded: 21, topicsNeeded: 5 },
    { target: "scholar", billsNeeded: 50, topicsNeeded: 8 }
  ];

  const nextMilestone = milestones.find((m) => m.target !== level);
  if (!nextMilestone) return null;

  return {
    target: nextMilestone.target,
    billsNeeded: nextMilestone.billsNeeded,
    billsRemaining: Math.max(0, nextMilestone.billsNeeded - billsVoted),
    topicsNeeded: nextMilestone.topicsNeeded,
    topicsRemaining: Math.max(0, nextMilestone.topicsNeeded - topicsViewed)
  };
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
        (select count(*)::int from checkpoints) as checkpoints,
        (select count(*)::int from source_registry) as civic_sources,
        (select count(*)::int from aggregate_views) as aggregate_views
    `;
    const imports = await sql`
      select kind, status, detail, started_at, finished_at
      from data_import_runs order by id desc limit 8
    `;
    return { counts, imports };
  });

  app.get("/api/civic/sources", async (request) => {
    const category = (request.query as { category?: string }).category;
    return { sources: await listCivicSources(sql, category) };
  });

  app.get("/api/civic/local", async () => localCivicOverview(sql));

  app.get("/api/civic/fiscal", async () => fiscalCivicOverview(sql));

  app.get("/api/civic/postcode/:postcode", async (request, reply) => {
    try {
      const postcode = (request.params as { postcode: string }).postcode;
      const result = await civicPostcodeProfile(postcode);
      if ("error" in result) return reply.code(404).send(result);
      return result;
    } catch {
      return reply.code(503).send({ error: "lookup-unavailable" });
    }
  });

  app.post("/api/admin/import/civic-data", async () => {
    return importCivicData(sql);
  });

  app.get("/api/bills/stats", async () => {
    return billStats(sql);
  });

  app.get("/api/bills", async (request) => {
    const take = Math.min(Number((request.query as { take?: string }).take ?? 20), 50);
    const bills = await sql`
      select b.id, b.short_title, b.long_title, b.current_house, b.current_stage,
             b.bill_type, b.is_act, b.is_defeated, b.last_updated, b.source_url,
             exists(select 1 from bill_texts t where t.bill_id = b.id and t.text_content is not null) as has_text,
             (select count(*)::int from anonymous_ballots ab where ab.bill_id = b.id) as ballots,
             (select count(*)::int from divisions d where d.bill_id = b.id) as divisions,
             (select count(*)::int from debate_posts dp where dp.bill_id = b.id and dp.moderation_state <> 'blocked') as debate_posts,
             (select count(*)::int from bill_debates bd where bd.bill_id = b.id) as hansard_debates,
             (select count(*)::int from news_bill_links nl where nl.bill_id = b.id) as news_items,
             exists(select 1 from ai_analyses a where a.subject_type = 'bill' and a.subject_id = b.id::text and a.kind = 'summary') as has_summary,
             exists(select 1 from ai_analyses a where a.subject_type = 'bill' and a.subject_id = b.id::text and a.kind = 'compass') as has_compass,
             exists(select 1 from ai_analyses a where a.subject_type = 'bill' and a.subject_id = b.id::text and a.kind = 'debate-summary') as has_debate_summary
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
      where subject_type = 'bill' and subject_id = ${String(billId)}
        and kind in ('summary', 'compass', 'debate-summary')
      order by kind, id desc
    `;
    const debates = await sql`
      select id, ext_id, title, house, sitting_date, contributions, speakers, source_url,
             coalesce(speaker_breakdown, '[]'::jsonb) as speaker_breakdown
      from bill_debates where bill_id = ${billId}
      order by sitting_date desc nulls last
    `;
    const enrichedSpeakers = await enrichDebateSpeakers(
      sql,
      debates.map((debate) => (debate.speaker_breakdown as SpeakerTally[]) ?? [])
    );
    const debatesWithSpeakers = debates.map(({ speaker_breakdown, ...debate }, index) => ({
      ...debate,
      speakers_detail: enrichedSpeakers[index]
    }));
    const [checkpoint] = await sql`
      select merkle_root, ballot_count, checkpoint_hash, created_at
      from checkpoints where bill_id = ${billId} order by id desc limit 1
    `;
    // How each current MP voted on this bill, by constituency, from the Commons
    // divisions linked to it (latest division wins per member). Lets the bill
    // page show "your MP voted X" for the selected seat.
    const mpVotes = await sql`
      select distinct on (r.constituency_id)
             r.constituency_id, r.id as member_id, r.name as mp_name,
             p.abbreviation as party_abbreviation, p.background_colour as party_colour,
             dv.vote, d.date
      from divisions d
      join division_votes dv on dv.division_id = d.id
      join representatives r on r.id = dv.member_id
      left join parties p on p.id = r.party_id
      where d.bill_id = ${billId} and r.constituency_id is not null
      order by r.constituency_id, d.date desc nulls last
    `;
    const aggregates = await billAggregates(sql, billId);
    const news = await newsForSubject(sql, { billId });
    return {
      bill,
      texts,
      events,
      analyses,
      debates: debatesWithSpeakers,
      mpVotes,
      checkpoint: checkpoint ?? null,
      aggregates,
      news
    };
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

  app.get("/api/representatives", async (request) => {
    const query = request.query as { search?: string; party?: string; skip?: string; take?: string };
    return listRepresentatives(sql, {
      search: query.search,
      party: query.party,
      skip: Number(query.skip ?? 0),
      take: Number(query.take ?? 24)
    });
  });

  app.get("/api/representatives/:id", async (request, reply) => {
    const memberId = Number((request.params as { id: string }).id);
    const detail = await representativeDetail(sql, memberId);
    if (!detail) return reply.code(404).send({ error: "representative not found" });
    return detail;
  });

  app.get("/api/representatives/:id/interests", async (request, reply) => {
    const memberId = Number((request.params as { id: string }).id);
    if (!Number.isFinite(memberId)) return reply.code(400).send({ error: "bad member id" });
    try {
      return await memberInterests(sql, memberId);
    } catch {
      return reply.code(502).send({ error: "interests api unavailable" });
    }
  });

  app.get("/api/departments", async () => {
    return { departments: listDepartments() };
  });

  app.get("/api/departments/:slug", async (request, reply) => {
    const slug = (request.params as { slug: string }).slug;
    const profile = await departmentProfile(sql, slug);
    if (!profile) return reply.code(404).send({ error: "unknown department" });
    return { department: profile };
  });

  app.get("/api/parties", async () => {
    return { parties: await partySummaries(sql) };
  });

  app.get("/api/parties/:id/news", async (request) => {
    const partyId = Number((request.params as { id: string }).id);
    return { news: await newsForParty(sql, partyId) };
  });

  app.get("/api/constituencies/:id/elections", async (request) => {
    const constituencyId = Number((request.params as { id: string }).id);
    return { elections: await constituencyElections(sql, constituencyId) };
  });

  app.get("/api/insights/media", async () => {
    return mediaCompass(sql);
  });

  app.get("/api/insights/media-influence", async () => {
    return mediaInfluence(sql);
  });

  app.get("/api/insights/party-popularity", async (request, reply) => {
    const partyId = Number((request.query as { partyId?: string }).partyId);
    if (!Number.isFinite(partyId)) return reply.code(400).send({ error: "partyId required" });
    return partyPopularity(sql, partyId);
  });

  app.get("/api/insights/national-compass", async () => {
    return nationalCompass(sql);
  });

  app.get("/api/insights/media-articles", async (request) => {
    const take = Math.min(Number((request.query as { take?: string }).take ?? 40), 100);
    return mediaArticles(sql, take);
  });

  app.get("/api/insights/ballots", async (request) => {
    const raw = (request.query as { constituencyId?: string }).constituencyId;
    const constituencyId = raw ? Number(raw) : null;
    return ballotMajorities(sql, Number.isFinite(constituencyId) ? constituencyId : null);
  });

  app.get("/api/insights/leans", async () => {
    return constituencyLeans(sql);
  });

  app.get("/api/insights/polling", async () => {
    return pollingSnapshot(sql);
  });

  app.get("/api/insights/polling/trend", async (request) => {
    const weeks = Math.min(Math.max(Number((request.query as { weeks?: string }).weeks ?? 26), 4), 260);
    return pollingTrend(sql, weeks);
  });

  app.get("/api/insights/leader-approval", async () => {
    return leaderApproval(sql);
  });

  app.get("/api/insights/mrp", async (request) => {
    const source = (request.query as { source?: string }).source;
    return mrpProjection(sql, source);
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
             (select count(*)::int from temporary_bans tb where tb.user_id = dp.user_id) as public_ban_count,
             c.x as compass_x, c.y as compass_y
      from debate_posts dp
      join users u on u.id = dp.user_id
      left join lateral (
        select (output->>'x')::float as x, (output->>'y')::float as y
        from ai_analyses
        where subject_type = 'debate_post' and subject_id = dp.id::text
          and kind = 'compass' and output->>'x' is not null
        order by id desc limit 1
      ) c on true
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

  app.post("/api/admin/import/news", async () => {
    return importNews(sql);
  });

  // Import a published MRP projection (semi-automated; no free auto feed).
  // Body: { source, releasedOn: "YYYY-MM-DD", rows: [{ constituency, winner?, parties }] }
  app.post("/api/admin/import/mrp", async (request, reply) => {
    try {
      return await importMrp(sql, request.body as Parameters<typeof importMrp>[1]);
    } catch (error) {
      return reply.code(400).send({ error: error instanceof Error ? error.message : "import failed" });
    }
  });

  // Learning & gamification endpoints
  app.get("/api/auth/me/engagement", async (request, reply) => {
    const user = await publicUserFromToken(sql, bearer(request.headers as Record<string, unknown>));
    if (!user) return reply.code(401).send({ error: "not signed in" });

    const stats = await getUserEngagementStats(sql, user.id);
    if (!stats) return reply.code(404).send({ error: "engagement stats not found" });

    return {
      engagement: {
        billsVoted: stats.billsVoted,
        debatePostsCreated: stats.debatePostsCreated,
        constituenciesExplored: stats.constituenciesExplored,
        helpTopicsViewed: stats.helpTopicsViewed,
        currentStreak: stats.currentStreak,
        engagementLevel: stats.engagementLevel,
        achievements: stats.achievements,
        nextMilestone: getNextMilestone(stats.engagementLevel, stats.billsVoted, stats.helpTopicsViewed)
      }
    };
  });

  app.post("/api/auth/me/help-view", async (request, reply) => {
    const user = await publicUserFromToken(sql, bearer(request.headers as Record<string, unknown>));
    if (!user) return reply.code(401).send({ error: "not signed in" });

    const body = (request.body ?? {}) as { topicId?: string };
    if (!body.topicId) return reply.code(400).send({ error: "topicId required" });

    try {
      await sql`
        insert into user_help_views (user_id, topic_id, viewed_at)
        values (${user.id}, ${body.topicId}, now())
        on conflict (user_id, topic_id) do nothing
      `;

      // Update engagement stats
      await computeEngagementStatsForUser(sql, user.id);

      return { ok: true, topicId: body.topicId };
    } catch (err) {
      return reply.code(500).send({ error: "failed to record help view" });
    }
  });

  app.get("/api/auth/me/learning", async (request, reply) => {
    const user = await publicUserFromToken(sql, bearer(request.headers as Record<string, unknown>));
    if (!user) return reply.code(401).send({ error: "not signed in" });

    const helpViews = await sql`
      select topic_id from user_help_views where user_id = ${user.id}
    `;

    const achievements = await sql`
      select achievement_id, unlocked_at from user_achievements
      where user_id = ${user.id}
      order by unlocked_at desc
    `;

    return {
      learning: {
        helpTopicsViewed: helpViews.map((r: any) => r.topic_id),
        achievements: achievements.map((r: any) => ({
          id: r.achievement_id,
          unlockedAt: r.unlocked_at
        }))
      }
    };
  });
}
