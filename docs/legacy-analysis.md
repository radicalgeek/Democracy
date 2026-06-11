# Legacy Analysis

Date: 2026-06-10

## Executive Summary

Democracy is a 2015-era ASP.NET MVC prototype for digital direct democracy. The app lets users register, associate themselves with a UK constituency, browse parliamentary bills, vote for or against bills, set political compass positions, participate in people's debates, view parliamentary debates, and compare public sentiment with MP voting records.

The old implementation demonstrates the product shape, but it should be treated as a product archaeology artifact rather than a maintainable foundation. The domain model and public copy are the valuable parts. The runtime stack, integrations, credential handling, and trust model need a clean redesign.

## Product Intent Recovered From The App

The app's public copy argues that representative democracy fails because MPs cannot represent the varied views of tens of thousands of constituents. The product answer is to let people represent themselves by voting directly on bills debated in Parliament.

The app tries to answer:

- What would the public vote on the same bills MPs vote on?
- How does a constituency's public vote compare with its MP's vote?
- How does national public voting compare with parliamentary voting?
- How representative is the platform's user base?
- What political direction do public votes and MP votes imply?
- Which bills are active, new, updated, or trending?

The revival conversation adds a sharper ambition: use modern software and AI to finish the project as a platform for true political anarchy, meaning civic self-organization and public decision-making that reduces dependence on centralized representatives.

## Solution Inventory

### `Democracy`

ASP.NET MVC 5 web application.

Key areas:

- `Controllers/AccountController.cs`: ASP.NET Identity registration, login, email confirmation, password reset, and social login plumbing.
- `Controllers/HomeController.cs`: redirects to statistics, renders about/contact pages, exposes `StatsMap`.
- `Controllers/BillsController.cs`: bill list, bill details, parliamentary debates, vote casting, and bill stance setting.
- `Controllers/DebateController.cs`: people's debate views and comment posting.
- `Views/Home`: public copy and statistics UI.
- `Views/Bills`: bill list/detail/vote/stance/debate views.
- `Views/Debate`: people's debate view.
- `Content/Images`: map, compass, logo/user imagery.

### `Democracy.Data`

Entity Framework 6 data layer and migrations.

Important entities:

- `ApplicationUser`: identity user with constituency, verification status, profile fields, postcode, and screen name.
- `BillDataModel`: bill metadata, social/economic scores, political compass values, debate posts, votes, and MP votes.
- `VoteDateModel`: verified public vote on a bill, with constituency and political compass values.
- `OpinionDataModel`: unverified public opinion vote on a bill.
- `ParticipationRecord`: records that a user has participated on a bill/stage/house.
- `BillStanceDateModel`: user-provided political compass position for a bill.
- `ConstituencyDataModel`: constituency name and registered voters.
- `MPDataModel`: MP identity, party, constituency, offices, and image URL.
- `MpVoteRecord`: MP vote on a bill.
- `DebateDataModel`: parliamentary debate text linked to an MP and bill.
- `PeoplesDebatPostDataModel`: user debate post for a bill.

The data context uses ASP.NET Identity, removes pluralized table names and cascade delete conventions, and includes migrations from April 2015.

### `Democracy.BillsRSSFeed`

Service layer for the main civic domain.

Key classes:

- `BillsService`: bill listing, bill detail statistics, parliamentary debates for a bill, stance aggregation, and global statistics.
- `VoteService`: records verified votes, unverified opinions, and participation records.
- `DataUpdaterService`: populates constituencies, MPs, bills, parliamentary debates, and MP vote data.
- `ConstituencyService`: maps postcodes to constituencies through TheyWorkForYou and loads a user's constituency.
- `DebatesService`: people's debate read/write behavior and parliamentary debate lookup.
- `RSSClient`: imports bill RSS feeds from Parliament.

### `Democracy.TheyWorkForYou`

Legacy wrapper around the TheyWorkForYou API. It supports functions such as constituency lookup, MP lists, person lookup, and debate lookup.

Important security note: the API client contains a hard-coded third-party API key. Do not copy it into docs, commits, logs, or modern code. Rotate/revoke it if the integration is ever reused.

### `Democracy.PublicWhip`

Imports MP vote data from Public Whip's `votematrix-2010.dat` format. It maps numeric vote cells into `VoteType` values such as `Aye`, `No`, `TellAye`, `TellNo`, `Both`, and `Missing`.

### `Democracy.News`

Placeholder project for a planned media-intelligence layer. The remembered product intent was to find news items related to a bill or discussion, then rate those items on the political compass so users could see which way coverage leaned.

### Tests

Test coverage is partial and mostly skeletal.

- `Democracy.Tests`: basic MVC controller tests.
- `Democracy.Bills.Tests.Unit`: bill service unit tests with fake/stub repository helpers.
- `Democracy.Tests.Intergration`: RSS feed and vote data integration probes.
- `Democracy.Tests.Acceptance`: SpecFlow feature files for registration, election voting, and upcoming bills; at least one feature is still the default calculator example.

## Important Product Mechanics

### Verified vs Unverified Participation

The legacy app distinguishes verified users from unverified users:

- Verified users create `VoteDateModel` records and count toward national/public vote statistics.
- Unverified users create `OpinionDataModel` records and can still use the app.
- The public copy says verification attempts to find the user on the electoral roll.

The old code does not implement a robust modern identity assurance process.

### Constituency Representation

Users are mapped to constituencies by postcode. Constituency registered voter counts are loaded from `Democracy/ConstituencyPopulations.txt`.

Bill details calculate:

- local constituency vote distribution;
- national public vote distribution;
- parliamentary vote distribution;
- whether the user's MP vote aligned with local public voting.

### Political Compass

Users can place each bill on a two-axis compass:

- vertical: authoritarian to libertarian;
- horizontal: left/socialist to right/capitalist.

The service averages stance records for each bill and uses those values for public/MP direction statistics.

The revived product should extend this model beyond bills and comments. AI analysis should also score related news coverage, debate arguments, summaries, and media sources on the same compass so users can compare the bill, the public debate, parliamentary action, and media framing in one model.

### People's Debate And Parliamentary Debate

The app has two debate concepts:

- People's debates: user-submitted comments per bill.
- Parliamentary debates: imported debate text from TheyWorkForYou, linked to MPs where possible.

This is the natural insertion point for modern summarization, argument clustering, evidence extraction, moderation assistance, and political-compass projection of debate sentiment and stance.

### Statistics

The statistics screen is the product's strongest differentiator. It attempts to show:

- UK political direction;
- public direction;
- MP direction;
- trending bills;
- how representative MPs are;
- how representative the site is.

The old implementation uses Highcharts, a map SVG, and compass partials.

## Gaps And Risks

### Security

- Hard-coded API credential in source.
- Old dependency set with likely vulnerabilities.
- Build output and packages are committed.
- No modern secret management.
- No clear privacy model for postcode, identity, and political preference data.

### Trust And Legitimacy

- No robust identity verification strategy.
- No anti-brigading or sybil-resistance model.
- No audit trail for vote aggregation.
- No methodology disclosure for representativeness calculations.
- Risk of implying legally binding voting authority if copy is not careful.

### Data Freshness

- Integrations are built around 2015-era Parliament RSS, TheyWorkForYou, and Public Whip assumptions.
- Public Whip import targets a 2010 matrix file.
- MP population logic asks for MPs on `01/01/2015`.

### Code Quality

- Legacy .NET Framework 4.5.1 and MVC 5.
- Repository implementation disposes the DbContext inside methods returning queryables, which is fragile.
- Many typos in model/property names.
- Sparse error handling around external APIs.
- Expensive per-row commits in vote import.
- Minimal tests for critical civic logic.

### Product Gaps

- No implemented sentiment/argument analysis mapped onto the political compass.
- No implemented related-news discovery or political-compass scoring for media coverage.
- No anonymous tamper-evident voting design.
- No modern deliberation model.
- No moderation, reputation, or abuse handling.
- No onboarding/launch strategy beyond the old marketing note.
- No mobile-first experience.
- No public API.
- No transparent data provenance UI.

## Valuable Assets To Preserve

- Product thesis and public challenge.
- Domain model concepts: bills, constituencies, MPs, MP votes, public votes, opinions, debate posts, political stance, participation.
- Planned `Democracy.News` concept: related coverage discovery and political-compass scoring of media items.
- Statistics concepts around representativeness.
- Distinction between verified participation and opinion polling.
- Bill detail UX: summary, vote, local/national/parliament comparison, political stance, debates.
- Acceptance-test scenarios as early product requirements.
- Marketing note: video, press release, direct public challenge, media/blogger outreach.

## Recommended Interpretation

Do not modernize this codebase incrementally unless the goal is only historical preservation. For a real relaunch, use the repo as a source of product requirements and rebuild with a modern architecture that treats identity, privacy, data provenance, AI explainability, and civic abuse resistance as first-class requirements.
