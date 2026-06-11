import type { Sql } from "postgres";
import { normalizeConstituencyName } from "../lib/names.js";

const BILLS_API = "https://bills-api.parliament.uk/api/v1";
const MEMBERS_API = "https://members-api.parliament.uk/api";

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return (await response.json()) as T;
}

export async function recordImportRun<T>(
  sql: Sql,
  kind: string,
  job: () => Promise<T>
): Promise<T> {
  const [run] = await sql`
    insert into data_import_runs (kind) values (${kind}) returning id
  `;
  try {
    const result = await job();
    await sql`
      update data_import_runs
      set status = 'succeeded', detail = ${sql.json(result as never) ?? "{}"}, finished_at = now()
      where id = ${run.id}
    `;
    return result;
  } catch (error) {
    await sql`
      update data_import_runs
      set status = 'failed',
          detail = ${sql.json({ error: error instanceof Error ? error.message : String(error) })},
          finished_at = now()
      where id = ${run.id}
    `;
    throw error;
  }
}

type ConstituencySearchItem = {
  value: {
    id: number;
    name: string;
    startDate?: string;
    endDate?: string | null;
    currentRepresentation?: {
      member?: {
        value?: {
          id: number;
          nameDisplayAs: string;
          gender?: string;
          thumbnailUrl?: string;
          latestParty?: {
            id: number;
            name: string;
            abbreviation?: string;
            backgroundColour?: string;
          };
        };
      };
    };
  };
};

export async function importConstituenciesAndMembers(sql: Sql) {
  return recordImportRun(sql, "constituencies+members", async () => {
    let skip = 0;
    const take = 20;
    let constituencies = 0;
    let members = 0;

    for (;;) {
      const page = await getJson<{ items?: ConstituencySearchItem[]; totalResults?: number }>(
        `${MEMBERS_API}/Location/Constituency/Search?searchText=&skip=${skip}&take=${take}`
      );
      const items = page.items ?? [];
      if (items.length === 0) break;

      for (const item of items) {
        const constituency = item.value;
        await sql`
          insert into constituencies (id, name, normalized_name, start_date, end_date)
          values (
            ${constituency.id},
            ${constituency.name},
            ${normalizeConstituencyName(constituency.name)},
            ${constituency.startDate ?? null},
            ${constituency.endDate ?? null}
          )
          on conflict (id) do update set
            name = excluded.name,
            normalized_name = excluded.normalized_name,
            end_date = excluded.end_date,
            imported_at = now()
        `;
        constituencies += 1;

        const member = constituency.currentRepresentation?.member?.value;
        if (!member) continue;

        const party = member.latestParty;
        if (party) {
          await sql`
            insert into parties (id, name, abbreviation, background_colour)
            values (${party.id}, ${party.name}, ${party.abbreviation ?? null}, ${party.backgroundColour ?? null})
            on conflict (id) do update set
              name = excluded.name,
              abbreviation = excluded.abbreviation,
              background_colour = excluded.background_colour
          `;
        }

        await sql`
          insert into representatives (id, name, party_id, constituency_id, gender, thumbnail_url)
          values (
            ${member.id},
            ${member.nameDisplayAs},
            ${party?.id ?? null},
            ${constituency.id},
            ${member.gender ?? null},
            ${member.thumbnailUrl ?? null}
          )
          on conflict (id) do update set
            name = excluded.name,
            party_id = excluded.party_id,
            constituency_id = excluded.constituency_id,
            thumbnail_url = excluded.thumbnail_url,
            imported_at = now()
        `;
        members += 1;
      }

      skip += take;
      if (skip > 800) break; // hard stop well past the 650 seats
    }

    return { constituencies, members };
  });
}

type BillsListItem = {
  billId: number;
  shortTitle?: string;
  currentHouse?: string;
  lastUpdate?: string;
  isAct?: boolean;
  isDefeated?: boolean;
  billType?: { name?: string };
  currentStage?: { description?: string };
};

type BillDetail = {
  billId: number;
  shortTitle?: string;
  longTitle?: string;
  summary?: string | null;
};

type BillStage = {
  id: number;
  description?: string;
  house?: string;
  stageSittings?: Array<{ date?: string }>;
};

type BillPublication = {
  id: number;
  title?: string;
  publicationType?: { name?: string };
  links?: Array<{ id: number; title?: string; url?: string; contentType?: string }>;
  files?: Array<{ id: number; filename?: string; contentType?: string }>;
};

export async function importBills(sql: Sql, take = 30, detailCount = 8) {
  return recordImportRun(sql, "bills", async () => {
    const list = await getJson<{ items?: BillsListItem[] }>(
      `${BILLS_API}/Bills?Take=${take}&Skip=0&SortOrder=DateUpdatedDescending`
    );
    const items = list.items ?? [];

    for (const item of items) {
      await sql`
        insert into bills (id, short_title, current_house, current_stage, bill_type, is_act, is_defeated, last_updated, source_url)
        values (
          ${item.billId},
          ${item.shortTitle ?? `Bill ${item.billId}`},
          ${item.currentHouse ?? null},
          ${item.currentStage?.description ?? null},
          ${item.billType?.name ?? null},
          ${item.isAct ?? false},
          ${item.isDefeated ?? false},
          ${item.lastUpdate ?? null},
          ${`https://bills.parliament.uk/bills/${item.billId}`}
        )
        on conflict (id) do update set
          short_title = excluded.short_title,
          current_house = excluded.current_house,
          current_stage = excluded.current_stage,
          bill_type = excluded.bill_type,
          is_act = excluded.is_act,
          is_defeated = excluded.is_defeated,
          last_updated = excluded.last_updated,
          imported_at = now()
      `;
    }

    let detailsFetched = 0;
    for (const item of items.slice(0, detailCount)) {
      try {
        const detail = await getJson<BillDetail>(`${BILLS_API}/Bills/${item.billId}`);
        await sql`
          update bills set long_title = ${detail.longTitle ?? null} where id = ${item.billId}
        `;

        const stages = await getJson<{ items?: BillStage[] }>(
          `${BILLS_API}/Bills/${item.billId}/Stages?Take=40`
        );
        for (const stage of stages.items ?? []) {
          const happenedOn = stage.stageSittings?.[0]?.date?.slice(0, 10) ?? null;
          await sql`
            insert into bill_events (bill_id, stage, house, happened_on, raw)
            values (${item.billId}, ${stage.description ?? null}, ${stage.house ?? null}, ${happenedOn}, ${sql.json(stage as never)})
            on conflict do nothing
          `;
        }
        detailsFetched += 1;
      } catch {
        // individual bill detail failures should not sink the whole import
      }
    }

    return { bills: items.length, detailsFetched };
  });
}

function stripHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

async function extractPdfText(buffer: ArrayBuffer): Promise<string | null> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { text } = await extractText(pdf, { mergePages: true });
  const cleaned = text.replace(/\s+/g, " ").trim();
  return cleaned.length >= 200 ? cleaned.slice(0, 200_000) : null;
}

/** Rank publications: actual bill text first, then explanatory notes, then the rest. */
function publicationPriority(pub: BillPublication) {
  const type = (pub.publicationType?.name ?? "").toLowerCase();
  const title = (pub.title ?? "").toLowerCase();
  if (type === "bill" || /\bbill\b.*(as introduced|as amended|as brought)/.test(title)) return 0;
  if (/^(hl )?bill \d+/.test(title)) return 1;
  if (type.includes("explanatory")) return 2;
  if (type.includes("briefing")) return 3;
  return 4;
}

/**
 * Fetch real source text for bills. publications.parliament.uk sits behind a
 * Cloudflare JS challenge, so server-side fetches must go through the Bills
 * API's own document download endpoint (API-hosted PDF files), extracting
 * text with pdf.js. External links are still recorded as citations.
 */
export async function importBillTexts(sql: Sql, targetWithText = 3) {
  return recordImportRun(sql, "bill-texts", async () => {
    const bills = await sql`
      select id from bills order by last_updated desc nulls last limit 12
    `;
    let withText = 0;
    let publicationRows = 0;
    const errors: string[] = [];

    for (const bill of bills) {
      if (withText >= targetWithText) break;
      const existing = await sql`
        select 1 from bill_texts where bill_id = ${bill.id} and text_content is not null limit 1
      `;
      if (existing.length > 0) {
        withText += 1;
        continue;
      }

      try {
        const publications = await getJson<{ publications?: BillPublication[] }>(
          `${BILLS_API}/Bills/${bill.id}/Publications`
        );
        const pubs = (publications.publications ?? [])
          .slice()
          .sort((a, b) => publicationPriority(a) - publicationPriority(b));

        // record citation links for the top publications regardless of text
        for (const pub of pubs.slice(0, 12)) {
          const link = pub.links?.[0];
          const file = pub.files?.[0];
          const sourceUrl = link?.url ?? (file ? `${BILLS_API}/Publications/${pub.id}/Documents/${file.id}/Download` : null);
          if (!sourceUrl) continue;
          await sql`
            insert into bill_texts (bill_id, publication_id, title, content_type, source_url)
            values (${bill.id}, ${pub.id}, ${pub.title ?? null}, ${link?.contentType ?? file?.contentType ?? null}, ${sourceUrl})
            on conflict (bill_id, publication_id) do nothing
          `;
          publicationRows += 1;
        }

        // extract text from API-hosted files — but only from real bill text
        // ('Bill' publications) or explanatory notes. Written evidence and
        // amendment papers must never masquerade as the bill's source text.
        for (const pub of pubs) {
          const type = (pub.publicationType?.name ?? "").toLowerCase();
          if (type !== "bill" && !type.includes("explanatory")) continue;

          const htmlFile = pub.files?.find((f) => (f.contentType ?? "").includes("html"));
          const pdfFile = pub.files?.find((f) => (f.contentType ?? "").includes("pdf"));
          const file = htmlFile ?? pdfFile;
          if (!file) continue;

          const downloadUrl = `${BILLS_API}/Publications/${pub.id}/Documents/${file.id}/Download`;
          try {
            const response = await fetch(downloadUrl);
            if (!response.ok) {
              errors.push(`pub ${pub.id} file ${file.id}: HTTP ${response.status}`);
              continue;
            }
            const text = htmlFile
              ? stripHtml(await response.text()).slice(0, 200_000)
              : await extractPdfText(await response.arrayBuffer());
            if (!text || text.length < 200) {
              errors.push(`pub ${pub.id} file ${file.id}: extracted ${text?.length ?? 0} chars`);
              continue;
            }
            await sql`
              insert into bill_texts (bill_id, publication_id, title, content_type, source_url, text_content)
              values (${bill.id}, ${pub.id}, ${pub.title ?? null}, ${file.contentType ?? null}, ${downloadUrl}, ${text})
              on conflict (bill_id, publication_id) do update set
                text_content = excluded.text_content,
                source_url = excluded.source_url,
                fetched_at = now()
            `;
            withText += 1;
            break;
          } catch (error) {
            errors.push(
              `pub ${pub.id} file ${file.id}: ${error instanceof Error ? error.message : String(error)}`
            );
          }
        }
      } catch (error) {
        errors.push(
          `bill ${bill.id} publications: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    return { billsWithText: withText, publicationRows, errors: errors.slice(0, 20) };
  });
}
