import type { Sql } from "postgres";
import { analyzeAndStore } from "./ai.js";

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
  AttributedTo: string | null;
  Value: string | null;
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
  let contributions = 0;
  for (const item of debate.Items ?? []) {
    if (item.ItemType !== "Contribution" || !item.Value) continue;
    const text = stripHtml(item.Value);
    if (text.length < 8) continue;
    contributions += 1;
    const speaker = item.AttributedTo ? stripHtml(item.AttributedTo) : "";
    if (speaker) speakers.add(speaker);
    lines.push(speaker ? `${speaker}: ${text}` : text);
  }
  return {
    text: lines.join("\n").slice(0, MAX_STORED_CHARS),
    contributions,
    speakers: speakers.size
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
        select id from bill_debates where ext_id = ${result.DebateSectionExtId}
      `;
      if (existing) continue;
      try {
        const transcript = await fetchDebateTranscript(result.DebateSectionExtId);
        if (!transcript || transcript.contributions === 0) continue;
        await sql`
          insert into bill_debates
            (bill_id, ext_id, title, house, sitting_date, contributions, speakers, text_content, source_url)
          values (
            ${bill.id}, ${result.DebateSectionExtId}, ${stripHtml(result.Title)},
            ${result.House}, ${result.SittingDate?.slice(0, 10) ?? null},
            ${transcript.contributions}, ${transcript.speakers}, ${transcript.text},
            ${publicDebateUrl(result.House, result.SittingDate ?? "", result.DebateSectionExtId, result.Title)}
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
