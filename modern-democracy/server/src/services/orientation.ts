import type { Sql } from "postgres";

/**
 * The global economic-axis orientation (+1 / -1), set by the ideology anchor so
 * Conservatives sit right of Labour. Applied to EVERY scorer-derived economic-x
 * (bills, news, parties, civic will…) so the whole compass is consistent. The
 * user's own questionnaire position is hand-mapped to the conventional axis and
 * is the reference everything else is oriented to — so it is never flipped.
 * Cached briefly to avoid a query per shaping call.
 */
let cache: { value: number; at: number } | null = null;

export async function econFlip(sql: Sql): Promise<number> {
  if (cache && Date.now() - cache.at < 60_000) return cache.value;
  try {
    const [row] = await sql`select value from app_meta where key = 'econ_flip'`;
    const value = row ? Number(row.value) : 1;
    cache = { value: value === -1 ? -1 : 1, at: Date.now() };
  } catch {
    cache = { value: 1, at: Date.now() };
  }
  return cache.value;
}
