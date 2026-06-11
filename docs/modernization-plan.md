# Modernization Plan

Date: 2026-06-10

For the fuller launchable product specification, see [full-product-implementation-plan.md](full-product-implementation-plan.md).

## North Star

Build a modern direct-democracy platform that lets people understand, debate, and vote on live political issues while measuring the gap between public will and representative action.

The platform should be explicitly civic, not an official electoral system. It can still be radical: the goal is to make representation contestable with transparent public data and to give people tools for self-organization, deliberation, and pressure.

## Strategic Positioning

Working project phrase:

> Represent yourself.

Core promise:

> Vote on the same issues Parliament votes on, see where your community stands, and compare that directly with what your representatives do.

Political thesis:

- Representative democracy collapses diverse public preferences into party discipline and single-member representation.
- Digital civic infrastructure can expose that collapse in real time.
- If people can deliberate, vote, and coordinate at scale, the legitimacy of centralized representatives becomes measurable rather than assumed.

## Product Pillars

1. Bill intelligence
   - Plain-English bill summaries.
   - Timeline, stage, affected areas, supporters/opponents, source documents.
   - AI-generated explainers with citations.

2. Public voting
   - For/against/abstain or richer vote options where appropriate.
   - Local, national, demographic, and constituency breakdowns.
   - Verified civic participation separated from unverified opinion polling.

3. Deliberation
   - People's debate per bill.
   - Argument mapping, pro/con clustering, common concerns, source-backed claims.
   - Sentiment, argument, and stance analysis projected onto the political compass.

4. Representative comparison
   - Compare public vote with MP vote.
   - Constituency-level representativeness score.
   - Party discipline and divergence views.
   - Track changes over time.

5. Political direction
   - Updated version of bill stance/compass.
   - Let users classify bill direction.
   - Use AI as a suggested political-compass classifier with public methodology and human challenge.

6. Media intelligence
   - Find news, opinion, and explainer coverage related to each bill or debate.
   - Rate individual articles, outlets, and narratives on the political compass.
   - Show users how media framing differs from bill text, public debate, and parliamentary action.

7. Trust layer
   - Privacy-preserving identity verification.
   - Clear aggregate-only public reporting.
   - Anonymous but tamper-evident voting and aggregation.
   - Audit logs for data imports, vote aggregation, and methodology.
   - Anti-abuse, moderation, and sybil-resistance.

## Recommended Modern Stack

### Application

- Next.js App Router with TypeScript.
- React Server Components for data-heavy views.
- Tailwind or a restrained component system for fast iteration.
- Server actions or route handlers for mutations.

### Data

- Postgres as the system of record.
- Prisma or Drizzle for schema and migrations.
- Search layer with Postgres full-text initially, then Meilisearch/OpenSearch if needed.
- Object storage for source documents and generated artifacts.

### AI

- Bill summarization with citations to official source text.
- Debate summarization and argument clustering.
- Sentiment, argument, and stance extraction from public comments, measured against the political compass axes.
- Related-news discovery and political-compass scoring for articles, outlet framing, and recurring narratives.
- Moderation assistance for abuse, spam, threats, and coordinated manipulation.
- Explainable classification: every AI-generated score should include source snippets, confidence, and model/version metadata.

### Jobs And Integrations

- Background worker for data ingestion.
- Scheduled sync for bills, MPs, divisions/votes, debates, and source documents.
- Scheduled discovery of bill-related news and commentary from selected sources.
- Queue for AI enrichment jobs.
- Data provenance records for every import.

Likely data sources to re-evaluate:

- UK Parliament APIs and data services.
- TheyWorkForYou.
- Public Whip, if still suitable.
- Parliament Hansard/debates feeds.
- Electoral geography and constituency boundary datasets.
- News/search providers, RSS feeds, and curated media/source lists.

### Identity

Identity needs a dedicated design spike. Options include:

- email + postcode for lightweight participation;
- third-party identity verification for "verified civic participant";
- electoral-roll matching only if legally and operationally viable;
- privacy-preserving attestations rather than storing raw evidence.

Minimum rule: political preferences, postcode, identity documents, and verification evidence are sensitive data. Store the least possible information.

## Proposed Data Model

Core tables:

- `users`: account identity and public profile.
- `verification_claims`: verification status, provider, assurance level, timestamps, no raw credentials.
- `constituencies`: canonical constituency records, boundaries, registered voter counts, validity dates.
- `representatives`: MPs and other representatives.
- `representative_terms`: representative-to-constituency history.
- `parties`: party metadata.
- `bills`: bill identity, title, summary, current stage, official URLs, status.
- `bill_versions`: source text/version snapshots.
- `bill_events`: stages, readings, committee events, amendments.
- `divisions`: parliamentary votes/divisions.
- `representative_votes`: MP vote records.
- `public_votes`: verified user votes on bills/divisions.
- `opinion_votes`: unverified votes/opinion poll records.
- `stance_records`: user and AI political-direction classifications.
- `debate_threads`: public debate containers.
- `debate_posts`: public comments.
- `ai_analyses`: summaries, sentiment, stance, argument clusters, model/version/provenance.
- `news_sources`: media outlets, authors, source metadata, and trust/provenance notes.
- `news_items`: bill-related articles, URLs, publication metadata, canonical text hashes.
- `news_bill_links`: relationship between bills/debates and discovered media items.
- `media_compass_analyses`: political-compass scoring for articles, outlets, frames, and narratives.
- `vote_receipts`: anonymous user-held inclusion receipts, not public vote choices.
- `aggregation_snapshots`: immutable public result snapshots.
- `append_only_events`: tamper-evident event log entries for vote casting, aggregation, imports, and publication checkpoints.
- `data_import_runs`: source, status, hashes, counts, errors, timestamps.
- `audit_events`: security and high-risk operational events.

## MVP Scope

The MVP should prove the core representativeness loop, not every political feature.

### In Scope

- Browse current bills.
- View one bill with official source links and AI-assisted summary.
- Register/login.
- Capture postcode/constituency.
- Vote for/against/abstain on a bill.
- Show local and national public vote aggregates.
- Import MP votes for selected divisions.
- Show whether public vote aligns with representative vote.
- Add people's debate comments.
- Generate sentiment/argument summary for a bill debate.
- Show related news items and political-compass lean for each item.
- Provide an anonymous vote receipt/inclusion proof without revealing the user's vote.
- Public methodology page.

### Out Of Scope For MVP

- Binding elections.
- Full electoral-roll verification.
- All UK political bodies.
- Complex liquid democracy/delegation.
- Advanced social network features.
- Native mobile app.
- Rich media campaigning.

## Delivery Phases

### Phase 0: Product Definition

Outputs:

- Product brief.
- Trust and safety brief.
- Data-source feasibility notes.
- Identity/privacy decision record.
- Updated name/brand decision.

Questions:

- Is the first launch UK-only?
- Is the first audience activists, politically homeless voters, journalists, or civic-tech funders?
- Does "true political anarchy" stay as internal thesis, public campaign phrase, or both?

### Phase 1: Technical Foundation

Outputs:

- New app scaffold.
- Database schema.
- Authentication.
- Constituency lookup.
- Data import job skeleton.
- Basic bill list/detail pages.

Acceptance criteria:

- A developer can run the app locally.
- Bills can be imported from a current source.
- A user can create an account and be mapped to a constituency.

### Phase 2: Voting And Aggregation

Outputs:

- Public voting flow.
- Verified/unverified participation boundary.
- Aggregate local/national results.
- Immutable aggregation snapshots.
- Anonymous vote receipts.
- Tamper-evident append-only vote and aggregation audit trail.

Acceptance criteria:

- User can vote once per bill/version or division.
- Results show public vote and abstention/participation context.
- Aggregates can be recomputed and compared to stored snapshots.
- A user can verify their vote was included without disclosing how they voted.
- Public observers can verify published aggregates came from an append-only event set.

### Phase 3: Representative Comparison

Outputs:

- MP/party/constituency imports.
- Division/vote imports.
- Representative comparison views.
- Representativeness score model.

Acceptance criteria:

- A bill/division page can show how the user's MP voted.
- Constituency public result can be compared to MP behavior.
- Methodology is visible and test-covered.

### Phase 4: AI Civic Intelligence

Outputs:

- AI bill summaries with citations.
- Political-compass sentiment/stance analysis for debate posts.
- Argument clustering.
- Stance classification.
- Related-news discovery and political-compass scoring.
- Moderation assistance.

Acceptance criteria:

- AI outputs show source, confidence, model, and generated-at metadata.
- Users can inspect why a classification was produced.
- Users can compare bill text, public debate, parliamentary debate, and news framing on the same compass.
- Moderation queues protect the debate surface.

### Phase 5: Launch System

Outputs:

- Public landing/onboarding.
- Shareable bill/result pages.
- Press kit.
- Demo video.
- Analytics.
- Feedback loop.

Acceptance criteria:

- A journalist, activist, or voter can understand the product in under two minutes.
- A user can share a specific bill comparison publicly.
- The team can see activation, retention, and contribution quality.

## AI Sentiment And Stance Design

Modern AI makes the old unsolved sentiment problem tractable, but the intended measurement model is not generic positive/negative sentiment. The original product logic was political-compass based: horizontal economic left/right and vertical social authoritarian/libertarian. AI should help project bills, debate arguments, summaries, and public comments onto those axes, with humility and traceability.

Recommended approach:

- Use simple deterministic vote aggregates for official platform statistics.
- Use AI only for explanatory layers: political-compass sentiment/stance, argument clusters, themes, toxicity/moderation, and bill stance suggestions.
- Store the compass model explicitly: horizontal economic left/right, vertical authoritarian/libertarian, confidence, rationale, and cited evidence.
- Store every AI analysis with source text hash, prompt/template version, model, timestamp, and confidence.
- Let users challenge or downvote AI summaries.
- Avoid pretending inferred compass position is "the will of the people"; it is a lens over conversation and bill text, not the vote itself.

## News And Media Compass Design

The old `Democracy.News` placeholder should become a media-intelligence layer. For each bill or debate, the platform should discover related reporting, opinion pieces, explainers, and campaign material, then classify their political lean using the same compass model as bills and debate.

Recommended approach:

- Start with curated, transparent source lists and RSS feeds before broad web crawling.
- Link every news item to the bill, debate, division, amendment, or topic it discusses.
- Score article framing on the compass, not just the outlet's general reputation.
- Separate article-level analysis from source-level trends.
- Show citations and excerpts that explain why an item was placed on the compass.
- Label uncertainty clearly, especially for neutral reporting, mixed arguments, satire, and quoted speech.
- Let users compare multiple perspectives without hiding disagreement or reducing everything to a single partisan label.

## Anonymous Tamper-Evident Voting Design

Blockchain was considered for immutable voting, but anonymity is more important than publishing every political action to a permanent public ledger. The platform still needs public confidence that votes are not being altered, deleted, or fabricated.

Recommended approach:

- Keep identity/eligibility separate from vote choice.
- Issue a blinded or otherwise unlinkable voting credential after eligibility checks.
- Store votes using anonymous ballot records rather than direct user-to-vote rows.
- Give each participant a private receipt that proves inclusion, not vote content.
- Maintain an append-only event log for ballot casting, aggregation, and result publication.
- Publish Merkle roots or comparable cryptographic commitments for each aggregation snapshot.
- Allow independent recomputation of published aggregates from anonymized event sets where privacy thresholds are met.
- Use small-cell suppression or differential privacy-style safeguards for constituency slices that could deanonymize people.
- Treat public blockchain as optional anchoring for checkpoint hashes only, not as the primary vote store.

The design goal is verifiability without coercion risk: users should be able to trust that their ballot was counted, observers should be able to detect tampering, and nobody should be able to prove to another person how they voted.

## Trust, Safety, And Legal Notes

This platform should avoid language that suggests official electoral authority. Suggested distinction:

- "public vote" or "civic vote" for platform participation;
- "official election" only when referring to legally administered elections;
- "verified participant" rather than "verified voter" unless legally reviewed.

Risks to design against:

- coercion or intimidation;
- doxxing;
- targeted political profiling;
- brigading;
- bot participation;
- extremist recruitment;
- harassment of MPs or users;
- misleading AI summaries;
- data-source drift;
- constituency boundary changes.

## First Concrete Build Slice

Build one vertical slice around a single current bill:

1. Import bill metadata and source text.
2. Generate cited plain-English summary.
3. Let users register and assign constituency.
4. Let users vote and comment.
5. Run political-compass sentiment/stance and argument analysis over comments.
6. Discover related news and score article framing on the political compass.
7. Show local/national aggregate results.
8. Provide anonymous inclusion receipts and publish tamper-evident aggregate checkpoints.
9. If available, show MP/party vote comparison.
10. Publish a shareable result page.

This slice proves the thesis and produces something demoable, fundable, and press-worthy.

## Legacy Migration Strategy

Do not migrate the old database blindly.

Preserve:

- domain terminology where useful;
- acceptance scenarios after rewriting them;
- old public copy as source material;
- model relationships and statistics concepts.
- `Democracy.News` as a media-intelligence concept, not its empty implementation.

Discard or replace:

- ASP.NET MVC 5 runtime;
- EF6 repository pattern;
- committed build artifacts;
- hard-coded credentials;
- old frontend assets;
- old external API assumptions;
- old identity verification assumptions.

## Immediate Next Actions

1. Decide the revived product name and public posture.
2. Create a fresh app in a separate directory or branch.
3. Spike current UK Parliament data sources.
4. Spike related-news discovery sources and article compass scoring.
5. Draft the schema and anonymous tamper-evident voting trust model.
6. Build the one-bill vertical slice.
7. Produce demo video and launch narrative.
8. Start outreach with a concrete, shareable proof rather than a pitch deck.
