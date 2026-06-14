import type { Sql } from "postgres";
import { sha256 } from "../lib/crypto.js";
import { llmModelName, runLlmJson, storeAnalysis } from "./ai.js";

/**
 * Publisher-provided politics RSS feeds. Deliberately spread across the
 * editorial spectrum so compass-scored coverage is meaningful.
 */
export const MEDIA_FEEDS = [
  { name: "BBC News", url: "https://feeds.bbci.co.uk/news/politics/rss.xml" },
  { name: "The Guardian", url: "https://www.theguardian.com/politics/rss" },
  { name: "Sky News", url: "https://feeds.skynews.com/feeds/rss/politics.xml" },
  { name: "The Independent", url: "https://www.independent.co.uk/news/uk/politics/rss" },
  { name: "Daily Express", url: "https://www.express.co.uk/posts/rss/139/politics" },
  { name: "Daily Mirror", url: "https://www.mirror.co.uk/news/politics/?service=rss" },
  { name: "Daily Mail", url: "https://www.dailymail.co.uk/news/politics/index.rss" },
  { name: "Evening Standard", url: "https://www.standard.co.uk/news/politics/rss" },
  { name: "The Telegraph", url: "https://www.telegraph.co.uk/politics/rss.xml" },
  { name: "Politics.co.uk", url: "https://www.politics.co.uk/feed/" },
  { name: "Holyrood", url: "https://www.holyrood.com/rss.xml" },
  { name: "Nation.Cymru", url: "https://nation.cymru/category/news/politics/feed/" },
  { name: "Slugger O'Toole", url: "https://sluggerotoole.com/feed/" },
  { name: "Civil Service World", url: "https://www.civilserviceworld.com/rss" },
  { name: "ConservativeHome", url: "https://conservativehome.com/feed/" },
  { name: "LabourList", url: "https://labourlist.org/feed/" }
];

const RECENT_ITEMS_PER_FEED = Number(process.env.NEWS_RECENT_ITEMS_PER_FEED ?? 5);
const NEWS_SCORE_LIMIT = Number(process.env.NEWS_SCORE_LIMIT ?? 80);

const STOPWORDS = new Set([
  "bill", "act", "the", "and", "for", "with", "from", "into", "that", "this",
  "make", "ban", "all", "any", "are", "not", "our", "their", "his", "her",
  "provision", "connected", "purposes", "amendment", "regulations", "draft",
  "people", "public", "government", "uk", "britain", "british", "england"
]);

function keyTerms(title: string) {
  return [
    ...new Set(
      title
        .toLowerCase()
        .replace(/[^a-z\s]/g, " ")
        .split(/\s+/)
        .filter((word) => word.length > 3 && !STOPWORDS.has(word))
    )
  ];
}

type FeedItem = { title: string; url: string; description: string; publishedAt: string | null };

function decodeEntities(value: string) {
  return value
    .replace(/<!\[CDATA\[(.*?)\]\]>/gs, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/<[^>]+>/g, "")
    .trim();
}

function parseFeed(xml: string): FeedItem[] {
  const items: FeedItem[] = [];
  const blocks = xml.match(/<item>([\s\S]*?)<\/item>/g) ?? [];
  for (const block of blocks) {
    const title = decodeEntities(block.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? "");
    const url = decodeEntities(block.match(/<link>([\s\S]*?)<\/link>/)?.[1] ?? "");
    const description = decodeEntities(block.match(/<description>([\s\S]*?)<\/description>/)?.[1] ?? "");
    const pubDate = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1]?.trim() ?? null;
    if (!title || !url) continue;
    items.push({
      title,
      url,
      description: description.slice(0, 500),
      publishedAt: pubDate ? new Date(pubDate).toISOString() : null
    });
  }
  return items;
}

/** An article matches a subject when ≥2 of its distinctive title terms appear. */
function matches(terms: string[], item: FeedItem) {
  if (terms.length === 0) return false;
  const haystack = `${item.title} ${item.description}`.toLowerCase();
  const hits = terms.filter((term) => haystack.includes(term)).length;
  return hits >= Math.min(2, terms.length);
}

/**
 * Pull publisher politics feeds, attach matching articles to bills and open
 * petitions, and compass-score newly linked articles in one batched LLM call
 * per feed sweep (not per article — the proxy serializes a slow local model).
 */
export async function importNews(sql: Sql) {
  const [run] = await sql`
    insert into data_import_runs (kind) values ('news') returning id
  `;
  try {
    const feedItems: Array<FeedItem & { source: string }> = [];
    for (const feed of MEDIA_FEEDS) {
      try {
        const response = await fetch(feed.url, {
          headers: { accept: "application/rss+xml, application/xml, text/xml", "user-agent": "democracy-civic-platform/0.5 (+https://test.radicalgeek.co.uk)" }
        });
        if (!response.ok) continue;
        for (const item of parseFeed(await response.text())) {
          feedItems.push({ ...item, source: feed.name });
        }
      } catch {
        // one dead feed never blocks the sweep
      }
    }

    // Store a small recent slice from every feed even when it is not linked to
    // a bill/petition. The Media page is an outlet landscape, so it needs broad
    // current-politics coverage rather than only subject-linked articles.
    const recentByFeed = new Map<string, number>();

    const bills = await sql`
      select id, short_title from bills order by last_updated desc nulls last limit 40
    `;
    const petitions = await sql`
      select id, action from petitions where state = 'open' order by signature_count desc limit 30
    `;

    let linked = 0;
    const newItemIds: number[] = [];
    const linkItem = async (item: FeedItem & { source: string }) => {
      const [source] = await sql`
        insert into news_sources (name) values (${item.source})
        on conflict (name) do update set name = excluded.name
        returning id
      `;
      const [row] = await sql`
        insert into news_items (source_id, title, url, published_at, summary)
        values (${source.id}, ${item.title}, ${item.url}, ${item.publishedAt}, ${item.description})
        on conflict (url) do update set title = excluded.title
        returning id, (xmax = 0) as inserted
      `;
      if (row.inserted) newItemIds.push(row.id as number);
      return row.id as number;
    };

    for (const item of feedItems) {
      const count = recentByFeed.get(item.source) ?? 0;
      if (count >= RECENT_ITEMS_PER_FEED) continue;
      await linkItem(item);
      recentByFeed.set(item.source, count + 1);
    }

    for (const bill of bills) {
      const terms = keyTerms(bill.short_title as string);
      for (const item of feedItems) {
        if (!matches(terms, item)) continue;
        const newsId = await linkItem(item);
        await sql`
          insert into news_bill_links (news_item_id, bill_id)
          values (${newsId}, ${bill.id}) on conflict do nothing
        `;
        linked += 1;
      }
    }
    for (const petition of petitions) {
      const terms = keyTerms(petition.action as string);
      for (const item of feedItems) {
        if (!matches(terms, item)) continue;
        const newsId = await linkItem(item);
        await sql`
          insert into news_petition_links (news_item_id, petition_id)
          values (${newsId}, ${petition.id}) on conflict do nothing
        `;
        linked += 1;
      }
    }

    // Score the backlog, not just this sweep's new items — earlier batches can
    // fail partially (the LLM occasionally returns an incomplete array).
    const unscored = await sql`
      select distinct n.id from news_items n
      where not exists (
          select 1 from ai_analyses a
          where a.subject_type = 'news_item' and a.kind = 'compass' and a.subject_id = n.id::text
        )
      order by n.published_at desc nulls last, n.id desc
      limit ${NEWS_SCORE_LIMIT}
    `;
    const scored = await scoreNewNewsItems(sql, unscored.map((row) => row.id as number));

    await sql`
      update data_import_runs set status = 'succeeded', finished_at = now(),
        detail = ${sql.json({ feedItems: feedItems.length, linked, newItems: newItemIds.length, scored })}
      where id = ${run.id}
    `;
    return { feedItems: feedItems.length, linked, newItems: newItemIds.length, scored };
  } catch (error) {
    await sql`
      update data_import_runs set status = 'failed', finished_at = now(),
        detail = ${sql.json({ error: error instanceof Error ? error.message : "unknown" })}
      where id = ${run.id}
    `;
    return { feedItems: 0, linked: 0, newItems: 0, scored: 0 };
  }
}

/** Batch compass scoring: one LLM call per ~8 articles. */
async function scoreNewNewsItems(sql: Sql, itemIds: number[], batchSize = 8) {
  if (itemIds.length === 0) return 0;
  const items = await sql`
    select n.id, n.title, n.summary, s.name as source
    from news_items n left join news_sources s on s.id = n.source_id
    where n.id in ${sql(itemIds)}
  `;
  let scored = 0;
  for (let offset = 0; offset < items.length; offset += batchSize) {
    const batch = items.slice(offset, offset + batchSize);
    const user = batch
      .map(
        (item, index) =>
          `${index}. [${item.source}] ${item.title}\n${(item.summary as string | null) ?? ""}`
      )
      .join("\n\n");
    const result = await runLlmJson(
      'You score UK political news coverage on the political compass based on the framing of each headline and summary. x: economic, -10 left to +10 right. y: -10 libertarian to +10 authoritarian. Respond with JSON only: an array [{"index": number, "x": number, "y": number, "label": string, "rationale": string}] with one entry per numbered article.',
      user
    );
    if (!Array.isArray(result)) continue;
    for (const entry of result as Array<Record<string, unknown>>) {
      const item = batch[Number(entry.index)];
      if (!item || typeof entry.x !== "number" || typeof entry.y !== "number") continue;
      await storeAnalysis(sql, {
        subjectType: "news_item",
        subjectId: String(item.id),
        kind: "compass",
        text: `${item.title}\n${item.summary ?? ""}`,
        output: {
          x: entry.x,
          y: entry.y,
          label: (entry.label as string) ?? "unclassified",
          rationale: (entry.rationale as string) ?? ""
        },
        model: llmModelName(),
        confidence: 0.6
      });
      scored += 1;
    }
  }
  return scored;
}

/** Articles linked to a bill or petition, with their latest compass score. */
export async function newsForSubject(
  sql: Sql,
  subject: { billId?: number; petitionId?: number },
  limit = 12
) {
  const rows = subject.billId
    ? await sql`
        select n.id, n.title, n.url, n.published_at, n.summary, s.name as source
        from news_bill_links l
        join news_items n on n.id = l.news_item_id
        left join news_sources s on s.id = n.source_id
        where l.bill_id = ${subject.billId}
        order by n.published_at desc nulls last limit ${limit}
      `
    : await sql`
        select n.id, n.title, n.url, n.published_at, n.summary, s.name as source
        from news_petition_links l
        join news_items n on n.id = l.news_item_id
        left join news_sources s on s.id = n.source_id
        where l.petition_id = ${subject.petitionId ?? 0}
        order by n.published_at desc nulls last limit ${limit}
      `;
  if (rows.length === 0) return [];

  const analyses = await sql`
    select distinct on (subject_id) subject_id, output, model, confidence
    from ai_analyses
    where subject_type = 'news_item' and kind = 'compass'
      and subject_id in ${sql(rows.map((row) => String(row.id)))}
    order by subject_id, id desc
  `;
  const byId = new Map(analyses.map((row) => [row.subject_id as string, row]));

  return rows.map((row) => {
    const analysis = byId.get(String(row.id));
    const output = (analysis?.output ?? null) as { x?: number; y?: number; label?: string; rationale?: string } | null;
    return {
      id: row.id,
      title: row.title,
      url: row.url,
      source: row.source,
      publishedAt: row.published_at,
      summary: row.summary,
      compass: output
        ? { x: output.x ?? 0, y: output.y ?? 0, label: output.label ?? "unclassified", rationale: output.rationale ?? "", model: analysis?.model, confidence: analysis?.confidence }
        : null
    };
  });
}
