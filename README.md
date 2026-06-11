# Democracy

Legacy ASP.NET MVC prototype for a UK direct democracy platform. The product idea was to let people vote on the same bills debated in Parliament, compare public sentiment with MP voting records, and expose where representative democracy diverges from the expressed will of constituents.

This repository appears to be a one-month prototype from 2015. It is valuable less as reusable production code and more as a working product sketch: data ingestion, bill views, voting flows, constituency mapping, public debate, parliamentary debate context, and representativeness statistics are all present in some form.

## Product Thesis

Democracy was built around a direct-democracy challenge to representative politics:

- MPs cannot faithfully represent tens of thousands of diverse constituents on every issue.
- Citizens should be able to vote directly on parliamentary questions that matter to them.
- Local, national, and parliamentary vote comparisons can show whether MPs are actually representative.
- Verified voters should affect democratic statistics; unverified users can still contribute to visible opinion polling.
- Debate, sentiment, and ideological positioning can help people understand the political direction of the country when projected onto the political compass axes.

The current framing from the revival conversation is stronger and more explicit: the project is about creating true political anarchy in the sense of reducing dependency on centralized representatives by giving people tooling to coordinate, deliberate, vote, and hold power structures to account.

## What Exists

The solution contains 11 C# projects:

- `Democracy`: ASP.NET MVC web app with account management, bill pages, statistics, contact forms, and views.
- `Democracy.Data`: Entity Framework data context, migrations, identity user model, and domain entities.
- `Democracy.BillsRSSFeed`: service layer for bills, votes, debates, constituencies, MPs, statistics, and data updates.
- `Democracy.Services.Contracts`: view models shared between services and MVC.
- `Democracy.TheyWorkForYou`: legacy client for TheyWorkForYou API.
- `Democracy.PublicWhip`: parser/importer for Public Whip vote matrix data.
- `Democracy.News`: placeholder project for the old idea of finding bill-related news and rating media items on the political compass.
- `Democracy.Tests`, `Democracy.Bills.Tests.Unit`, `Democracy.Tests.Intergration`, `Democracy.Tests.Acceptance`: partial unit, integration, and SpecFlow acceptance test projects.

See [docs/legacy-analysis.md](docs/legacy-analysis.md) for a fuller inventory.

## Core Legacy Flows

1. A user registers with identity, postcode, and profile data.
2. The system looks up their constituency through TheyWorkForYou.
3. The system imports bills, MPs, parliamentary debates, and MP vote records.
4. A verified user votes for or against a bill; an unverified user creates an opinion-poll record instead.
5. The user can mark a bill on a political compass.
6. The app compares public, constituency, national, and parliamentary vote results.
7. Statistics pages show national direction, MP direction, trending bills, representativeness, and site coverage.

## Legacy Technical State

This code should not be treated as production-ready today.

Known issues include:

- Legacy .NET Framework 4.5.1 / ASP.NET MVC 5 stack.
- Vendored NuGet packages and committed build output.
- Hard-coded third-party API credential in source.
- Old public data integrations that may have changed or disappeared.
- Minimal tests relative to the product risk.
- No real modern privacy, abuse prevention, audit, trust, or identity assurance architecture.
- No implemented sentiment-analysis pipeline, despite the concept being present in the product direction.

## Recommended Direction

The best next step is a modern rewrite that preserves the product concept rather than trying to rehabilitate the old MVC app.

Suggested modern stack:

- Next.js or Remix for the public/product app.
- TypeScript across app and services.
- Postgres for relational civic data.
- Prisma or Drizzle for schema management.
- Background jobs for parliament data ingestion.
- Modern identity with strong verification boundaries.
- AI-assisted bill summaries, debate summaries, political-compass stance extraction, argument analysis, moderation assistance, and explainability.
- Related-news discovery with political-compass scoring so people can see how coverage leans around a bill or debate.
- Public transparency/audit pages for aggregate results, data freshness, and methodology.
- Anonymous but tamper-evident voting, prioritising privacy over public blockchain traceability.

See [docs/modernization-plan.md](docs/modernization-plan.md) for a staged plan.

## Documentation

- [docs/legacy-analysis.md](docs/legacy-analysis.md): detailed analysis of the current repo and old product behavior.
- [docs/modernization-plan.md](docs/modernization-plan.md): proposed plan for finishing/relaunching the project in a modern stack.
- [docs/full-product-implementation-plan.md](docs/full-product-implementation-plan.md): full launchable product implementation plan, including UI, maps, AI, moderation, anonymous voting integrity, and Democracy.News.
- [docs/AI_HANDOFF.md](docs/AI_HANDOFF.md): handoff for another AI to understand direction, current implementation, gaps, and next steps.
- [AGENTS.md](AGENTS.md): working instructions for future agents in this repo.

## Modern App Prototype

The first Dockerized modern realization lives in [modern-democracy](modern-democracy).

It includes a rich React UI with the full product surfaces: Bills, Vote, Petitions, Debate, News Lens, Map, Representatives, My Voice, and Transparency. It ships with sample civic data and live adapters for current UK Parliament Bills, Members, and Petitions APIs. Petitions support civic voting (for/against/abstain, separate from signatures), compass scoring, threshold tracking, and moderated debate.

Run it with:

```sh
cd modern-democracy
docker compose up --build
```

Then open `http://localhost:4173`.

## Safety And Trust Principles

This project touches politics, identity, voting-like behavior, and public persuasion. Any revival should be designed around:

- clear separation between legally binding electoral voting and civic polling/deliberation;
- strong privacy guarantees;
- no raw secrets in source;
- transparent methodology for AI summaries and sentiment classification;
- public auditability of aggregate statistics;
- strong protections against brigading, sockpuppeting, harassment, and manipulation;
- careful wording that does not imply official electoral authority.

## Current Status

Baseline repo analysis and revival documentation were added on 2026-06-10. The original code has not yet been modified beyond documentation.
