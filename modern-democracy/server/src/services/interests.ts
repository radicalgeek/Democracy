import type { Sql } from "postgres";

/**
 * Register of Members' Financial Interests, from the official Interests API.
 * Fetched lazily per member and cached for a day; a stale cache is served if
 * the API is unreachable.
 */

const INTERESTS_API = "https://interests-api.parliament.uk/api/v1";
const CACHE_HOURS = 24;
const MAX_INTERESTS = 200;

type InterestItem = {
  id: number;
  summary: string;
  registrationDate: string | null;
  publishedDate: string | null;
  category?: { name?: string; number?: string };
};

export type MemberInterestsPayload = {
  memberId: number;
  total: number;
  registerUrl: string;
  categories: Array<{
    name: string;
    interests: Array<{ id: number; summary: string; registered: string | null }>;
  }>;
};

async function fetchAllInterests(memberId: number): Promise<InterestItem[]> {
  const items: InterestItem[] = [];
  let skip = 0;
  for (;;) {
    const response = await fetch(
      `${INTERESTS_API}/Interests?MemberId=${memberId}&Take=50&Skip=${skip}&ExpandChildInterests=false`,
      { headers: { accept: "application/json" } }
    );
    if (!response.ok) throw new Error(`interests api returned ${response.status}`);
    const payload = (await response.json()) as { totalResults?: number; items?: InterestItem[] };
    const page = payload.items ?? [];
    items.push(...page);
    skip += 50;
    if (page.length === 0 || items.length >= (payload.totalResults ?? 0) || items.length >= MAX_INTERESTS) {
      break;
    }
  }
  return items;
}

function buildPayload(memberId: number, items: InterestItem[]): MemberInterestsPayload {
  const byCategory = new Map<string, MemberInterestsPayload["categories"][number]>();
  for (const item of items) {
    const name = item.category?.name ?? "Other interests";
    const entry = byCategory.get(name) ?? { name, interests: [] };
    entry.interests.push({
      id: item.id,
      summary: item.summary,
      registered: item.registrationDate ?? item.publishedDate ?? null
    });
    byCategory.set(name, entry);
  }
  const categories = [...byCategory.values()].sort(
    (a, b) => b.interests.length - a.interests.length
  );
  return {
    memberId,
    total: items.length,
    registerUrl: `https://members.parliament.uk/member/${memberId}/registeredinterests`,
    categories
  };
}

export async function memberInterests(sql: Sql, memberId: number): Promise<MemberInterestsPayload> {
  const [fresh] = await sql`
    select payload from member_interests_cache
    where member_id = ${memberId} and fetched_at > now() - make_interval(hours => ${CACHE_HOURS})
  `;
  if (fresh) return fresh.payload as MemberInterestsPayload;

  try {
    const items = await fetchAllInterests(memberId);
    const payload = buildPayload(memberId, items);
    await sql`
      insert into member_interests_cache (member_id, payload, fetched_at)
      values (${memberId}, ${sql.json(payload as never)}, now())
      on conflict (member_id) do update set payload = excluded.payload, fetched_at = now()
    `;
    return payload;
  } catch (error) {
    const [stale] = await sql`
      select payload from member_interests_cache where member_id = ${memberId}
    `;
    if (stale) return stale.payload as MemberInterestsPayload;
    throw error;
  }
}
