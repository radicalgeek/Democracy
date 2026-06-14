import type { Sql } from "postgres";
import { ownershipFor } from "./media-lens.js";
import { econFlip } from "./orientation.js";

/**
 * Media-influence metrics derived from the coverage we score. Every number is an
 * observed signal with a sample size — agenda-setting (who gets airtime, who
 * breaks stories), treatment (tone asymmetry / hostile framing), the quality of
 * the information diet, and ownership plurality. None of this feeds an MP/party
 * integrity score, and tone asymmetry flags coverage for scrutiny — it is never
 * a claim that a story is false.
 */

const RECENT_DAYS = 30;
const recent = (sql: Sql, days = RECENT_DAYS) =>
  sql`(n.published_at is null or n.published_at >= now() - make_interval(days => ${days}))`;

export async function mediaMetrics(sql: Sql) {
  const flip = await econFlip(sql);

  // --- Share of voice: who/what gets airtime ---
  const sovParties = await sql`
    select p.name, p.background_colour as colour, count(*)::int as n
    from news_party_links l
    join news_items n on n.id = l.news_item_id
    join parties p on p.id = l.party_id
    where ${recent(sql)}
    group by p.name, p.background_colour order by n desc limit 8
  `;
  const sovMembers = await sql`
    select r.name, p.background_colour as colour, count(*)::int as n
    from news_member_links l
    join news_items n on n.id = l.news_item_id
    join representatives r on r.id = l.member_id
    left join parties p on p.id = r.party_id
    where ${recent(sql)}
    group by r.name, p.background_colour order by n desc limit 8
  `;

  // --- Tone by party: hostile/allegation/sensational framing rates ---
  const tone = await sql`
    select p.name, p.background_colour as colour, count(*)::int as n,
           round(avg(na.sensational)::numeric, 2)::float as sensational,
           count(*) filter (where na.framing = 'allegation')::int as allegation,
           count(*) filter (where na.factual_label in ('single-source', 'contested'))::int as flagged,
           round(avg(na.factual_score)::numeric, 1)::float as reliability
    from news_party_links l
    join news_items n on n.id = l.news_item_id
    join news_assessments na on na.news_item_id = n.id
    join parties p on p.id = l.party_id
    where ${recent(sql)}
    group by p.name, p.background_colour having count(*) >= 3 order by n desc limit 8
  `;
  const toneByParty = tone.map((t) => ({
    name: t.name as string,
    colour: t.colour as string | null,
    articles: t.n as number,
    sensational: t.sensational as number,
    allegationRate: Math.round(((t.allegation as number) / (t.n as number)) * 100),
    hostileRate: Math.round(((t.flagged as number) / (t.n as number)) * 100),
    reliability: t.reliability as number
  }));
  const meanHostileRate = toneByParty.length
    ? Math.round(toneByParty.reduce((s, t) => s + t.hostileRate, 0) / toneByParty.length)
    : 0;

  // --- Ownership concentration (plurality) ---
  const bySource = await sql`
    select s.name, count(*)::int as n
    from news_items n join news_sources s on s.id = n.source_id
    where ${recent(sql)}
    group by s.name
  `;
  const total = bySource.reduce((s, r) => s + (r.n as number), 0) || 1;
  const ownerAgg = new Map<string, { owner: string; n: number; outlets: Set<string> }>();
  for (const r of bySource) {
    const owner = ownershipFor(r.name as string).owner;
    const e = ownerAgg.get(owner) ?? { owner, n: 0, outlets: new Set<string>() };
    e.n += r.n as number;
    e.outlets.add(r.name as string);
    ownerAgg.set(owner, e);
  }
  const byOwner = [...ownerAgg.values()]
    .map((e) => ({ owner: e.owner, share: Math.round((e.n / total) * 100), outlets: e.outlets.size, articles: e.n }))
    .sort((a, b) => b.share - a.share);
  const hhi = Math.round(byOwner.reduce((s, o) => s + (o.share / 100) ** 2, 0) * 1000) / 1000;
  const top3Share = byOwner.slice(0, 3).reduce((s, o) => s + o.share, 0);

  // --- Quality of the information diet ---
  const [mix] = await sql`
    select count(*)::int as total,
           count(*) filter (where factual_label = 'well-corroborated')::int as corroborated,
           count(*) filter (where factual_label = 'contested')::int as contested,
           count(*) filter (where factual_label = 'single-source')::int as single_source,
           count(*) filter (where factual_label = 'opinion')::int as opinion,
           round(avg(sensational)::numeric, 2)::float as sensational
    from news_assessments
  `;
  const trend = await sql`
    select to_char(date_trunc('week', n.published_at)::date, 'YYYY-MM-DD') as week,
           count(*)::int as total,
           count(*) filter (where na.factual_label = 'well-corroborated')::int as corroborated,
           round(avg(na.sensational)::numeric, 2)::float as sensational
    from news_items n join news_assessments na on na.news_item_id = n.id
    where n.published_at >= now() - make_interval(days => 84)
    group by week order by week
  `;

  // --- Agenda leadership: who breaks corroborated stories ---
  const leaders = await sql`
    select s.name, count(*)::int as origins
    from news_assessments na
    join news_items n on n.id = na.news_item_id
    join news_sources s on s.id = n.source_id
    where na.is_origin
    group by s.name order by origins desc limit 8
  `;

  // --- Media centre of gravity (for media↔public divergence on the client) ---
  const [media] = await sql`
    with latest as (
      select distinct on (subject_id) subject_id, (output->>'x')::float as x, (output->>'y')::float as y
      from ai_analyses where subject_type = 'news_item' and kind = 'compass' and output->>'x' is not null
      order by subject_id, id desc
    )
    select round(avg(x)::numeric, 2)::float as x, round(avg(y)::numeric, 2)::float as y, count(*)::int as n from latest
  `;

  return {
    windowDays: RECENT_DAYS,
    shareOfVoice: {
      parties: sovParties.map((r) => ({ name: r.name as string, colour: r.colour as string | null, count: r.n as number })),
      members: sovMembers.map((r) => ({ name: r.name as string, colour: r.colour as string | null, count: r.n as number }))
    },
    toneByParty,
    meanHostileRate,
    ownership: { byOwner, hhi, top3Share },
    reliabilityMix: mix ?? null,
    reliabilityTrend: trend.map((t) => ({
      week: t.week as string,
      corroboratedPct: (t.total as number) ? Math.round(((t.corroborated as number) / (t.total as number)) * 100) : 0,
      sensational: t.sensational as number
    })),
    agendaLeadership: leaders.map((l) => ({ outlet: l.name as string, origins: l.origins as number })),
    mediaOverall: media && (media.n as number) > 0 ? { x: flip * (media.x as number), y: media.y as number, sample: media.n as number } : null,
    note: "Observed signals from scored coverage. Tone asymmetry flags disproportionate framing for scrutiny — not a verdict that a story is false. None of this feeds integrity scores.",
    generatedAt: new Date().toISOString()
  };
}

/** How the press covers one MP or party, with a peer-relative read. */
export async function coverageTone(sql: Sql, opts: { memberId?: number; partyId?: number }) {
  const isMember = opts.memberId != null;
  const rows = isMember
    ? await sql`
        select count(*)::int as n, round(avg(na.sensational)::numeric, 2)::float as sensational,
               count(*) filter (where na.framing = 'allegation')::int as allegation,
               count(*) filter (where na.factual_label in ('single-source','contested'))::int as flagged,
               round(avg(na.factual_score)::numeric, 1)::float as reliability
        from news_member_links l
        join news_items n on n.id = l.news_item_id
        join news_assessments na on na.news_item_id = n.id
        where l.member_id = ${opts.memberId!}
      `
    : await sql`
        select count(*)::int as n, round(avg(na.sensational)::numeric, 2)::float as sensational,
               count(*) filter (where na.framing = 'allegation')::int as allegation,
               count(*) filter (where na.factual_label in ('single-source','contested'))::int as flagged,
               round(avg(na.factual_score)::numeric, 1)::float as reliability
        from news_party_links l
        join news_items n on n.id = l.news_item_id
        join news_assessments na on na.news_item_id = n.id
        where l.party_id = ${opts.partyId!}
      `;
  const t = rows[0];
  const n = (t?.n as number) ?? 0;
  if (n === 0) return { articles: 0, hostileRate: null, allegationRate: null, sensational: null, reliability: null, vsAverage: null, peerMeanHostile: null };

  // Peer mean hostile rate, to read asymmetry.
  const [peer] = isMember
    ? await sql`
        select round(avg(rate)::numeric, 0)::int as mean from (
          select count(*) filter (where na.factual_label in ('single-source','contested'))::float / count(*) * 100 as rate
          from news_member_links l join news_assessments na on na.news_item_id = l.news_item_id
          group by l.member_id having count(*) >= 3
        ) q
      `
    : await sql`
        select round(avg(rate)::numeric, 0)::int as mean from (
          select count(*) filter (where na.factual_label in ('single-source','contested'))::float / count(*) * 100 as rate
          from news_party_links l join news_assessments na on na.news_item_id = l.news_item_id
          group by l.party_id having count(*) >= 3
        ) q
      `;
  const hostileRate = Math.round(((t!.flagged as number) / n) * 100);
  const peerMean = (peer?.mean as number) ?? 0;
  const vsAverage = hostileRate >= peerMean + 12 ? "above" : hostileRate <= peerMean - 12 ? "below" : "about";
  return {
    articles: n,
    hostileRate,
    allegationRate: Math.round(((t!.allegation as number) / n) * 100),
    sensational: t!.sensational as number,
    reliability: t!.reliability as number,
    peerMeanHostile: peerMean,
    vsAverage
  };
}
