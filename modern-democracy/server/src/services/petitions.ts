import type { Sql } from "postgres";
import { analyzeAndStore } from "./ai.js";
import { moderateAndStorePost } from "./moderation.js";

const PETITIONS_API = "https://petition.parliament.uk/petitions.json";

type PetitionApiItem = {
  id: number;
  attributes?: {
    action?: string;
    background?: string;
    additional_details?: string;
    state?: string;
    signature_count?: number;
    opened_at?: string;
    created_at?: string;
  };
};

/** Import the current open petitions (the API returns them most-signed first). */
export async function importPetitions(sql: Sql, pages = 2) {
  const [run] = await sql`
    insert into data_import_runs (kind) values ('petitions') returning id
  `;
  try {
    let imported = 0;
    for (let page = 1; page <= pages; page += 1) {
      const response = await fetch(`${PETITIONS_API}?state=open&page=${page}`, {
        headers: { accept: "application/json" }
      });
      if (!response.ok) throw new Error(`petitions API returned ${response.status}`);
      const payload = (await response.json()) as { data?: PetitionApiItem[] };
      for (const item of payload.data ?? []) {
        const a = item.attributes ?? {};
        if (!a.action) continue;
        await sql`
          insert into petitions (id, action, background, additional_details, state, signature_count, opened_at, updated_at)
          values (
            ${item.id}, ${a.action}, ${a.background ?? null}, ${a.additional_details ?? null},
            ${a.state ?? "open"}, ${a.signature_count ?? 0}, ${a.opened_at ?? a.created_at ?? null}, now()
          )
          on conflict (id) do update set
            action = excluded.action, background = excluded.background,
            additional_details = excluded.additional_details, state = excluded.state,
            signature_count = excluded.signature_count, updated_at = now()
        `;
        imported += 1;
      }
    }
    await sql`
      update data_import_runs set status = 'succeeded', finished_at = now(),
        detail = ${sql.json({ petitions: imported })} where id = ${run.id}
    `;
    return { petitions: imported };
  } catch (error) {
    await sql`
      update data_import_runs set status = 'failed', finished_at = now(),
        detail = ${sql.json({ error: error instanceof Error ? error.message : "unknown" })}
      where id = ${run.id}
    `;
    return { petitions: 0 };
  }
}

/**
 * Summary + compass analyses for petitions — unanalyzed first so every
 * petition ends up with a compass position over import cycles.
 */
export async function analyzePetitions(sql: Sql, limit = 30) {
  const petitions = await sql`
    select id, action, background, additional_details from petitions
    where state = 'open'
    order by exists (
               select 1 from ai_analyses a
               where a.subject_type = 'petition' and a.subject_id = petitions.id::text and a.kind = 'compass'
             ) asc,
             signature_count desc
    limit ${limit}
  `;
  let generated = 0;
  for (const petition of petitions) {
    const text = [petition.action, petition.background, petition.additional_details]
      .filter(Boolean)
      .join("\n\n");
    if (text.trim().length < 20) continue;
    const citations = [
      { label: "Official petition", url: `https://petition.parliament.uk/petitions/${petition.id}` }
    ];
    const compass = await analyzeAndStore(sql, {
      subjectType: "petition",
      subjectId: String(petition.id),
      kind: "compass",
      text,
      citations
    });
    const summary = await analyzeAndStore(sql, {
      subjectType: "petition",
      subjectId: String(petition.id),
      kind: "summary",
      text,
      citations
    });
    if (!compass.reused || !summary.reused) generated += 1;
  }
  return { petitionsAnalyzed: petitions.length, generated };
}

export async function listPetitions(sql: Sql, take = 30) {
  const petitions = await sql`
    select p.id, p.action, p.state, p.signature_count, p.opened_at,
      (select count(*)::int from petition_votes pv where pv.petition_id = p.id and pv.choice = 'for') as for_count,
      (select count(*)::int from petition_votes pv where pv.petition_id = p.id and pv.choice = 'against') as against_count,
      (select count(*)::int from petition_votes pv where pv.petition_id = p.id and pv.choice = 'abstain') as abstain_count,
      (select count(*)::int from debate_posts dp where dp.petition_id = p.id and dp.moderation_state <> 'blocked') as debate_count
    from petitions p
    where p.state = 'open'
    order by p.signature_count desc
    limit ${take}
  `;
  return petitions;
}

export async function petitionDetail(sql: Sql, petitionId: number, userId: number | null) {
  const [petition] = await sql`
    select id, action, background, additional_details, state, signature_count, opened_at
    from petitions where id = ${petitionId}
  `;
  if (!petition) return null;

  const analyses = await sql`
    select kind, model, output, confidence, generated_at
    from ai_analyses
    where subject_type = 'petition' and subject_id = ${String(petitionId)}
      and kind in ('summary', 'compass')
    order by id desc
  `;
  const latest = new Map<string, (typeof analyses)[number]>();
  for (const row of analyses) if (!latest.has(row.kind as string)) latest.set(row.kind as string, row);

  const [votes] = await sql`
    select
      count(*) filter (where choice = 'for')::int as for_count,
      count(*) filter (where choice = 'against')::int as against_count,
      count(*) filter (where choice = 'abstain')::int as abstain_count,
      count(*)::int as total
    from petition_votes where petition_id = ${petitionId}
  `;

  const [myVote] = userId
    ? await sql`select choice from petition_votes where petition_id = ${petitionId} and user_id = ${userId}`
    : [];

  const posts = await sql`
    select dp.id, dp.stance, dp.moderation_state, dp.created_at,
           case when dp.moderation_state in ('hidden', 'blocked') then null else dp.body end as body,
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
    where dp.petition_id = ${petitionId} and dp.moderation_state <> 'blocked'
    order by dp.id desc
    limit 100
  `;

  return {
    petition: {
      id: petition.id,
      action: petition.action,
      background: petition.background,
      additionalDetails: petition.additional_details,
      state: petition.state,
      signatureCount: petition.signature_count,
      openedAt: petition.opened_at,
      officialUrl: `https://petition.parliament.uk/petitions/${petition.id}`
    },
    analyses: {
      summary: latest.get("summary")?.output ?? null,
      compass: latest.get("compass")
        ? { ...(latest.get("compass")!.output as Record<string, unknown>), model: latest.get("compass")!.model, confidence: latest.get("compass")!.confidence }
        : null
    },
    votes: {
      for: votes.for_count,
      against: votes.against_count,
      abstain: votes.abstain_count,
      total: votes.total
    },
    myVote: (myVote?.choice as string) ?? null,
    posts
  };
}

export async function castPetitionVote(
  sql: Sql,
  userId: number,
  petitionId: number,
  choice: "for" | "against" | "abstain"
) {
  const [petition] = await sql`select id from petitions where id = ${petitionId}`;
  if (!petition) return { error: "petition-not-found" as const };
  await sql`
    insert into petition_votes (petition_id, user_id, choice)
    values (${petitionId}, ${userId}, ${choice})
    on conflict (petition_id, user_id) do update set choice = excluded.choice, cast_at = now()
  `;
  return { ok: true as const };
}

export async function postPetitionDebate(
  sql: Sql,
  params: { petitionId: number; userId: number; body: string; stance: string | null }
) {
  return moderateAndStorePost(sql, {
    petitionId: params.petitionId,
    userId: params.userId,
    body: params.body,
    stance: params.stance
  });
}
