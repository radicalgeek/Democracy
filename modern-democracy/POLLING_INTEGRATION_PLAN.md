# Public Polling Data Integration Plan

Enrich the Democracy platform with **public polling data**, using only **free, openly-licensed sources** and an **ongoing (not one-off) ingestion pipeline**.

## Scope — free *and* refreshable sources

| Source | Access | Licence | Cadence | Role |
|---|---|---|---|---|
| **BritPolls** (`voting-intention.json`, `current-vi.json`, `leader-approval.json`) | Stable JSON URLs (not Cloudflare-challenged) | CC BY 4.0 | Weekly | **Primary engine** — auto-ingested in the 6h worker loop |
| **Wikipedia MediaWiki API** (polling archive) | Stable API | CC BY-SA | Continuous | **Backfill/depth** — longer historical trend |
| **MRP** (Survation / More in Common / Focaldata / Ipsos) | Per-publisher download | Per-publisher attribution | Episodic | **Semi-automated** — admin import, not in the auto loop |
| Pollster topic/issue APIs (YouGov etc.) | Paid / none | — | — | **Excluded** |

Confirmed BritPolls shapes:
- `voting-intention.json` → `{ updated, polls: [{ date, pollster, labour, conservatives, reform_uk, lib_dems, greens, snp, others, sample }] }`
- `current-vi.json` → poll-of-polls object `{ updated, source, labour, conservatives, reform_uk, lib_dems, greens, snp, others }`
- `leader-approval.json` → leader net approval `{ updated, leaders: [{ leader, party, approve, disapprove, net }] }`

## Ongoing guarantee

`worker.ts` already calls `runFullImport()` at boot and every `IMPORT_INTERVAL_MS` (default 6h). Adding one `importPolling()` step to `runFullImport()` makes polling permanently ongoing with no new scheduler. Time-series builds itself because each poll is upserted by `(pollster, fieldwork_end, scope)` — re-fetching the stable URL accumulates history.

## Phase 0 — Schema (additive only; respects `pg_advisory_xact_lock(41)`)

`CREATE TABLE IF NOT EXISTS`:
- `polls(id, source, pollster, fieldwork_end date, sample_size, method, scope, is_poll_of_polls bool, fetched_at, UNIQUE(pollster, fieldwork_end, scope))`
- `poll_results(poll_id, party_code, party_label, percent)` — long format
- `leader_approval(id, leader, party_code, approve, disapprove, net, as_of, source, UNIQUE(leader, as_of, source))`
- `mrp_estimates(id, constituency_id, source, party_code, percent, projected_winner, released_on, UNIQUE(constituency_id, source, party_code, released_on))`

Polling sources also registered as `source_registry` rows (category `polling`) with `newcomer_explanation`, `licence`, `refresh_cadence`, `caveats`.

## Phase 1 — Ingestion (`server/src/services/polling.ts`) + wire into loop

- `importPolling(sql)`: fetch the 3 BritPolls files, upsert `polls`/`poll_results`/`leader_approval`, log to `data_import_runs`. Resilient: on failure keep prior data. Env `POLLING_ENABLED`, overridable URLs.
- Register polling sources in `source_registry`.
- Add to `runFullImport()`.

## Phase 2 — Backend insights + routes

- `insights.ts`: `pollingSnapshot()` (poll-of-polls + per-pollster latest + spread), `pollingTrend(weeks)`, `leaderApproval()`.
- Compass transform: add a `polling` vector to `nationalCompass()` = support-weighted mean of each party's revealed compass position, weighted by current poll share. Labelled "derived, support-weighted".
- Routes: `GET /api/insights/polling`, `/api/insights/polling/trend`, `/api/insights/leader-approval`.

## Phase 3 — Frontend enrichment (no new tab — fold in)

| Screen | Enrichment |
|---|---|
| **Home / Dashboard** | New `PollingSnapshot` card: poll-of-polls bars + mini trend |
| **NationalCompass** | Add `polling` vector — civicWill vs national polling |
| **Representatives / Parties** | Live poll share per party + leader net approval |
| **Map** | New `polling` map mode = MRP projected winner per seat (Phase 4) |
| **My MP** | MRP seat projection when available (Phase 4) |
| **Transparency** | Polling provenance panel: source, licence, last-fetched, caveats |

New components: `PollingSnapshot.tsx`, `PollingTrend.tsx`. `src/lib/api.ts` gets fetchers + types. New help topic "poll of polls / margin of error / MRP".

## Phase 4 — MRP constituency layer (semi-automated)

`mrp_estimates` + `POST /api/admin/import/mrp` accepting a normalized MRP table; match seats via `mapping.ts` name normalization. New map mode shades the SVG map by projected winner, captioned "modelled estimate · source · release date".

## Phase 5 — Wikipedia depth

Longer historical VI trend via the MediaWiki API, feeding the same `polls` tables (source `wikipedia`).

## Cross-cutting (product non-negotiables)

- **Provenance**: every display shows source + "Source: BritPolls.co.uk" link (CC BY 4.0); credit underlying pollster; licence/fetched-at rendered in Transparency.
- **Map stays sacred**: polling is a separate labelled comparison layer, never merged into `civicWill`; MRP shading captioned as modelled.
- **Compass-not-sentiment**: the polling compass point is "derived, support-weighted", not a measured public compass.
- **Resilience**: upsert + keep-last-on-failure; `data_import_runs` logged.

## Shipping order

MVP = Phase 1+2 + Dashboard card + NationalCompass polling vector + party shares + Transparency provenance. Then trend chart → MRP map → Wikipedia backfill.
