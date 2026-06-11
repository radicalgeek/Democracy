# AI Handoff: Democracy Modernization

Date: 2026-06-11

## Status Update — 2026-06-11 (backend milestone)

The "Definition Of Done For Next Milestone" below is now substantially complete. The modern app has a real backend in `modern-democracy/server/` (Fastify + Postgres + worker, all TypeScript) and `docker compose up --build` now runs web + api + worker + db.

What is real now (verified end-to-end via the Compose stack):

- **Imports**: 650 current constituencies, 647 MPs, parties, 30 current bills with stages from the official Bills/Members APIs; periodic re-import every 6h. All runs recorded in `data_import_runs`.
- **Bill source text**: real "as introduced" bill text for Lords bills, fetched through the Bills API's own document download endpoint with pdf.js extraction. Note: `publications.parliament.uk` and `commonslibrary.parliament.uk` block non-browser clients (Cloudflare JS challenge), so Commons bill text whose publications have no API-hosted files is currently unavailable server-side — has_text stays false rather than substituting written evidence.
- **Map binding**: all 650 SVG seat path IDs extracted (`server/data/svg-seats.json`, with 2015 party classes) and bound to current constituency records: 418 exact + 22 normalized matches, 210 honestly unmatched (2010 vs 2024 boundaries). `GET /api/map/bindings`. The map colours real anonymous-ballot aggregates in vote mode and real MP party colours in alignment mode; unbound layers are explicitly captioned as demo shading.
- **Anonymous voting**: session → one-per-user credential issuance (user link kept only on issuance, never on the credential) → single-spend anonymous ballot with constituency claim → hash-chained `append_only_events` → per-bill Merkle checkpoints → private receipt verified by Merkle inclusion proof (`GET /api/receipts/:code/verify`). Per-constituency aggregates suppressed below `PRIVACY_THRESHOLD` (default 5). Caveat documented: data-model separation, not yet blind-signature unlinkability.
- **Debate**: persisted posts with moderation states (clean / heated-legitimate / needs-review / hidden / blocked), rules-based classifier implementing the project's moderation stance, `moderation_actions` audit trail, exponential temporary bans (1h, 2h, 4h...), public ban counts, ban enforcement on post.
- **AI provenance**: every summary/compass/moderation output stored in `ai_analyses` with model, prompt_version, source_hash, citations, confidence, review_state. The LLM is reached through the LiteLLM router in the k8s cluster (`LLM_BASE_URL`, Anthropic `/v1/messages` wire format, default model `router-local`); when unreachable, clearly-labelled low-confidence heuristics are stored instead.
- **Demo seeding** (`DEMO_SEED=true`, default): exercises the real credential→ballot→checkpoint pipeline with labelled `is_demo` users (780 ballots over 60 constituencies × 2 bills) so the map shows genuine aggregate-driven colouring. It never writes ballot rows directly.
- **Frontend wiring**: `src/lib/api.ts`; bills list, bill workspace (real title/summary/citations/compass/checkpoint), real vote flow with receipt + verify button, live debate feed + composer with moderation feedback, map bindings + aggregates. Falls back to sample data when the backend is absent, and the integration banner says which mode you are in.

What remains from the plan below: divisions/representative-vote import (for real MP-vs-public alignment), Hansard, Democracy.News ingestion/scoring, blind-signature credentials, compass/debate map layers from real data, argument clustering, appeals flow, UI polish pass, current-boundary map decision.

## Read This First

This project is the revival of a 2015 direct-democracy prototype. The user does not want a thin MVP or a generic civic-tech dashboard. The target is the full realization of the original idea:

- citizens vote directly on the same issues Parliament votes on;
- public votes are compared with constituency, national, MP, party, and parliamentary votes;
- debate is open, AI-moderated, and politically serious;
- related news coverage is discovered and scored on the political compass;
- the accurate UK constituency SVG map is a key product asset and must be preserved;
- voting must be anonymous but tamper-evident;
- the whole thing should feel like beautiful, serious civic infrastructure.

The user is proud of the original SVG maps and colorings. Do not replace them with toy geometry, stylized regions, or generic map placeholders.

## Current Repository State

The legacy app remains in the original Visual Studio solution:

- `Democracy.sln`
- `Democracy/`
- `Democracy.Data/`
- `Democracy.BillsRSSFeed/`
- `Democracy.PublicWhip/`
- `Democracy.TheyWorkForYou/`
- `Democracy.News/`
- legacy test projects

The modern app is in:

- `modern-democracy/`

Important docs:

- `README.md`
- `AGENTS.md`
- `docs/legacy-analysis.md`
- `docs/modernization-plan.md`
- `docs/full-product-implementation-plan.md`
- `docs/AI_HANDOFF.md`

## Product Direction

Core promise:

> Represent yourself.

The product should let a citizen:

1. Find a current bill.
2. Read an AI-generated plain-English summary with citations.
3. Vote on the bill.
4. See their constituency, national public, and parliamentary results.
5. Compare public votes with their MP.
6. Debate the bill openly.
7. See how comments, arguments, bills, and related news sit on the political compass.
8. Inspect a constituency map colored by vote, alignment, compass, participation, and debate intensity.
9. Verify their vote was included without revealing how they voted.
10. Trust that moderation targets abuse and trolling, not political viewpoint.

## Non-Negotiables

### Accurate Map

Use the old accurate UK constituency SVG:

- source: `Democracy/Content/Images/map.svg`
- modern copy: `modern-democracy/public/uk-constituency-map.svg`

The current modern map component fetches this SVG, strips old inline scripts/event handlers, injects it, and recolors actual `path.seat` elements.

Do not go back to the fake placeholder polygon map. That was explicitly rejected.

### Political Compass

The AI measurement model is the political compass, not generic positive/negative sentiment.

Axes:

- horizontal: economic left/right;
- vertical: authoritarian/libertarian.

Use this for:

- bill classification;
- comment stance;
- argument clusters;
- parliamentary debate extracts;
- news articles;
- media narratives;
- constituency aggregate direction.

### Moderation

The debate layer should be more permissive than mainstream social platforms, but not lawless.

Allowed:

- unpopular political opinions;
- blunt but legitimate concerns;
- strong criticism of policy, institutions, ideologies, parties, representatives, corporations, religions, and public systems;
- sensitive political topics such as immigration, gender, crime, class, welfare, religion, policing, and war;
- good-faith anger at systems or policy.

Not allowed:

- personal attacks against other users;
- threats;
- targeted harassment;
- doxxing;
- spam;
- coordinated manipulation;
- low-effort trolling;
- dehumanization;
- slurs used as attacks;
- incitement or praise of violence.

Temporary bans should escalate exponentially. Users should see how many times another user has been temporarily banned, but do not expose private moderation details or removed abusive content.

### Voting Integrity

The user considered blockchain, but anonymity matters more.

Preferred design:

- separate identity/eligibility from vote choice;
- issue unlinkable voting credentials;
- store anonymous ballots;
- give private inclusion receipts;
- use append-only event logs;
- publish Merkle-style checkpoint hashes;
- allow aggregate recomputation where privacy thresholds permit;
- use public blockchain only for optional checkpoint anchoring, never raw votes.

## Current Modern App

Path:

- `modern-democracy/`

Stack:

- React 19
- Vite
- TypeScript
- lucide-react
- Docker

Run locally:

```sh
cd modern-democracy
npm install
npm run dev
```

Run Docker:

```sh
cd modern-democracy
docker compose up --build
```

URL:

- local dev: `http://localhost:5173`
- Docker: `http://localhost:4173`

Current top-level surfaces:

- Bills
- Vote / Bill Workspace
- Debate
- News Lens
- Map
- Representatives
- My Voice
- Transparency

Current source files:

- `modern-democracy/src/App.tsx`
- `modern-democracy/src/components/Compass.tsx`
- `modern-democracy/src/components/ConstituencyMap.tsx`
- `modern-democracy/src/components/DebatePanel.tsx`
- `modern-democracy/src/components/IntegrationBanner.tsx`
- `modern-democracy/src/components/NewsLens.tsx`
- `modern-democracy/src/components/VotePanel.tsx`
- `modern-democracy/src/data/sampleData.ts`
- `modern-democracy/src/data/types.ts`
- `modern-democracy/src/lib/parliament.ts`
- `modern-democracy/src/styles/app.css`

Current live integrations:

- UK Parliament Bills API: `https://bills-api.parliament.uk`
- UK Parliament Members API: `https://members-api.parliament.uk`

Current live integrations are client-side status/adapters only. They do not yet persist or normalize a real database.

## What Exists In The Modern App

Implemented:

- Dockerized React app.
- Full product-shaped navigation.
- Sample civic data.
- Accurate legacy UK constituency SVG served from `public/uk-constituency-map.svg`.
- Map recoloring by vote/alignment/compass/debate modes.
- Bill workspace with summary, citations, vote controls, checkpoint panel.
- Debate panel with AI moderation states and public temporary-ban counts.
- News Lens with article-level political compass scoring.
- Representatives alignment cards.
- My Voice panel with private receipt/reputation/privacy concepts.
- Transparency panel with vote integrity and moderation explanation.
- Live Parliament API status checks.

Verification already done:

- `npm run build` passed.
- `docker compose up --build` passed.
- Docker served app at `http://localhost:4173`.
- `curl -I http://localhost:4173/uk-constituency-map.svg` returned HTTP 200 with 8,146,245-byte SVG.

## Major Gaps To Finish

The current modern app is a rich runnable prototype, not a production system. Finish it by replacing mocked/sample subsystems with real data and durable services.

### 1. Real Data Layer

Add a backend and database.

Recommended:

- Next.js App Router or keep Vite frontend plus a Node API.
- Postgres.
- PostGIS if using geographic queries.
- Drizzle or Prisma.
- Redis for queues/rate limits.

Core tables:

- users
- profiles
- verification_claims
- constituencies
- representatives
- representative_terms
- parties
- bills
- bill_versions
- bill_events
- amendments
- divisions
- representative_votes
- voting_credentials
- anonymous_ballots
- vote_receipts
- aggregation_snapshots
- append_only_events
- debate_threads
- debate_posts
- moderation_actions
- appeals
- user_reputation_events
- temporary_bans
- ai_analyses
- compass_classifications
- moderation_classifications
- news_sources
- news_items
- news_bill_links
- media_compass_analyses
- data_import_runs

### 2. Data Ingestion

Build import jobs for:

- current bills;
- bill stages;
- official bill text;
- amendments;
- divisions/votes;
- MPs;
- parties;
- constituencies;
- parliamentary debates/Hansard;
- related news.

Do not rely only on the 2015 Public Whip file. Re-evaluate current UK Parliament APIs and TheyWorkForYou/Public Whip status.

### 3. Real Map Data Binding

The old SVG has constituency path IDs like `South_East_Cornwall`. The app currently uses deterministic hash colors for the full legacy map and sample metrics for sidebar panels.

Finish this by:

- mapping SVG path IDs to canonical constituency records;
- normalizing old constituency names vs current boundary names;
- linking each constituency to vote aggregates;
- highlighting selected constituencies accurately;
- adding search;
- adding zoom/pan or region insets;
- adding accessible labels and keyboard traversal;
- ensuring color scales are data-driven and color-safe.

### 4. Real Voting

Build the anonymous vote system.

Minimum production architecture:

- user proves eligibility;
- server issues an unlinkable credential for a bill/division;
- ballot is cast with credential, not user id;
- credential is spent once;
- ballot goes into append-only log;
- aggregation snapshot is created;
- receipt proves inclusion but not vote choice;
- privacy threshold rules block dangerous small-slice views.

Do not implement raw user_id-to-vote records for verified votes.

### 5. AI Summaries And Compass

Build source-grounded AI services:

- bill summary;
- bill compass classification;
- comment compass classification;
- argument clustering;
- debate summary;
- related-news framing classification;
- moderation classification.

Every AI output must store:

- source ids;
- source hash;
- model;
- prompt version;
- generated timestamp;
- confidence;
- citations/rationale;
- human review/challenge state.

### 6. Moderation System

Build a real moderation pipeline:

- pre-submit warning;
- post-submit AI classification;
- allow / allowed-heated / review / hidden / blocked states;
- moderation queue;
- user reports;
- appeals;
- reputation events;
- exponential temporary ban calculation;
- public ban-count display.

Favor publication for borderline legitimate political content. Remove or restrict behavior that attacks people, intimidates, harasses, or derails.

### 7. Democracy.News

Build the media-intelligence layer:

- curated source registry;
- RSS/search ingestion;
- article extraction;
- article-to-bill matching;
- article-level compass scoring;
- source trend snapshots;
- narrative clustering;
- user reporting/correction.

Important: score article framing, not just outlet reputation.

### 8. UI Polish

The current UI is a starting point. Make it beautiful enough to matter.

Priorities:

- make the accurate map the true visual hero;
- improve map performance for the huge SVG;
- add map search and selected-seat details;
- improve mobile layout;
- refine typography and density;
- add loading/stale/offline states;
- add empty/error states;
- add real debate composer and moderation preview;
- add bill detail tabs that feel complete;
- add source/citation drawers;
- add shareable result pages.

## Suggested Next Work Order

1. Keep the accurate SVG map and build real ID-to-constituency mapping.
2. Add a real backend/database.
3. Implement bill/member/constituency import jobs.
4. Replace sample bills with imported bills.
5. Build real map aggregate binding.
6. Build anonymous voting credentials and ballot storage.
7. Build debate posts and moderation queue.
8. Add AI summary/compass/moderation services.
9. Build Democracy.News ingestion and scoring.
10. Harden privacy, audit, and transparency.
11. Run visual QA across desktop/mobile.
12. Prepare launch content and press/share flows.

## Known Caveats

- The legacy app contains at least one hard-coded third-party API credential. Do not print, copy, or store the value.
- The old map is accurate for the legacy period, but constituency boundaries may be stale. Verify whether it should be updated to current boundaries or preserved as a legacy layer.
- The modern app currently has no real database.
- The current map recoloring hashes path IDs for demo colors. This must become real aggregate-driven coloring.
- Browser-based visual verification was limited in the prior session because the available browser REPL could not reach host networking, but shell `curl` verified Docker serving.

## Commands

From repo root:

```sh
cd modern-democracy
npm install
npm run build
docker compose up --build
```

Verify:

```sh
curl -I -L http://localhost:4173
curl -I -L http://localhost:4173/uk-constituency-map.svg
```

Stop:

```sh
docker compose down
```

## Definition Of Done For Next Milestone

The next meaningful milestone is not "more UI". It is:

- imported real current bills;
- imported or normalized constituencies;
- accurate map paths linked to real constituency entities;
- one bill with real source text;
- real aggregate data model;
- real anonymous ballot prototype;
- debate persistence with moderation states;
- AI summary/compass pipeline storing provenance;
- Docker Compose runs app plus database plus worker.

When that is complete, the project starts becoming the actual platform rather than a beautiful product shell.
