# AGENTS.md

## Purpose

This repo is a legacy direct-democracy prototype and product archaeology project. Agents should preserve what the old project teaches, document findings durably, and help move the concept toward a modern rebuild.

The revived product thesis is radical civic self-organization: help people deliberate, vote, compare public will with representative action, and reduce dependency on centralized political representation. Treat that ambition seriously while designing for privacy, transparency, safety, and legitimacy.

## Memory

Use Rembr whenever MCP tools are available.

At the start of substantive work:

1. Search Rembr for `project: democracy`.
2. Look for recent decisions, rewrite plans, data-source findings, safety constraints, and open questions.
3. Prefer hybrid search for broad recall and text/phrase search for exact filenames, APIs, or decisions.

After substantive work:

1. Store durable findings, decisions, verified commands, architecture notes, data-source discoveries, and unresolved follow-ups.
2. Use metadata such as `project: democracy`, `area`, `source`, `date`, and `verification`.
3. Do not store noisy command output, vendored package details, or raw logs unless they explain a future decision.

Never store secrets, credentials, private identity data, tenant data, voter records, or political preference data in memory.

## Repository Orientation

This is a Visual Studio-era .NET Framework solution.

Important paths:

- `Democracy.sln`: legacy solution.
- `Democracy/`: ASP.NET MVC web app.
- `Democracy.Data/`: EF6 data context, migrations, and domain models.
- `Democracy.BillsRSSFeed/`: services for bills, votes, debates, MPs, constituencies, statistics, and imports.
- `Democracy.Services.Contracts/`: view models.
- `Democracy.TheyWorkForYou/`: old TheyWorkForYou API client.
- `Democracy.PublicWhip/`: old Public Whip vote import.
- `Democracy.News/`: placeholder for planned related-news discovery and political-compass media scoring.
- `Democracy.Tests*`: partial unit, integration, and acceptance tests.
- `docs/`: modern analysis and planning docs.

Ignore `bin/`, `obj/`, `.vs/`, and `packages/` unless specifically investigating legacy build state or committed artifact cleanup.

## Sensitive Data

This repo currently contains at least one hard-coded third-party API credential in legacy source. Do not print the value in chat, docs, commits, memories, or issue text.

If asked to modernize integrations:

- move secrets to environment variables or a secret manager;
- rotate/revoke legacy credentials where possible;
- document the credential by purpose, not value;
- add tests or checks that prevent new secrets from being committed.

Political participation data is sensitive. Treat identity, postcode, constituency, votes, comments, verification evidence, and inferred sentiment/stance as high-risk data.

## Documentation Expectations

Keep documentation current as the project evolves.

When analyzing or changing direction, update one or more of:

- `README.md`
- `docs/legacy-analysis.md`
- `docs/modernization-plan.md`
- future decision records under `docs/decisions/`

Prefer concise, attributable notes over sprawling commentary. Mark assumptions clearly.

## Modernization Guidance

Default recommendation: use this repo as source material for a clean rewrite rather than incrementally modernizing the legacy MVC app.

Preserve:

- direct-democracy product loop;
- constituency mapping;
- verified vs unverified participation boundary;
- bill voting;
- public/local/national/parliamentary comparisons;
- political stance classification;
- political-compass measurement of AI summaries, sentiment, stance, and arguments;
- related-news discovery and political-compass scoring of media coverage;
- anonymous tamper-evident voting that prioritizes privacy over public vote traceability;
- people's debate and parliamentary debate context;
- representativeness statistics.

Replace:

- ASP.NET MVC 5 / .NET Framework 4.5.1 stack;
- old EF6 repository pattern;
- committed packages/build output;
- hard-coded credentials;
- 2015-era data-source assumptions;
- old frontend assets and UX;
- undeveloped sentiment-analysis concept.

## Trust And Safety

Any new implementation should include:

- privacy-preserving account and verification design;
- clear separation from official legal elections;
- transparent methodology for aggregates and AI analysis;
- audit trails for data imports and result snapshots;
- moderation and abuse prevention;
- anti-brigading and sybil-resistance planning;
- data retention and deletion policy;
- careful copy around politics, voting, and representation.

AI sentiment, argument, and stance classification should be explainable, political-compass based, and secondary to explicit votes. Do not treat an AI-inferred compass position as equivalent to a user's vote.

Voting integrity should be designed as anonymous and tamper-evident. Prefer unlinkable voting credentials, anonymous ballot records, private inclusion receipts, append-only event logs, reproducible aggregates, and cryptographic commitments. Do not assume a public blockchain is appropriate for raw votes; if used at all, it should only anchor checkpoint hashes.

## Working Style

Use `rg` and `rg --files` first for source search. Filter out vendored/build directories for normal analysis:

```sh
rg "pattern" --glob '!packages/**' --glob '!**/bin/**' --glob '!**/obj/**'
```

Before editing code, inspect the surrounding legacy pattern. Avoid broad refactors unless the user explicitly requests cleanup.

For new work, prefer modern, testable TypeScript/Postgres architecture unless the user asks to preserve .NET.

## Verification

For documentation-only changes:

- run `git diff --check`;
- inspect changed files with `git diff --stat` and targeted reads.

For legacy .NET code changes:

- check whether local build tooling exists before promising tests;
- expect old packages/framework constraints;
- document if tests cannot be run on the current machine.

For modern rewrite work:

- add meaningful tests around voting, aggregation, identity boundaries, data imports, and AI-analysis provenance;
- run the app locally and verify key flows in-browser when a frontend exists.
