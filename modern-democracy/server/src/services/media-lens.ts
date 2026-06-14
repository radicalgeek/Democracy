import type { Sql } from "postgres";

/**
 * Media lens: turns scored coverage into a view of media influence on our
 * politics — editorial lean, factual reliability (framing + cross-outlet
 * corroboration + outlet track record), the entities each story is about, and
 * the recurring narratives shaping the conversation.
 *
 * Reliability is corroboration-led, not a hand-assigned "trust" list, and the
 * evidence (how many outlets corroborated, the framing) is always shown. None
 * of this ever feeds an MP/party integrity score — that is verifiable conduct
 * only, by design, so hostile coverage cannot damage a person's score.
 */

const STOP = new Set([
  "the", "and", "for", "with", "from", "into", "that", "this", "says", "after",
  "over", "amid", "could", "would", "should", "will", "have", "has", "not",
  "new", "uk", "mps", "mp", "government", "minister", "ministers", "people",
  "plan", "plans", "call", "calls", "set", "get", "may", "his", "her", "they",
  "what", "how", "why", "who", "more", "than", "but", "are", "was", "been",
  "against", "amid", "first", "back", "make", "made", "take", "told", "tory", "labour",
  "about", "after", "before", "warns", "warn", "urges", "claims", "reveals"
]);

function keyTerms(text: string): string[] {
  return [
    ...new Set(
      text
        .toLowerCase()
        .replace(/[^a-z\s]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length > 3 && !STOP.has(w))
    )
  ];
}

const ALLEGATION = ["alleged", "accus", "claim", "slam", "blast", "fury", "row", "reportedly", "sources say", "denies", "scandal", "smear"];
const OPINION = ["opinion", "comment", "column", "we must", "i'm", "why labour", "why the", "verdict"];
const SENSATIONAL = ["slam", "fury", "blast", "chaos", "shock", "savage", "brutal", "humiliat", "meltdown", "swipe", "rant", "destroy", "erupt", "storm", "outrage", "panic"];

function hits(text: string, words: string[]) {
  const lower = text.toLowerCase();
  return words.reduce((n, w) => n + (lower.includes(w) ? 1 : 0), 0);
}

function framingOf(text: string): string {
  if (hits(text, OPINION) > 0) return "opinion";
  if (hits(text, ALLEGATION) > 0) return "allegation";
  return "fact";
}

function sensationalOf(text: string) {
  return Math.min(1, hits(text, SENSATIONAL) * 0.34);
}

/**
 * Assess each not-yet-assessed article (framing, sensationalism, lean from its
 * compass score) and link it to the MPs and parties it names. Heuristic-first
 * so it works without the LLM; the compass score it reads already used the LLM
 * where the proxy was reachable.
 */
export async function assessAndLinkNews(sql: Sql, limit = 400) {
  const items = await sql`
    select n.id, n.title, n.summary,
           (select (a.output->>'x')::float from ai_analyses a
              where a.subject_type = 'news_item' and a.kind = 'compass' and a.subject_id = n.id::text
              order by a.id desc limit 1) as compass_x
    from news_items n
    where not exists (select 1 from news_assessments na where na.news_item_id = n.id)
    order by n.published_at desc nulls last, n.id desc
    limit ${limit}
  `;
  if (items.length === 0) return { assessed: 0, memberLinks: 0, partyLinks: 0 };

  const members = await sql`
    select r.id, r.name, p.name as party from representatives r left join parties p on p.id = r.party_id
  `;
  const parties = await sql`select id, name, abbreviation from parties`;

  // Surname index for MP matching: require the surname plus a constituency/first
  // name token or party to reduce false positives on common surnames.
  const memberIndex = members.map((m) => {
    const parts = String(m.name).split(/\s+/);
    return { id: m.id as number, full: String(m.name).toLowerCase(), surname: (parts[parts.length - 1] ?? "").toLowerCase() };
  });
  const partyIndex = parties.map((p) => ({
    id: p.id as number,
    names: [String(p.name).toLowerCase(), String(p.abbreviation ?? "").toLowerCase()].filter((s) => s.length > 2)
  }));

  let assessed = 0;
  let memberLinks = 0;
  let partyLinks = 0;

  for (const item of items) {
    const text = `${item.title} ${item.summary ?? ""}`;
    const hay = text.toLowerCase();
    const framing = framingOf(text);
    const sensational = sensationalOf(text);
    const bias = (item.compass_x as number | null) ?? null;

    await sql`
      insert into news_assessments (news_item_id, bias, framing, sensational, model, confidence)
      values (${item.id}, ${bias}, ${framing}, ${sensational}, 'heuristic-media-v0', 0.3)
      on conflict (news_item_id) do update set
        bias = excluded.bias, framing = excluded.framing, sensational = excluded.sensational
    `;
    assessed += 1;

    for (const m of memberIndex) {
      if (m.full && hay.includes(m.full)) {
        await sql`insert into news_member_links (news_item_id, member_id) values (${item.id}, ${m.id}) on conflict do nothing`;
        memberLinks += 1;
      }
    }
    for (const p of partyIndex) {
      if (p.names.some((n) => hay.includes(n))) {
        await sql`insert into news_party_links (news_item_id, party_id) values (${item.id}, ${p.id}) on conflict do nothing`;
        partyLinks += 1;
      }
    }
  }
  return { assessed, memberLinks, partyLinks };
}

/**
 * Cross-outlet corroboration + factual reliability. For each recent assessed
 * article, count how many OTHER outlets ran a story sharing its distinctive
 * terms within a window; blend that with framing and sensationalism into a
 * reliability score + label, then roll up an observed track record per outlet.
 */
export async function computeMediaReliability(sql: Sql, windowDays = 45) {
  const rows = await sql`
    select n.id, n.title, n.summary, n.source_id, n.published_at,
           na.framing, na.sensational
    from news_items n
    join news_assessments na on na.news_item_id = n.id
    where n.published_at is null or n.published_at >= now() - make_interval(days => ${windowDays})
  `;
  const enriched = rows.map((r) => ({
    id: r.id as number,
    sourceId: r.source_id as number,
    when: r.published_at ? new Date(r.published_at as string).getTime() : 0,
    terms: keyTerms(`${r.title} ${r.summary ?? ""}`),
    framing: r.framing as string,
    sensational: Number(r.sensational ?? 0)
  }));

  const WINDOW_MS = windowDays * 24 * 3600 * 1000;
  let updated = 0;
  for (const a of enriched) {
    const corroborators = new Set<number>();
    for (const b of enriched) {
      if (b.id === a.id || b.sourceId === a.sourceId) continue;
      if (a.when && b.when && Math.abs(a.when - b.when) > WINDOW_MS) continue;
      const shared = a.terms.filter((t) => b.terms.includes(t)).length;
      if (shared >= 2) corroborators.add(b.sourceId);
    }
    const corrob = corroborators.size;
    let score = 60;
    if (corrob >= 2) score += 22;
    else if (corrob === 1) score += 6;
    else score -= 18; // single-source
    if (a.framing === "allegation") score -= 14;
    if (a.framing === "opinion") score -= 4;
    score -= Math.round(a.sensational * 18);
    score = Math.max(0, Math.min(100, score));

    const label =
      a.framing === "opinion"
        ? "opinion"
        : corrob >= 2
          ? "well-corroborated"
          : a.framing === "allegation" || corrob === 1
            ? "contested"
            : "single-source";

    await sql`
      update news_assessments
      set corroborating_outlets = ${corrob}, factual_score = ${score}, factual_label = ${label}
      where news_item_id = ${a.id}
    `;
    updated += 1;
  }

  // Outlet track record = mean factual score of its assessed articles.
  await sql`
    update news_sources s set
      factual_reliability = agg.avg_score,
      reliability_sample = agg.n
    from (
      select n.source_id, round(avg(na.factual_score)::numeric, 1) as avg_score, count(*)::int as n
      from news_items n join news_assessments na on na.news_item_id = n.id
      where na.factual_score is not null
      group by n.source_id
    ) agg
    where s.id = agg.source_id
  `;
  return { updated };
}

/** Cluster recent coverage into the narratives shaping the conversation. */
export async function extractNarratives(sql: Sql, windowDays = 14) {
  const rows = await sql`
    select n.id, n.title, s.name as source,
           (select (a.output->>'x')::float from ai_analyses a where a.subject_type='news_item' and a.kind='compass' and a.subject_id=n.id::text order by a.id desc limit 1) as x,
           (select (a.output->>'y')::float from ai_analyses a where a.subject_type='news_item' and a.kind='compass' and a.subject_id=n.id::text order by a.id desc limit 1) as y,
           na.factual_label
    from news_items n
    left join news_sources s on s.id = n.source_id
    left join news_assessments na on na.news_item_id = n.id
    where n.published_at is null or n.published_at >= now() - make_interval(days => ${windowDays})
    order by n.published_at desc nulls last
    limit 200
  `;
  type Art = { id: number; title: string; source: string; x: number | null; y: number | null; label: string | null; terms: string[] };
  const arts: Art[] = rows.map((r) => ({
    id: r.id as number,
    title: r.title as string,
    source: (r.source as string) ?? "Unknown",
    x: r.x as number | null,
    y: r.y as number | null,
    label: r.factual_label as string | null,
    terms: keyTerms(r.title as string)
  }));

  // Count term frequency across outlets, keep terms running in ≥2 outlets.
  const termOutlets = new Map<string, Set<string>>();
  for (const a of arts) for (const t of a.terms) {
    const set = termOutlets.get(t) ?? new Set<string>();
    set.add(a.source);
    termOutlets.set(t, set);
  }
  const hotTerms = [...termOutlets.entries()]
    .filter(([, outlets]) => outlets.size >= 2)
    .sort((a, b) => b[1].size - a[1].size)
    .map(([term]) => term);

  const used = new Set<number>();
  const narratives: Array<{ narrative: string; summary: string; leanX: number | null; leanY: number | null; label: string; outlets: string[]; count: number }> = [];
  for (const term of hotTerms) {
    if (narratives.length >= 6) break;
    const cluster = arts.filter((a) => !used.has(a.id) && a.terms.includes(term));
    if (cluster.length < 2) continue;
    cluster.forEach((a) => used.add(a.id));
    const xs = cluster.map((a) => a.x).filter((v): v is number => v != null);
    const ys = cluster.map((a) => a.y).filter((v): v is number => v != null);
    const outlets = [...new Set(cluster.map((a) => a.source))];
    const labels = cluster.map((a) => a.label).filter(Boolean) as string[];
    const dominantLabel =
      labels.sort((a, b) => labels.filter((l) => l === b).length - labels.filter((l) => l === a).length)[0] ?? "mixed";
    narratives.push({
      narrative: term.charAt(0).toUpperCase() + term.slice(1),
      summary: cluster.slice(0, 3).map((a) => `${a.title} (${a.source})`).join(" · "),
      leanX: xs.length ? Math.round((xs.reduce((s, v) => s + v, 0) / xs.length) * 10) / 10 : null,
      leanY: ys.length ? Math.round((ys.reduce((s, v) => s + v, 0) / ys.length) * 10) / 10 : null,
      label: dominantLabel,
      outlets,
      count: cluster.length
    });
  }

  await sql`delete from media_narratives`;
  for (const n of narratives) {
    await sql`
      insert into media_narratives (narrative, summary, lean_x, lean_y, factual_label, outlets, article_count)
      values (${n.narrative}, ${n.summary}, ${n.leanX}, ${n.leanY}, ${n.label}, ${n.outlets}, ${n.count})
    `;
  }
  return { narratives: narratives.length };
}

/** One pass over the media pipeline, for the worker loop. */
export async function refreshMediaLens(sql: Sql) {
  const assessed = await assessAndLinkNews(sql);
  const reliability = await computeMediaReliability(sql);
  const narratives = await extractNarratives(sql);
  return { ...assessed, ...reliability, ...narratives };
}

/** Payload for the redesigned media-influence view. */
export async function mediaInfluence(sql: Sql) {
  const outlets = await sql`
    with latest as (
      select distinct on (subject_id) subject_id,
             (output->>'x')::float as x, (output->>'y')::float as y
      from ai_analyses where subject_type='news_item' and kind='compass' and output->>'x' is not null
      order by subject_id, id desc
    )
    select s.name,
           round(avg(l.x)::numeric, 2)::float as x,
           round(avg(l.y)::numeric, 2)::float as y,
           count(*)::int as sample,
           s.factual_reliability::float as reliability,
           s.reliability_sample
    from latest l
    join news_items n on n.id = (l.subject_id)::int
    join news_sources s on s.id = n.source_id
    group by s.name, s.factual_reliability, s.reliability_sample
    having count(*) >= 1
    order by count(*) desc
  `;
  const [overall] = await sql`
    with latest as (
      select distinct on (subject_id) subject_id,
             (output->>'x')::float as x, (output->>'y')::float as y
      from ai_analyses where subject_type='news_item' and kind='compass' and output->>'x' is not null
      order by subject_id, id desc
    )
    select round(avg(x)::numeric,2)::float as x, round(avg(y)::numeric,2)::float as y, count(*)::int as sample from latest
  `;
  const narratives = await sql`
    select narrative, summary, lean_x::float as x, lean_y::float as y, factual_label, outlets, article_count
    from media_narratives order by article_count desc
  `;
  const [counts] = await sql`
    select count(*)::int as articles,
           count(*) filter (where factual_label = 'well-corroborated')::int as corroborated,
           count(*) filter (where factual_label = 'single-source')::int as single_source,
           count(*) filter (where factual_label = 'contested')::int as contested,
           round(avg(sensational)::numeric, 2)::float as avg_sensational
    from news_assessments
  `;

  return {
    overall: overall && (overall.sample as number) > 0 ? { x: overall.x, y: overall.y, sample: overall.sample } : null,
    outlets: outlets.map((o) => ({
      name: o.name as string,
      x: o.x as number,
      y: o.y as number,
      sample: o.sample as number,
      reliability: o.reliability as number | null,
      reliabilitySample: o.reliability_sample as number
    })),
    narratives: narratives.map((n) => ({
      narrative: n.narrative as string,
      summary: n.summary as string,
      lean: n.x != null && n.y != null ? { x: n.x as number, y: n.y as number } : null,
      factualLabel: n.factual_label as string | null,
      outlets: (n.outlets as string[]) ?? [],
      articleCount: n.article_count as number
    })),
    counts: counts ?? { articles: 0, corroborated: 0, single_source: 0, contested: 0, avg_sensational: 0 },
    note: "Reliability is corroboration-led (how many independent outlets ran it) plus the outlet's track record — never a hand-assigned trust list. Contested and single-source stories are flagged, not hidden."
  };
}

type NewsRow = {
  id: number;
  title: string;
  url: string;
  source: string | null;
  published_at: string | null;
  x: number | null;
  y: number | null;
  bias: number | null;
  factual_label: string | null;
  factual_score: number | null;
  corroborating_outlets: number | null;
};

function shapeNews(rows: readonly NewsRow[]) {
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    url: r.url,
    source: r.source ?? "Unknown source",
    publishedAt: r.published_at,
    compass: r.x != null && r.y != null ? { x: r.x, y: r.y } : null,
    bias: r.bias,
    factualLabel: r.factual_label,
    factualScore: r.factual_score,
    corroboratingOutlets: r.corroborating_outlets ?? 0
  }));
}

/** Recent news mentioning an MP, with lean + factual reliability. */
export async function newsForMember(sql: Sql, memberId: number, limit = 12) {
  const rows = await sql`
    select n.id, n.title, n.url, n.published_at, s.name as source,
           (select (a.output->>'x')::float from ai_analyses a where a.subject_type='news_item' and a.kind='compass' and a.subject_id=n.id::text order by a.id desc limit 1) as x,
           (select (a.output->>'y')::float from ai_analyses a where a.subject_type='news_item' and a.kind='compass' and a.subject_id=n.id::text order by a.id desc limit 1) as y,
           na.bias, na.factual_label, na.factual_score, na.corroborating_outlets
    from news_member_links l
    join news_items n on n.id = l.news_item_id
    left join news_sources s on s.id = n.source_id
    left join news_assessments na on na.news_item_id = n.id
    where l.member_id = ${memberId}
    order by n.published_at desc nulls last limit ${limit}
  `;
  return shapeNews(rows as unknown as NewsRow[]);
}

/** Recent news mentioning a party. */
export async function newsForParty(sql: Sql, partyId: number, limit = 14) {
  const rows = await sql`
    select n.id, n.title, n.url, n.published_at, s.name as source,
           (select (a.output->>'x')::float from ai_analyses a where a.subject_type='news_item' and a.kind='compass' and a.subject_id=n.id::text order by a.id desc limit 1) as x,
           (select (a.output->>'y')::float from ai_analyses a where a.subject_type='news_item' and a.kind='compass' and a.subject_id=n.id::text order by a.id desc limit 1) as y,
           na.bias, na.factual_label, na.factual_score, na.corroborating_outlets
    from news_party_links l
    join news_items n on n.id = l.news_item_id
    left join news_sources s on s.id = n.source_id
    left join news_assessments na on na.news_item_id = n.id
    where l.party_id = ${partyId}
    order by n.published_at desc nulls last limit ${limit}
  `;
  return shapeNews(rows as unknown as NewsRow[]);
}
