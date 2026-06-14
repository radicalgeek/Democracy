import type { Sql } from "postgres";
import { analyzeAndStore } from "./ai.js";
import { memberInterests } from "./interests.js";
import { memberParty } from "./members.js";

/**
 * Parliamentary debate import from the official Hansard API, plus AI
 * summaries of what was actually argued.
 *
 * Flow per bill: search Hansard for debate sections whose title matches the
 * bill's short title, fetch the full contribution list for the most recent
 * sittings, store a cleaned transcript in bill_debates, then generate one
 * 'debate-summary' analysis per bill from the combined transcripts (with
 * Hansard citations).
 */

const HANSARD_API = "https://hansard-api.parliament.uk";
const DEBATES_PER_BILL = 3;
const MAX_STORED_CHARS = 90_000;

type HansardSearchResult = {
  Title: string;
  House: string;
  SittingDate: string;
  DebateSectionExtId: string;
};

type HansardDebateItem = {
  ItemType: string;
  MemberId: number | null;
  AttributedTo: string | null;
  Value: string | null;
};

/** Per-speaker tally for one debate, stored on bill_debates.speaker_breakdown. */
export type SpeakerTally = {
  memberId: number;
  name: string;
  contributions: number;
  words: number;
};

type HansardDebate = {
  Overview: { Title: string; Date: string; House: string };
  Items: HansardDebateItem[];
};

function stripHtml(value: string) {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&rsquo;|&lsquo;/g, "'")
    .replace(/&ldquo;|&rdquo;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * The presiding officer (Speaker, Deputy Speaker, Lords Chairman) contributes a
 * lot — calling members, reading procedure — but that's chairing, not debating.
 * Excluding them keeps "who took up the floor" about actual participants.
 */
function isPresidingOfficer(name: string) {
  return /\bspeaker\b|chairman of committees|the chairman|temporary chair|the deputy chairman/i.test(
    name
  );
}

/** Bill titles in Hansard often differ only by smart quotes and whitespace. */
function normalizeTitle(value: string) {
  return value.replace(/[’‘]/g, "'").replace(/\s+/g, " ").trim().toLowerCase();
}

function publicDebateUrl(house: string, sittingDate: string, extId: string, title: string) {
  const date = sittingDate.slice(0, 10);
  const slug = title.replace(/[^a-zA-Z0-9]+/g, "").slice(0, 60) || "Debate";
  return `https://hansard.parliament.uk/${house}/${date}/debates/${extId}/${slug}`;
}

async function searchDebates(billTitle: string): Promise<HansardSearchResult[]> {
  const url = `${HANSARD_API}/search/debates.json?queryParameters.searchTerm=${encodeURIComponent(billTitle)}`;
  const response = await fetch(url, { headers: { accept: "application/json" } });
  if (!response.ok) return [];
  const payload = (await response.json()) as { Results?: HansardSearchResult[] };
  const wanted = normalizeTitle(billTitle);
  return (payload.Results ?? [])
    .filter((result) => normalizeTitle(result.Title) === wanted)
    .sort((a, b) => (b.SittingDate ?? "").localeCompare(a.SittingDate ?? ""))
    .slice(0, DEBATES_PER_BILL);
}

async function fetchDebateTranscript(extId: string) {
  const response = await fetch(`${HANSARD_API}/debates/debate/${extId}.json`, {
    headers: { accept: "application/json" }
  });
  if (!response.ok) return null;
  const debate = (await response.json()) as HansardDebate;
  const lines: string[] = [];
  const speakers = new Set<string>();
  const byMember = new Map<number, SpeakerTally>();
  let contributions = 0;
  for (const item of debate.Items ?? []) {
    if (item.ItemType !== "Contribution" || !item.Value) continue;
    const text = stripHtml(item.Value);
    if (text.length < 8) continue;
    contributions += 1;
    const speaker = item.AttributedTo ? stripHtml(item.AttributedTo) : "";
    if (speaker) speakers.add(speaker);
    lines.push(speaker ? `${speaker}: ${text}` : text);
    // Attribute words to the member so we can show who took up the floor.
    // Items without a MemberId are procedural (column headers, divisions);
    // the presiding officer's contributions are chairing, not debating.
    if (item.MemberId && !isPresidingOfficer(speaker)) {
      const words = text.split(/\s+/).filter(Boolean).length;
      const entry =
        byMember.get(item.MemberId) ??
        { memberId: item.MemberId, name: speaker, contributions: 0, words: 0 };
      entry.contributions += 1;
      entry.words += words;
      if (!entry.name && speaker) entry.name = speaker;
      byMember.set(item.MemberId, entry);
    }
  }
  const breakdown = [...byMember.values()].sort((a, b) => b.words - a.words);
  return {
    text: lines.join("\n").slice(0, MAX_STORED_CHARS),
    contributions,
    speakers: speakers.size,
    breakdown
  };
}

/** Bills worth importing debates for: division-linked first, then text-rich. */
async function debateCandidates(sql: Sql, limit: number) {
  return sql`
    select b.id, b.short_title from bills b
    order by exists (select 1 from divisions d where d.bill_id = b.id) desc,
             exists (select 1 from bill_texts t where t.bill_id = b.id and t.text_content is not null) desc,
             b.last_updated desc nulls last
    limit ${limit}
  `;
}

export async function importBillDebates(sql: Sql, limitBills = 12) {
  const bills = await debateCandidates(sql, limitBills);
  let imported = 0;
  let billsWithDebates = 0;

  for (const bill of bills) {
    let results: HansardSearchResult[] = [];
    try {
      results = await searchDebates(bill.short_title as string);
    } catch {
      continue; // Hansard search down — try the next bill, import is periodic
    }
    if (results.length > 0) billsWithDebates += 1;

    for (const result of results) {
      const [existing] = await sql`
        select id, speaker_breakdown from bill_debates where ext_id = ${result.DebateSectionExtId}
      `;
      // Already imported with a speaker breakdown — nothing to do.
      if (existing && existing.speaker_breakdown) continue;
      try {
        const transcript = await fetchDebateTranscript(result.DebateSectionExtId);
        if (!transcript || transcript.contributions === 0) continue;
        if (existing) {
          // Backfill the breakdown onto a row imported before this feature.
          await sql`
            update bill_debates
            set speaker_breakdown = ${sql.json(transcript.breakdown as never)}
            where id = ${existing.id}
          `;
          continue;
        }
        await sql`
          insert into bill_debates
            (bill_id, ext_id, title, house, sitting_date, contributions, speakers, text_content, source_url, speaker_breakdown)
          values (
            ${bill.id}, ${result.DebateSectionExtId}, ${stripHtml(result.Title)},
            ${result.House}, ${result.SittingDate?.slice(0, 10) ?? null},
            ${transcript.contributions}, ${transcript.speakers}, ${transcript.text},
            ${publicDebateUrl(result.House, result.SittingDate ?? "", result.DebateSectionExtId, result.Title)},
            ${sql.json(transcript.breakdown as never)}
          )
          on conflict (ext_id) do nothing
        `;
        imported += 1;
      } catch {
        // single debate fetch failed; carry on
      }
    }
  }
  return { billsChecked: bills.length, billsWithDebates, debatesImported: imported };
}

/**
 * One 'debate-summary' analysis per bill with stored debates. analyzeAndStore
 * dedupes on source hash, so unchanged transcripts cost nothing on re-run.
 */
export async function analyzeBillDebates(sql: Sql, limitBills = 12) {
  const bills = await sql`
    select distinct bd.bill_id as id from bill_debates bd
    order by bd.bill_id desc
    limit ${limitBills}
  `;
  let generated = 0;
  for (const bill of bills) {
    const debates = await sql`
      select title, house, sitting_date, text_content, source_url from bill_debates
      where bill_id = ${bill.id} and text_content is not null
      order by sitting_date desc nulls last
      limit ${DEBATES_PER_BILL}
    `;
    if (debates.length === 0) continue;

    // Short bracketed headers: under the heuristic fallback's sentence-length
    // floor, so they never leak into extractive summaries.
    const sittingDay = (value: unknown) =>
      value ? new Date(value as string).toISOString().slice(0, 10) : "date unknown";
    const combined = debates
      .map((debate) => `[${debate.house}, ${sittingDay(debate.sitting_date)}]\n${debate.text_content}`)
      .join("\n\n");
    const citations = debates.map((debate) => ({
      label: `${debate.house} debate · ${sittingDay(debate.sitting_date)}`,
      url: debate.source_url as string
    }));

    const result = await analyzeAndStore(sql, {
      subjectType: "bill",
      subjectId: String(bill.id),
      kind: "debate-summary",
      text: combined,
      citations
    });
    if (!result.reused) generated += 1;
  }
  return { billsAnalyzed: bills.length, generated };
}

export type EnrichedSpeaker = SpeakerTally & {
  party: string | null;
  partyAbbreviation: string | null;
  partyColour: string | null;
  constituency: string | null;
  /** "Commons" | "Lords" where known (peers come from the party cache). */
  house: string | null;
  /** Revealed-preference compass; for peers it's their party's position. */
  compass: { x: number; y: number; sample: number } | null;
  /** True when `compass` is the party's average, not the member's own votes. */
  compassFromParty: boolean;
  /** Registered financial interests count, if the cache is warm. */
  interestsTotal: number | null;
  registerUrl: string;
};

/**
 * Enrich each debate's speaker tally with the data we already hold elsewhere:
 * party, the revealed-preference compass (same derivation as the Representatives
 * page — how the member voted on AI-scored bills), and a registered-interests
 * count. One set of bounded lookups for all speakers across the bill's debates.
 */
export async function enrichDebateSpeakers(
  sql: Sql,
  breakdowns: SpeakerTally[][]
): Promise<EnrichedSpeaker[][]> {
  const ids = [...new Set(breakdowns.flat().map((s) => s.memberId).filter(Boolean))];
  if (ids.length === 0) return breakdowns.map(() => []);

  const compassRows = await sql`
    with scored as (
      select distinct on (a.subject_id) (a.subject_id)::int as bill_id,
             (a.output->>'x')::float as x, (a.output->>'y')::float as y
      from ai_analyses a
      where a.subject_type = 'bill' and a.kind = 'compass' and a.output->>'x' is not null
      order by a.subject_id, a.id desc
    )
    select dv.member_id,
           round(avg((case when dv.vote = 'aye' then 1 else -1 end) * s.x)::numeric, 2)::float as x,
           round(avg((case when dv.vote = 'aye' then 1 else -1 end) * s.y)::numeric, 2)::float as y,
           count(*)::int as sample
    from division_votes dv
    join divisions d on d.id = dv.division_id
    join scored s on s.bill_id = d.bill_id
    where dv.member_id in ${sql(ids)}
    group by dv.member_id
  `;
  const compass = new Map<number, { x: number; y: number; sample: number }>();
  for (const row of compassRows) {
    compass.set(row.member_id as number, {
      x: row.x as number,
      y: row.y as number,
      sample: row.sample as number
    });
  }

  const metaRows = await sql`
    select r.id, p.name as party, p.abbreviation as party_abbreviation,
           p.background_colour as party_colour, c.name as constituency
    from representatives r
    left join parties p on p.id = r.party_id
    left join constituencies c on c.id = r.constituency_id
    where r.id in ${sql(ids)}
  `;
  const meta = new Map<number, (typeof metaRows)[number]>();
  for (const row of metaRows) meta.set(row.id as number, row);

  // Peers aren't in representatives — fall back to the party cache for party + House.
  const peerRows = await sql`
    select member_id, party_name, party_abbreviation, party_colour, house
    from member_party_cache where member_id in ${sql(ids)}
  `;
  const peers = new Map<number, (typeof peerRows)[number]>();
  for (const row of peerRows) peers.set(row.member_id as number, row);

  // Party-average compass (revealed preference), keyed by party name, so peers
  // without their own division record still get a party-derived position.
  const partyCompassRows = await sql`
    with scored as (
      select distinct on (a.subject_id) (a.subject_id)::int as bill_id,
             (a.output->>'x')::float as x, (a.output->>'y')::float as y
      from ai_analyses a
      where a.subject_type = 'bill' and a.kind = 'compass' and a.output->>'x' is not null
      order by a.subject_id, a.id desc
    )
    select p.name as party,
           round(avg((case when dv.vote = 'aye' then 1 else -1 end) * s.x)::numeric, 2)::float as x,
           round(avg((case when dv.vote = 'aye' then 1 else -1 end) * s.y)::numeric, 2)::float as y,
           count(*)::int as sample
    from division_votes dv
    join divisions d on d.id = dv.division_id
    join scored s on s.bill_id = d.bill_id
    join representatives r on r.id = dv.member_id
    join parties p on p.id = r.party_id
    group by p.name
  `;
  const partyCompass = new Map<string, { x: number; y: number; sample: number }>();
  for (const row of partyCompassRows) {
    partyCompass.set(row.party as string, {
      x: row.x as number,
      y: row.y as number,
      sample: row.sample as number
    });
  }

  const interestRows = await sql`
    select member_id, (payload->>'total')::int as total
    from member_interests_cache where member_id in ${sql(ids)}
  `;
  const interests = new Map<number, number>();
  for (const row of interestRows) interests.set(row.member_id as number, row.total as number);

  return breakdowns.map((list) =>
    list.map((speaker) => {
      const m = meta.get(speaker.memberId);
      const peer = peers.get(speaker.memberId);
      const party = (m?.party as string) ?? (peer?.party_name as string) ?? null;
      const own = compass.get(speaker.memberId) ?? null;
      const fromParty = !own && party ? partyCompass.get(party) ?? null : null;
      return {
        ...speaker,
        party,
        partyAbbreviation:
          (m?.party_abbreviation as string) ?? (peer?.party_abbreviation as string) ?? null,
        partyColour: (m?.party_colour as string) ?? (peer?.party_colour as string) ?? null,
        constituency: (m?.constituency as string) ?? null,
        house: (m ? "Commons" : (peer?.house as string)) ?? null,
        compass: own ?? fromParty,
        compassFromParty: !own && !!fromParty,
        interestsTotal: interests.get(speaker.memberId) ?? null,
        registerUrl: `https://members.parliament.uk/member/${speaker.memberId}/registeredinterests`
      };
    })
  );
}

/**
 * Warm member_interests_cache for debate speakers not yet cached, so the bill
 * page can show interest counts without making dozens of live API calls on
 * request. Bounded per run; the cache fills in over import cycles.
 */
export async function warmDebateSpeakerInterests(sql: Sql, limit = 40) {
  const rows = await sql`
    select distinct (s->>'memberId')::int as member_id
    from bill_debates bd,
         jsonb_array_elements(coalesce(bd.speaker_breakdown, '[]'::jsonb)) s
    where s->>'memberId' is not null
      and not exists (
        select 1 from member_interests_cache mic
        where mic.member_id = (s->>'memberId')::int
      )
    limit ${limit}
  `;
  let warmed = 0;
  for (const row of rows) {
    try {
      await memberInterests(sql, row.member_id as number);
      warmed += 1;
    } catch {
      // interests API hiccup for one member — keep going
    }
  }
  return { checked: rows.length, warmed };
}

/**
 * Warm member_party_cache for debate speakers (mostly peers) not in the
 * representatives table, so Lords speakers get a party chip and the right House.
 * Bounded per run; fills in over import cycles.
 */
export async function warmDebateSpeakerParties(sql: Sql, limit = 40) {
  const rows = await sql`
    select distinct (s->>'memberId')::int as member_id
    from bill_debates bd,
         jsonb_array_elements(coalesce(bd.speaker_breakdown, '[]'::jsonb)) s
    where s->>'memberId' is not null
      and not exists (
        select 1 from representatives r where r.id = (s->>'memberId')::int
      )
      and not exists (
        select 1 from member_party_cache mpc where mpc.member_id = (s->>'memberId')::int
      )
    limit ${limit}
  `;
  let warmed = 0;
  for (const row of rows) {
    try {
      await memberParty(sql, row.member_id as number);
      warmed += 1;
    } catch {
      // members API hiccup for one member — keep going
    }
  }
  return { checked: rows.length, warmed };
}
