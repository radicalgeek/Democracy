# Media Influence Metrics — Implementation Plan

Turn the media data we already collect into a set of **influence metrics** surfaced
across the product, signal-first (scatters/bars/trends, not lists). Every metric is
an observed signal with provenance and sample size — never a verdict, and never an
input to MP/party integrity scores (those stay verifiable-conduct-only).

## Data we already have

Per article (`news_items` + `news_assessments`): outlet, **owner** (map), `published_at`,
compass `(x,y)`, `bias` (lean), `framing` (fact/allegation/opinion), `sensational`,
`corroborating_outlets`, `factual_score`/`factual_label`; links to MPs (`news_member_links`)
and parties (`news_party_links`); `media_narratives`; `news_sources.factual_reliability`.

## Metrics (what each reveals)

1. **Share of voice** — coverage volume per party / MP / narrative, week over week. *Who gets airtime.*
2. **Agenda leadership** — which outlet first publishes a story others then corroborate. *Who leads the agenda* (from corroboration timing; no circulation data needed).
3. **Tone asymmetry per party/MP** — rate of allegation / sensational / uncorroborated framing, compared across figures. *Is the press running a campaign* (the Corbyn-smear lens).
4. **Hostility spikes** — a sudden cluster of uncorroborated allegations against one person → early-warning flag (scrutinise, never a verdict).
5. **Reliability of the diet** — % corroborated vs single-source / contested / sensational, trended. *How trustworthy is this week's news.*
6. **Sensationalism index** — overall + per outlet, trended.
7. **Ownership concentration** — share of all political coverage by owner + an HHI. *Media plurality.*
8. **Viewpoint diversity per topic** — spread of leans on a given story/narrative.
9. **Media ↔ public divergence** — distance between the media's centre of gravity and the public will / polling.
10. **Coverage ↔ polling** — lagged correlation of a party's coverage tone/volume with its polling trend (correlation, not causation).

Reach we can't get free → proxy by coverage volume + agenda-leadership, never fabricated circulation.

## Phase 0 — Data foundation (schema)

- `news_sources`: add `owner text`, `owner_type text` (populate from the existing `OWNERSHIP` map during news ingest) so concentration/tone can group by owner in SQL.
- `news_assessments`: add `cluster_key text`, `is_origin boolean` — set in `computeMediaReliability` (group corroborated articles into clusters by shared key-terms+window; earliest published = origin) to power agenda leadership.
- `media_metrics_daily(day date, key text, value numeric, ...)` — small rollup table for trended series (reliability mix, sensationalism, share-of-voice), refreshed in `recomputeDerived`.

## Phase 1 — Backend metrics service

New `services/media-metrics.ts`:
- `mediaMetrics(sql)` → `{ shareOfVoice, toneByParty, ownership: {byOwner, hhi}, reliabilityMix, reliabilityTrend, sensationalism, mediaVsPublic, agendaLeadership, viewpointDiversity }`.
- `coverageTone(sql, {memberId|partyId})` → volume, allegation%, sensational avg, uncorroborated%, sample, peer-relative asymmetry.
- Heavy/trended pieces precomputed in `recomputeDerived` (15-min tick) + full import; on-read aggregates stay live. Apply `econFlip` to any economic-x.

## Phase 2 — Endpoints

- `GET /api/insights/media-metrics` — the analytics block.
- Extend `representativeDetail` → `coverageTone`; `partySummaries`/party detail → `coverageTone`.
- Extend `partyPopularity` to include coverage tone/volume alongside the polling+events series.

## Phase 3 — Frontend, across surfaces

- **Media page** (primary): new "Media influence" analytics section —
  - Ownership concentration (bars + HHI headline)
  - Share of voice (top parties/MPs/narratives)
  - Reliability-of-diet (stacked bar + trend sparkline) + sensationalism index
  - Tone asymmetry (per-party hostile-framing bars; asymmetry highlighted)
  - Media ↔ public divergence (compass: media point vs public will)
  - Agenda leadership (outlets that break corroborated stories)
- **Dashboard**: compact "media health" tiles folded into `DemocracyHealth` — reliability-of-diet %, ownership concentration, media↔public divergence.
- **MP page**: "How the press covers you" — volume + hostile-framing rate + asymmetry vs peers, above the existing news list. Carefully framed.
- **Party page**: coverage-tone block + coverage-vs-polling overlay on the existing popularity chart.
- **Transparency page**: methodology + reliability/ownership provenance + CC attribution.

All visuals signal-first (scatter/bar/trend), reusing the flagged-scatter pattern.

## Cross-cutting safeguards (non-negotiable)

- Every metric labelled an observed signal with sample size + sources; tone asymmetry explicitly "flags disproportionate framing for scrutiny — not a claim the coverage is false" (Corbyn safeguard).
- Media metrics NEVER feed MP/party integrity (conduct-only).
- No fabricated reach; provenance + CC BY/BY-SA attribution shown.

## Phase 4 — Ongoing recompute

Trended/precomputed metrics refresh in `recomputeDerived` (15 min) and the 6h import; on-read metrics always current.

## Suggested build order

1. Phase 0 schema + ownership/cluster capture.
2. `media-metrics.ts` + `/api/insights/media-metrics`.
3. Media page analytics section (the showcase).
4. MP + party coverage-tone blocks.
5. Dashboard media-health tiles + Transparency methodology.

Each phase: build → verify locally → commit → deploy (server image for backend, web for UI), per the standing workflow.
