# Modern Democracy

Modern Dockerized realization of the Democracy direct-democracy app: a React frontend plus a real backend (Fastify + Postgres) with live UK Parliament data, anonymous tamper-evident voting, persisted AI-moderated debate, and the original accurate UK constituency SVG map bound to real constituency records.

Product surfaces:

- Bills
- Vote
- Petitions
- Debate
- News Lens
- Map
- Representatives
- My Voice
- Transparency

## Architecture

```
modern-democracy/
  src/            React 19 + Vite frontend
  public/uk-constituency-map.svg   the accurate legacy constituency map (do not replace)
  server/         Fastify API + import worker (TypeScript, postgres.js)
    src/schema.sql                 full core schema, applied idempotently at boot
    data/svg-seats.json            650 seat path IDs + 2015 party extracted from the SVG
  docker-compose.yml               web + api + worker + Postgres
```

The frontend works standalone with sample data; when the backend is reachable (default `http://localhost:8787`, override with `VITE_API_BASE`) every surface upgrades to real data and the integration banner says so.

## Run the full stack (recommended)

```sh
docker compose up --build
```

- Web: `http://localhost:4173`
- API: `http://localhost:8787` (`/api/health`, `/api/status`)

On first boot the worker imports current bills, bill stages, bill source text, all 650 constituencies, MPs, and parties from the official Parliament APIs, binds the legacy SVG seat IDs to current constituency records, and generates AI summary/compass analyses with stored provenance. With `DEMO_SEED=true` (default) it then exercises the real credential → anonymous ballot → Merkle checkpoint pipeline with labelled demo users so the map shows genuine aggregate-driven colouring.

Environment knobs (compose reads your shell env / `.env`):

- `LLM_BASE_URL` — LiteLLM proxy speaking the Anthropic `/v1/messages` format; defaults to `http://host.docker.internal:4000`, expecting `kubectl port-forward -n dev-team svc/dev-team-litellm-router 4000:4000`. If unreachable, clearly-labelled low-confidence heuristics are stored instead.
- `LLM_MODEL` — model name configured in the LiteLLM router; defaults to `router-local`
- `LLM_API_KEY` — only needed if the proxy enforces virtual keys (the current router does not)
- `LLM_MAX_TOKENS` — defaults to 4096; reasoning models burn ~1k tokens thinking before answering
- `DEMO_SEED` — set `false` to skip demo ballots
- `VITE_API_BASE` — API origin baked into the web build

Stop with `Ctrl+C` or `docker compose down` (add `-v` to drop the database).

## Run frontend only

```sh
npm install
npm run dev
```

Open `http://localhost:5173`. Sample data is used unless an API is running on `:8787`.

## Run backend in dev

```sh
docker run -d --name democracy-db-dev -e POSTGRES_USER=democracy -e POSTGRES_PASSWORD=democracy -e POSTGRES_DB=democracy -p 5433:5432 postgres:16-alpine
cd server
npm install
npm run dev          # API on :8787
npm run dev:worker   # imports + checkpoints
```

Trigger an import manually: `curl -X POST http://localhost:8787/api/admin/import`

## Key API endpoints

- `GET /api/status` — import runs + row counts
- `GET /api/bills`, `GET /api/bills/:id` — imported bills with texts, events, AI analyses, aggregates, latest checkpoint
- `GET /api/map/bindings` — SVG seat → constituency bindings with match status (exact / normalized / unmatched)
- `POST /api/session` → `POST /api/bills/:id/credential` → `POST /api/bills/:id/ballots` — anonymous voting flow
- `GET /api/receipts/:code/verify` — Merkle inclusion proof for a private receipt
- `GET|POST /api/bills/:id/debate` — persisted debate with AI moderation states and public ban counts

## Voting integrity model (prototype)

Identity is separated from ballots at the data-model level: credential issuance records *that* a user received a credential for a bill (enforcing one each); the credential itself is stored only as a hash with a constituency claim and no user reference; ballots reference the credential's constituency, never a user. Every ballot appends to a hash-chained event log; Merkle checkpoints are published per bill; receipts prove inclusion without revealing choice; per-constituency aggregates are suppressed below a privacy threshold (default 5). True cryptographic unlinkability (blind signatures) is a documented next step — see `../docs/AI_HANDOFF.md`.

## Data sources

- `https://bills-api.parliament.uk` — bills, stages, publications (bill text PDFs are fetched through the API's own document download endpoint; `publications.parliament.uk` blocks non-browser clients)
- `https://members-api.parliament.uk` — constituencies, MPs, parties
- `https://petition.parliament.uk` — open petitions feed (client-side)

## Handoff

See `../docs/AI_HANDOFF.md` for project direction and what to do next.
