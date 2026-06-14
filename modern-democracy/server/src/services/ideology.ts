import type { Sql } from "postgres";

/**
 * Compute a more genuinely ideological position per MP, then anchor the economic
 * axis to a conventional reference.
 *
 * Why: raw revealed-preference from whipped division votes makes the two big
 * parties exact mirror images and its left/right sign is an artifact of which
 * party is in government. Instead we:
 *  - weight REBELLIONS (vote against own party majority) and FREE/split votes up
 *    — they reveal conscience, not the whip — and whipped bloc votes down;
 *  - blend in the compass of media coverage the MP is quoted in (lighter weight);
 *  - ANCHOR the economic (x) axis so the two largest parties sit in their
 *    conventional order (Conservatives right of Labour), resolving the inherent
 *    sign ambiguity. The flip is stored in app_meta(econ_flip) and applied to
 *    every scorer-derived economic-x so the whole compass stays consistent.
 *
 * This is honest about what it is: positions from unwhipped votes, rebellions
 * and quoted coverage, oriented to a conventional reference — not a precise
 * ideology measurement.
 */

const REBELLION_WEIGHT = 3;
const FREE_VOTE_WEIGHT = 2;
const WHIPPED_WEIGHT = 1;
const MEDIA_BLEND = 0.2;

export async function refreshIdeology(sql: Sql) {
  const billRows = await sql`
    select distinct on (a.subject_id) (a.subject_id)::int as bill_id,
           (a.output->>'x')::float as x, (a.output->>'y')::float as y
    from ai_analyses a
    where a.subject_type = 'bill' and a.kind = 'compass' and a.output->>'x' is not null
    order by a.subject_id, a.id desc
  `;
  const billVec = new Map(billRows.map((b) => [b.bill_id as number, { x: b.x as number, y: b.y as number }]));

  // Party majority per division (to detect rebellions and free/split votes).
  const pm = await sql`
    select d.id as division_id, r.party_id,
           count(*) filter (where dv.vote = 'aye')::int as ayes,
           count(*) filter (where dv.vote = 'no')::int as noes
    from division_votes dv
    join representatives r on r.id = dv.member_id
    join divisions d on d.id = dv.division_id
    where d.bill_id is not null and r.party_id is not null
    group by d.id, r.party_id
  `;
  const partyMaj = new Map<string, { ayes: number; noes: number }>();
  for (const row of pm) partyMaj.set(`${row.division_id}:${row.party_id}`, { ayes: row.ayes as number, noes: row.noes as number });

  const votes = await sql`
    select dv.member_id, r.party_id, d.id as division_id, d.bill_id, dv.vote
    from division_votes dv
    join representatives r on r.id = dv.member_id
    join divisions d on d.id = dv.division_id
    where d.bill_id is not null
  `;
  const acc = new Map<number, { x: number; y: number; w: number }>();
  for (const v of votes) {
    const bv = billVec.get(v.bill_id as number);
    if (!bv) continue;
    const maj = partyMaj.get(`${v.division_id}:${v.party_id}`);
    let weight = WHIPPED_WEIGHT;
    if (maj) {
      const total = maj.ayes + maj.noes;
      const majVote = maj.ayes >= maj.noes ? "aye" : "no";
      const share = total ? Math.max(maj.ayes, maj.noes) / total : 1;
      if (v.vote !== majVote) weight = REBELLION_WEIGHT;
      else if (share < 0.65) weight = FREE_VOTE_WEIGHT;
    }
    const sign = v.vote === "aye" ? 1 : -1;
    const e = acc.get(v.member_id as number) ?? { x: 0, y: 0, w: 0 };
    e.x += weight * sign * bv.x;
    e.y += weight * sign * bv.y;
    e.w += weight;
    acc.set(v.member_id as number, e);
  }

  // Media coverage the MP is quoted in (lighter signal of stated positions).
  const media = await sql`
    select l.member_id,
           avg((a.output->>'x')::float)::float as x,
           avg((a.output->>'y')::float)::float as y,
           count(*)::int as n
    from news_member_links l
    join ai_analyses a on a.subject_type = 'news_item' and a.kind = 'compass'
      and a.subject_id = l.news_item_id::text and a.output->>'x' is not null
    group by l.member_id
  `;
  const mediaByMember = new Map(media.map((m) => [m.member_id as number, { x: m.x as number, y: m.y as number, n: m.n as number }]));

  const reps = await sql`select id, party_id from representatives`;
  const partyOf = new Map(reps.map((r) => [r.id as number, r.party_id as number | null]));

  // Raw per-member position (pre-orientation): weighted votes + media blend.
  const rawMP = new Map<number, { x: number; y: number; w: number; hasMedia: boolean }>();
  for (const r of reps) {
    const id = r.id as number;
    const e = acc.get(id);
    const m = mediaByMember.get(id);
    let x: number | null = null;
    let y: number | null = null;
    let w = 0;
    let hasMedia = false;
    if (e && e.w > 0) {
      x = e.x / e.w;
      y = e.y / e.w;
      w = e.w;
    }
    if (m && m.n >= 2) {
      hasMedia = true;
      if (x == null) {
        x = m.x;
        y = m.y;
      } else {
        x = (1 - MEDIA_BLEND) * x + MEDIA_BLEND * m.x;
        y = (1 - MEDIA_BLEND) * (y as number) + MEDIA_BLEND * m.y;
      }
    }
    if (x != null && y != null) rawMP.set(id, { x, y, w, hasMedia });
  }

  // Party raw means + weighted sample (how much real signal the party has).
  const partyRaw = new Map<number, { x: number; y: number; n: number; w: number }>();
  for (const [mid, p] of rawMP) {
    const pid = partyOf.get(mid);
    if (pid == null) continue;
    const s = partyRaw.get(pid) ?? { x: 0, y: 0, n: 0, w: 0 };
    s.x += p.x;
    s.y += p.y;
    s.n += 1;
    s.w += p.w;
    partyRaw.set(pid, s);
  }
  const partyRawMean = new Map(
    [...partyRaw].map(([pid, s]) => [pid, { x: s.n ? s.x / s.n : 0, y: s.n ? s.y / s.n : 0, w: s.w }])
  );

  // Orient x so Conservatives sit right of Labour (resolves the sign ambiguity).
  const [conP] = await sql`select id from parties where name = 'Conservative'`;
  const [labP] = await sql`select id from parties where name = 'Labour'`;
  let flip = 1;
  if (conP && labP) {
    const c = partyRawMean.get(conP.id as number);
    const l = partyRawMean.get(labP.id as number);
    if (c && l && c.x < l.x) flip = -1;
  }

  // Party display = conventional reference blended with the oriented voting
  // record, weighted by how much real data the party has. Small parties (few
  // scored votes) fall back to their established placement instead of noise.
  const partyRows = await sql`select id, name from parties`;
  const partyPos = new Map<number, { x: number; y: number }>();
  for (const pr of partyRows) {
    const pid = pr.id as number;
    const ref = referenceFor(pr.name as string);
    const raw = partyRawMean.get(pid);
    const oriented = raw ? { x: flip * raw.x, y: raw.y } : null;
    const conf = raw ? Math.min(1, raw.w / PARTY_FULL) : 0;
    if (ref && oriented) partyPos.set(pid, { x: conf * oriented.x + (1 - conf) * ref.x, y: conf * oriented.y + (1 - conf) * ref.y });
    else if (ref) partyPos.set(pid, ref);
    else if (oriented) partyPos.set(pid, oriented);
    else partyPos.set(pid, { x: 0, y: 0 });
  }

  // Each MP = their party's position plus their personal deviation (rebellions /
  // free votes / coverage), scaled by how much personal signal they have.
  const finalMP = new Map<number, { x: number; y: number; sample: number; hasMedia: boolean }>();
  for (const r of reps) {
    const id = r.id as number;
    const pid = partyOf.get(id);
    const base = pid != null ? partyPos.get(pid) ?? null : null;
    const raw = rawMP.get(id);
    if (!base && !raw) continue;
    if (!base && raw) {
      finalMP.set(id, { x: round2(flip * raw.x), y: round2(raw.y), sample: Math.round(raw.w), hasMedia: raw.hasMedia });
      continue;
    }
    let x = base!.x;
    let y = base!.y;
    let sample = 0;
    let hasMedia = false;
    if (raw) {
      const partyMean = pid != null ? partyRawMean.get(pid) : null;
      const oPartyX = partyMean ? flip * partyMean.x : flip * raw.x;
      const oPartyY = partyMean ? partyMean.y : raw.y;
      const mpConf = Math.min(1, raw.w / MP_FULL);
      x = base!.x + mpConf * (flip * raw.x - oPartyX);
      y = base!.y + mpConf * (raw.y - oPartyY);
      sample = Math.round(raw.w);
      hasMedia = raw.hasMedia;
    }
    finalMP.set(id, { x: round2(x), y: round2(y), sample, hasMedia });
  }

  await sql`delete from member_ideology`;
  for (const [mid, p] of finalMP) {
    await sql`
      insert into member_ideology (member_id, x, y, sample, has_media)
      values (${mid}, ${p.x}, ${p.y}, ${p.sample}, ${p.hasMedia})
      on conflict (member_id) do update set
        x = excluded.x, y = excluded.y, sample = excluded.sample, has_media = excluded.has_media, updated_at = now()
    `;
  }
  await sql`
    insert into app_meta (key, value) values ('econ_flip', ${String(flip)})
    on conflict (key) do update set value = excluded.value, updated_at = now()
  `;
  return { members: finalMP.size, flip };
}

const round2 = (v: number) => Math.round(v * 100) / 100;

const PARTY_FULL = 150; // weighted-vote units for the data to fully override the reference
const MP_FULL = 12; // personal weighted-vote units for an MP to fully express their deviation

/**
 * Conventional reference placement per party (economic x, social y; ±10). Used
 * only as a PRIOR — the voting record overrides it as scored-vote evidence
 * accumulates. Labelled as a reference, not a measurement.
 */
const PARTY_REFERENCE: Array<{ match: string[]; x: number; y: number }> = [
  { match: ["conservative"], x: 5, y: 3 },
  { match: ["labour"], x: -4, y: -1 },
  { match: ["liberal democrat"], x: -2, y: -4 },
  { match: ["green"], x: -6, y: -5 },
  { match: ["reform"], x: 7, y: 6 },
  { match: ["scottish national", "snp"], x: -4, y: -3 },
  { match: ["plaid"], x: -5, y: -4 },
  { match: ["democratic unionist", "dup"], x: 6, y: 6 },
  { match: ["sinn"], x: -7, y: -2 },
  { match: ["social democratic and labour", "sdlp"], x: -3, y: -1 },
  { match: ["alliance"], x: 0, y: -2 },
  { match: ["ulster unionist", "uup"], x: 3, y: 3 },
  { match: ["traditional unionist", "tuv"], x: 6, y: 7 }
];
function referenceFor(name: string): { x: number; y: number } | null {
  const lower = name.toLowerCase();
  const hit = PARTY_REFERENCE.find((p) => p.match.some((m) => lower.includes(m)));
  return hit ? { x: hit.x, y: hit.y } : null;
}

/** Party ideology = mean of its members' anchored positions. */
export async function partyIdeology(sql: Sql) {
  const rows = await sql`
    select r.party_id,
           round(avg(mi.x)::numeric, 2)::float as x,
           round(avg(mi.y)::numeric, 2)::float as y,
           count(*)::int as sample
    from member_ideology mi
    join representatives r on r.id = mi.member_id
    where r.party_id is not null
    group by r.party_id
  `;
  return new Map(rows.map((r) => [r.party_id as number, { x: r.x as number, y: r.y as number, sample: r.sample as number }]));
}
