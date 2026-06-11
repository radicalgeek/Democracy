import { readFileSync } from "node:fs";
import type { Sql } from "postgres";
import { commaFlip, normalizeConstituencyName } from "../lib/names.js";
import { recordImportRun } from "./parliament.js";

type SvgSeat = { svgId: string; legacyParty: string };

function loadSvgSeats(): SvgSeat[] {
  const url = new URL("../../data/svg-seats.json", import.meta.url);
  return JSON.parse(readFileSync(url, "utf8")) as SvgSeat[];
}

/**
 * Bind the accurate legacy SVG's 650 seat path IDs to current canonical
 * constituency records. Exact name match → 'exact'; match after
 * normalization/comma flip → 'normalized'; otherwise 'unmatched' (the seat is
 * a legacy boundary with no same-name successor — that is recorded, not hidden).
 */
export async function rebuildSeatBindings(sql: Sql) {
  return recordImportRun(sql, "svg-seat-bindings", async () => {
    const seats = loadSvgSeats();
    const constituencies = await sql`
      select id, name, normalized_name from constituencies where end_date is null or end_date > now()
    `;
    const byExact = new Map<string, number>();
    const byNormalized = new Map<string, number>();
    for (const row of constituencies) {
      byExact.set(row.name as string, row.id as number);
      byNormalized.set(row.normalized_name as string, row.id as number);
    }

    let exact = 0;
    let normalized = 0;
    let unmatched = 0;

    for (const seat of seats) {
      const legacyName = seat.svgId.replace(/_/g, " ");
      let constituencyId: number | null = byExact.get(legacyName) ?? null;
      let status: "exact" | "normalized" | "unmatched" = constituencyId ? "exact" : "unmatched";

      if (!constituencyId) {
        const normal = normalizeConstituencyName(seat.svgId);
        constituencyId = byNormalized.get(normal) ?? null;
        if (!constituencyId) {
          const flipped = commaFlip(legacyName);
          if (flipped) constituencyId = byNormalized.get(flipped) ?? null;
        }
        status = constituencyId ? "normalized" : "unmatched";
      }

      if (status === "exact") exact += 1;
      else if (status === "normalized") normalized += 1;
      else unmatched += 1;

      await sql`
        insert into svg_seat_bindings (svg_id, legacy_name, legacy_party, constituency_id, match_status)
        values (${seat.svgId}, ${legacyName}, ${seat.legacyParty}, ${constituencyId}, ${status})
        on conflict (svg_id) do update set
          constituency_id = excluded.constituency_id,
          match_status = excluded.match_status,
          matched_at = now()
      `;
    }

    return { seats: seats.length, exact, normalized, unmatched };
  });
}
