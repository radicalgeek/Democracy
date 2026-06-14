import type { Sql } from "postgres";
import { normalizeConstituencyName } from "../lib/names.js";
import { recordImportRun } from "./parliament.js";

/**
 * Public opinion polling ingestion. Two ongoing free sources feed the same
 * tables every worker cycle:
 *  - BritPolls (CC BY 4.0): stable JSON URLs, refreshed weekly. Primary engine.
 *  - Wikipedia (CC BY-SA): the canonical polling archive, for longer history.
 * MRP constituency projections are imported separately via the admin endpoint
 * (no free stable feed exists). Polling is never merged into the civic will —
 * it is a separate, clearly-labelled comparison layer.
 */

const BRITPOLLS_BASE = process.env.POLLING_BASE_URL ?? "https://britpolls.co.uk/data";
const POLLING_ENABLED = (process.env.POLLING_ENABLED ?? "true").toLowerCase() !== "false";
const WIKIPEDIA_ENABLED = (process.env.POLLING_WIKIPEDIA_ENABLED ?? "true").toLowerCase() !== "false";
const WIKIPEDIA_PAGE =
  process.env.POLLING_WIKIPEDIA_PAGE ?? "Opinion polling for the next United Kingdom general election";

/**
 * Canonical party set. `field` is the BritPolls JSON key; `match` keywords map
 * a party to its revealed-preference compass position (by Parliament party
 * name) for the support-weighted national-compass vector.
 */
export const POLL_PARTIES: Array<{
  code: string;
  label: string;
  field: string;
  colour: string;
  abbr: string;
  match: string[];
}> = [
  { code: "lab", label: "Labour", field: "labour", colour: "E4003B", abbr: "Lab", match: ["labour"] },
  { code: "con", label: "Conservatives", field: "conservatives", colour: "0087DC", abbr: "Con", match: ["conservative"] },
  { code: "ref", label: "Reform UK", field: "reform_uk", colour: "12B6CF", abbr: "Ref", match: ["reform"] },
  { code: "ld", label: "Liberal Democrats", field: "lib_dems", colour: "FAA61A", abbr: "LD", match: ["liberal democrat", "lib dem"] },
  { code: "grn", label: "Greens", field: "greens", colour: "528D6B", abbr: "Grn", match: ["green"] },
  { code: "snp", label: "SNP", field: "snp", colour: "FDF023", abbr: "SNP", match: ["scottish national", "snp"] },
  { code: "oth", label: "Others", field: "others", colour: "9aa6ad", abbr: "Others", match: [] }
];

const PARTY_BY_CODE = new Map(POLL_PARTIES.map((party) => [party.code, party]));

export function pollPartyByCode(code: string) {
  return PARTY_BY_CODE.get(code) ?? null;
}

/** Map a free-text party name (poll/MRP source) onto our canonical code. */
export function matchPartyCode(name: string): string | null {
  const lower = name.toLowerCase().trim();
  if (!lower) return null;
  for (const party of POLL_PARTIES) {
    if (party.code === "oth") continue;
    if (party.match.some((keyword) => lower.includes(keyword))) return party.code;
  }
  return null;
}

function num(value: unknown): number | null {
  const parsed = typeof value === "string" ? Number(value.replace(/[^0-9.+-]/g, "")) : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

async function fetchJson<T>(url: string, extraHeaders?: Record<string, string>): Promise<T | null> {
  try {
    const response = await fetch(url, {
      headers: { accept: "application/json", ...extraHeaders }
    });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

// Wikimedia requires a descriptive User-Agent; without it the API serves HTML.
const WIKI_HEADERS = {
  "user-agent": "DemocracyCivicApp/1.0 (https://test.radicalgeek.co.uk; civic polling backfill)"
};

type PollingSource = {
  id: string;
  name: string;
  url: string;
  licence: string;
  refreshCadence: string;
  newcomerExplanation: string;
  caveats: string;
};

const POLLING_SOURCES: PollingSource[] = [
  {
    id: "britpolls",
    name: "BritPolls poll archive",
    url: "https://britpolls.co.uk",
    licence: "CC BY 4.0",
    refreshCadence: "weekly",
    newcomerExplanation:
      "A free archive of British voting-intention polls — the regular surveys asking who people would vote for if there were an election tomorrow. We average the most recent ones into a 'poll of polls'.",
    caveats:
      "A poll is a sample of ~1,000–2,000 people, not a vote — it carries a margin of error (~3 points) and pollsters differ in method (house effects). Treat it as a snapshot of mood, not a result."
  },
  {
    id: "wikipedia-polling",
    name: "Wikipedia opinion-polling archive",
    url: `https://en.wikipedia.org/wiki/${encodeURIComponent(WIKIPEDIA_PAGE)}`,
    licence: "CC BY-SA 4.0",
    refreshCadence: "continuous",
    newcomerExplanation:
      "Wikipedia's community-maintained table of every published Westminster voting-intention poll, used here to extend the polling trend further back in time.",
    caveats:
      "Community-maintained; the same margin-of-error and house-effect caveats apply as for any poll. Cross-checked against the primary archive where both cover a poll."
  },
  {
    id: "mrp-projections",
    name: "MRP constituency projections",
    url: "https://en.wikipedia.org/wiki/Multilevel_regression_with_poststratification",
    licence: "per-publisher (attribution)",
    refreshCadence: "episodic",
    newcomerExplanation:
      "MRP is a modelling technique that turns one big national poll into a projected result for every individual seat. Pollsters like Survation, More in Common and YouGov publish these before elections.",
    caveats:
      "These are MODELLED estimates, not votes or results — accuracy varies by seat and they are released only occasionally. Always shown with the source and release date."
  }
];

async function registerPollingSources(sql: Sql) {
  for (const source of POLLING_SOURCES) {
    await sql`
      insert into source_registry (
        id, name, category, scope, owner, url, licence, official_status,
        refresh_cadence, newcomer_explanation, compass_score_potential,
        aggregate_view_potential, caveats, metadata, updated_at
      )
      values (
        ${source.id}, ${source.name}, 'polling', 'national',
        ${source.id === "wikipedia-polling" ? "Wikipedia contributors" : source.name},
        ${source.url}, ${source.licence}, 'independent', ${source.refreshCadence},
        ${source.newcomerExplanation},
        'Voting-intention support is weighted onto each party''s revealed compass position to plot a derived national mood point.',
        'Poll-of-polls trend over time, per-pollster spread, leader approval, and MRP seat projections on the map.',
        ${source.caveats}, '{}'::jsonb, now()
      )
      on conflict (id) do update set
        name = excluded.name, category = excluded.category, scope = excluded.scope,
        owner = excluded.owner, url = excluded.url, licence = excluded.licence,
        official_status = excluded.official_status, refresh_cadence = excluded.refresh_cadence,
        newcomer_explanation = excluded.newcomer_explanation,
        compass_score_potential = excluded.compass_score_potential,
        aggregate_view_potential = excluded.aggregate_view_potential,
        caveats = excluded.caveats, updated_at = now()
    `;
  }
}

async function upsertPoll(
  sql: Sql,
  poll: {
    source: string;
    pollster: string;
    fieldworkEnd: string;
    sampleSize: number | null;
    method: string | null;
    scope: string;
    isPollOfPolls: boolean;
    sourceUrl: string;
  },
  results: Array<{ code: string; label: string; percent: number }>
) {
  const [row] = await sql`
    insert into polls (source, pollster, fieldwork_end, sample_size, method, scope, is_poll_of_polls, source_url, fetched_at)
    values (
      ${poll.source}, ${poll.pollster}, ${poll.fieldworkEnd}, ${poll.sampleSize},
      ${poll.method}, ${poll.scope}, ${poll.isPollOfPolls}, ${poll.sourceUrl}, now()
    )
    on conflict (pollster, fieldwork_end, scope) do update set
      sample_size = coalesce(excluded.sample_size, polls.sample_size),
      method = coalesce(excluded.method, polls.method),
      source = excluded.source, fetched_at = now()
    returning id
  `;
  for (const result of results) {
    if (!Number.isFinite(result.percent)) continue;
    await sql`
      insert into poll_results (poll_id, party_code, party_label, percent)
      values (${row.id}, ${result.code}, ${result.label}, ${result.percent})
      on conflict (poll_id, party_code) do update set
        percent = excluded.percent, party_label = excluded.party_label
    `;
  }
  return row.id as number;
}

type VIArchive = { updated?: string; polls?: Array<Record<string, unknown>> };

async function importVotingIntention(sql: Sql) {
  const data = await fetchJson<VIArchive>(`${BRITPOLLS_BASE}/voting-intention.json`);
  if (!data?.polls?.length) return { fetched: 0, ingested: 0 };
  let ingested = 0;
  for (const raw of data.polls) {
    const pollster = String(raw.pollster ?? "").trim();
    const date = String(raw.date ?? "").slice(0, 10);
    if (!pollster || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    const results = POLL_PARTIES.map((party) => ({
      code: party.code,
      label: party.label,
      percent: num(raw[party.field]) ?? NaN
    })).filter((result) => Number.isFinite(result.percent));
    if (results.length === 0) continue;
    await upsertPoll(
      sql,
      {
        source: "britpolls",
        pollster,
        fieldworkEnd: date,
        sampleSize: num(raw.sample),
        method: "standard",
        scope: "GB",
        isPollOfPolls: false,
        sourceUrl: "https://britpolls.co.uk"
      },
      results
    );
    ingested += 1;
  }
  return { fetched: data.polls.length, ingested };
}

type CurrentVI = { updated?: string; source?: string } & Record<string, unknown>;

async function importPollOfPolls(sql: Sql) {
  const data = await fetchJson<CurrentVI>(`${BRITPOLLS_BASE}/current-vi.json`);
  if (!data) return { fetched: 0 };
  const date = String(data.updated ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { fetched: 0 };
  const results = POLL_PARTIES.map((party) => ({
    code: party.code,
    label: party.label,
    percent: num(data[party.field]) ?? NaN
  })).filter((result) => Number.isFinite(result.percent));
  if (results.length === 0) return { fetched: 0 };
  await upsertPoll(
    sql,
    {
      source: "britpolls",
      pollster: "Poll of polls",
      fieldworkEnd: date,
      sampleSize: null,
      method: String(data.source ?? "poll-of-polls"),
      scope: "GB",
      isPollOfPolls: true,
      sourceUrl: "https://britpolls.co.uk"
    },
    results
  );
  return { fetched: 1, date };
}

type LeaderApprovalDoc =
  | { updated?: string; leaders?: Array<Record<string, unknown>> }
  | Array<Record<string, unknown>>;

async function importLeaderApproval(sql: Sql) {
  const data = await fetchJson<LeaderApprovalDoc>(`${BRITPOLLS_BASE}/leader-approval.json`);
  const list = Array.isArray(data) ? data : (data?.leaders ?? []);
  if (!list.length) return { fetched: 0 };
  const asOf = (
    (!Array.isArray(data) && data?.updated ? String(data.updated) : new Date().toISOString())
  ).slice(0, 10);
  let ingested = 0;
  for (const raw of list) {
    const leader = String(raw.leader ?? raw.name ?? "").trim();
    if (!leader) continue;
    const approve = num(raw.approve);
    const disapprove = num(raw.disapprove);
    const net =
      raw.net != null ? num(raw.net) : approve != null && disapprove != null ? approve - disapprove : null;
    await sql`
      insert into leader_approval (leader, party_code, approve, disapprove, net, as_of, source, source_url, fetched_at)
      values (
        ${leader}, ${matchPartyCode(String(raw.party ?? ""))}, ${approve}, ${disapprove}, ${net},
        ${asOf}, 'britpolls', 'https://britpolls.co.uk', now()
      )
      on conflict (leader, as_of, source) do update set
        approve = excluded.approve, disapprove = excluded.disapprove, net = excluded.net,
        party_code = excluded.party_code, fetched_at = now()
    `;
    ingested += 1;
  }
  return { fetched: list.length, ingested };
}

/**
 * Wikipedia backfill. Pulls the rendered polling table via the MediaWiki parse
 * API and extracts rows where a date, pollster and party percentages can be
 * read by matching column headers. Best-effort and defensive: it only inserts
 * rows it can confidently parse and never deletes existing data, so a layout
 * change degrades to "no new rows" rather than corrupting the archive.
 */
async function importWikipediaPolls(sql: Sql) {
  if (!WIKIPEDIA_ENABLED) return { skipped: true };
  const api = `https://en.wikipedia.org/w/api.php?action=parse&prop=text&format=json&formatversion=2&page=${encodeURIComponent(
    WIKIPEDIA_PAGE
  )}`;
  const doc = await fetchJson<{ parse?: { text?: string } }>(api, WIKI_HEADERS);
  const html = doc?.parse?.text;
  if (!html) return { fetched: 0, ingested: 0 };

  let ingested = 0;
  let fetched = 0;
  let currentYear: string | null = null;
  let inNational = false;

  // National VI tables on this page omit the year from each row — it lives in
  // the "2026"/"2025"/"2024" section heading above the table. Walk headings and
  // tables in document order, tracking the current year and whether we are
  // still inside the "National poll results" section (sub-national, seat
  // projections and hypotheticals are skipped: different scope or shape).
  const tokenRe = /<(h[234])[^>]*>([\s\S]*?)<\/\1>|<table[\s\S]*?<\/table>/gi;
  let token: RegExpExecArray | null;
  while ((token = tokenRe.exec(html))) {
    if (token[1]) {
      const heading = stripHtml(token[2]);
      if (/^\d{4}$/.test(heading)) currentYear = heading;
      else if (/national poll results/i.test(heading)) inNational = true;
      else if (/seat projection|sub-national|individual constituency|hypothetical/i.test(heading)) {
        inNational = false;
      }
      continue;
    }
    if (!inNational || !currentYear) continue;
    const table = token[0];

    const headerCells = (table.match(/<th[\s\S]*?<\/th>/gi) ?? []).map(stripHtml);
    const partyColumns = POLL_PARTIES.filter((party) => party.code !== "oth")
      .map((party) => ({
        party,
        col: headerCells.findIndex((cell) => {
          const lower = cell.toLowerCase();
          return lower === party.abbr.toLowerCase() || party.match.some((keyword) => lower.includes(keyword));
        })
      }))
      .filter((entry) => entry.col >= 0);
    if (partyColumns.length < 3) continue; // not a VI table

    const rows = table.match(/<tr[\s\S]*?<\/tr>/gi) ?? [];
    for (const rowHtml of rows) {
      const cells = (rowHtml.match(/<t[dh][\s\S]*?<\/t[dh]>/gi) ?? []).map(stripHtml);
      if (cells.length < 4) continue;
      const date = parseWikiDate(cells[0], currentYear) ?? parseWikiDate(cells[1], currentYear);
      const pollster = cleanPollster(cells[1]) || cleanPollster(cells[0]);
      if (!date || !pollster) continue;
      const results = partyColumns
        .map(({ party, col }) => ({ code: party.code, label: party.label, percent: num(cells[col]) ?? NaN }))
        .filter((result) => Number.isFinite(result.percent) && result.percent >= 0 && result.percent <= 100);
      if (results.length < 3) continue;
      fetched += 1;
      try {
        await upsertPoll(
          sql,
          {
            source: "wikipedia",
            pollster,
            fieldworkEnd: date,
            sampleSize: num(cells[4]),
            method: "standard",
            scope: "GB",
            isPollOfPolls: false,
            sourceUrl: `https://en.wikipedia.org/wiki/${encodeURIComponent(WIKIPEDIA_PAGE)}`
          },
          results
        );
        ingested += 1;
      } catch {
        // skip a row we can't store (e.g. unparseable date); keep going
      }
    }
  }
  return { fetched, ingested };
}

function decodeEntities(value: string) {
  return value
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&nbsp;/g, " ")
    .replace(/&ndash;/g, "–")
    .replace(/&amp;/g, "&");
}

function stripHtml(value: string) {
  return decodeEntities(value.replace(/<[^>]+>/g, " "))
    .replace(/\[[^\]]*\]/g, "") // footnote markers like [12]
    .replace(/\s+/g, " ")
    .trim();
}

function cleanPollster(value: string) {
  const cleaned = value.replace(/\/.*$/, "").replace(/[^A-Za-z0-9 &'-]/g, " ").replace(/\s+/g, " ").trim();
  // A pollster cell shouldn't look like a date or a bare number.
  if (!cleaned || /^\d/.test(cleaned) || cleaned.length < 3) return "";
  return cleaned;
}

const MONTHS: Record<string, string> = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12"
};

/**
 * Parse Wikipedia date cells, which carry no year on this page (it comes from
 * the section heading). Forms: "6–7 Apr", "31 May – 7 Jun", "27 May",
 * "7 April 2026". Returns the END date of the fieldwork range.
 */
function parseWikiDate(value: string, fallbackYear: string | null): string | null {
  const text = decodeEntities(value).replace(/&ndash;|&#8211;/g, "–").replace(/\s+/g, " ").trim();
  const monthOf = (segment: string) => {
    const match = segment.match(/([A-Za-z]{3,})/);
    return match ? MONTHS[match[1].slice(0, 3).toLowerCase()] : null;
  };
  const parts = text.split("–");
  const end = parts[parts.length - 1].trim();
  const dayMatch = end.match(/\b(\d{1,2})\b/);
  if (!dayMatch) return null;
  const day = dayMatch[1].padStart(2, "0");
  const month = monthOf(end) ?? monthOf(text);
  if (!month) return null;
  const year = (end.match(/(\d{4})/) ?? text.match(/(\d{4})/))?.[1] ?? fallbackYear;
  if (!year) return null;
  return `${year}-${month}-${day}`;
}

/** Full polling ingest, wired into the worker's runFullImport cycle. */
export async function importPolling(sql: Sql) {
  if (!POLLING_ENABLED) return { skipped: true };
  return recordImportRun(sql, "polling", async () => {
    await registerPollingSources(sql);
    const votingIntention = await importVotingIntention(sql);
    const pollOfPolls = await importPollOfPolls(sql);
    const leaderApproval = await importLeaderApproval(sql);
    const wikipedia = await importWikipediaPolls(sql);
    return { votingIntention, pollOfPolls, leaderApproval, wikipedia };
  });
}

type MrpRow = { constituency: string; winner?: string; parties?: Record<string, number | string> };

/**
 * Import a published MRP into mrp_estimates. Accepts a normalized payload:
 *   { source, releasedOn, rows: [{ constituency, winner?, parties: { lab: 41, con: 22, ... } }] }
 * Constituency names are matched to current records the same way the SVG seat
 * bindings are; unmatched rows are still stored (match_status = 'unmatched').
 */
export async function importMrp(
  sql: Sql,
  payload: { source: string; releasedOn: string; rows: MrpRow[] }
) {
  const source = String(payload.source ?? "").trim();
  const releasedOn = String(payload.releasedOn ?? "").slice(0, 10);
  if (!source || !/^\d{4}-\d{2}-\d{2}$/.test(releasedOn)) {
    throw new Error("importMrp requires { source, releasedOn: YYYY-MM-DD, rows[] }");
  }
  if (!Array.isArray(payload.rows) || payload.rows.length === 0) {
    throw new Error("importMrp requires a non-empty rows array");
  }

  return recordImportRun(sql, `mrp:${source}`, async () => {
    await registerPollingSources(sql);
    const constituencies = await sql`
      select id, name, normalized_name from constituencies
      where end_date is null or end_date > now()
    `;
    const byNormalized = new Map<string, number>();
    for (const row of constituencies) {
      byNormalized.set(row.normalized_name as string, row.id as number);
      byNormalized.set(normalizeConstituencyName(row.name as string), row.id as number);
    }

    let matched = 0;
    let unmatched = 0;
    let inserted = 0;

    for (const row of payload.rows) {
      const name = String(row.constituency ?? "").trim();
      if (!name) continue;
      const constituencyId = byNormalized.get(normalizeConstituencyName(name)) ?? null;
      if (constituencyId) matched += 1;
      else unmatched += 1;

      const entries = Object.entries(row.parties ?? {})
        .map(([key, value]) => ({ code: matchPartyCode(key) ?? key.toLowerCase(), percent: num(value) }))
        .filter((entry) => entry.percent != null) as Array<{ code: string; percent: number }>;
      if (entries.length === 0) continue;

      const winnerCode = row.winner
        ? matchPartyCode(String(row.winner)) ?? String(row.winner).toLowerCase()
        : entries.reduce((best, entry) => (entry.percent > best.percent ? entry : best)).code;

      for (const entry of entries) {
        const party = pollPartyByCode(entry.code);
        await sql`
          insert into mrp_estimates (
            constituency_id, constituency_name, source, released_on, party_code, party_label,
            percent, projected_winner, match_status, fetched_at
          )
          values (
            ${constituencyId}, ${name}, ${source}, ${releasedOn}, ${entry.code},
            ${party?.label ?? entry.code.toUpperCase()}, ${entry.percent},
            ${entry.code === winnerCode}, ${constituencyId ? "matched" : "unmatched"}, now()
          )
          on conflict (source, released_on, constituency_name, party_code) do update set
            constituency_id = excluded.constituency_id, percent = excluded.percent,
            party_label = excluded.party_label, projected_winner = excluded.projected_winner,
            match_status = excluded.match_status, fetched_at = now()
        `;
        inserted += 1;
      }
    }

    return { source, releasedOn, rows: payload.rows.length, matched, unmatched, inserted };
  });
}
