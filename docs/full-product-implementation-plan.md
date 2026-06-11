# Full Product Implementation Plan

Date: 2026-06-10

## Product Ambition

Democracy should become a full civic operating system for direct political participation. The product is not just a polling app and not just a bill tracker. It should help people understand live political issues, see how their constituency feels, compare that public will with representative action, debate openly, inspect media framing, and create a tamper-evident record of public opinion without exposing individual votes.

The 2015 prototype was impressive for a one-month build. It already contained the right primitives: bills, constituencies, public voting, MP vote comparison, political compass stance, people's debate, parliamentary debate, and map-led statistics. The modern version should keep that soul and rebuild everything around trust, scale, privacy, AI explainability, and a beautiful rich UI.

## Core Product Promise

Represent yourself.

Vote on the same issues Parliament votes on, see where your community stands, compare that with your MP, and understand how the debate and media coverage lean.

## Launchable Product Scope

This is the full launchable product, not a minimal prototype.

Launch should include:

- current bill discovery and tracking;
- full bill workspace with AI summaries, citations, voting, debate, news, data, and methodology;
- public, constituency, national, party, and parliamentary comparison views;
- SVG constituency maps with color layers based on voting and political compass lean;
- political compass scoring for bills, comments, arguments, articles, and media framing;
- AI-moderated debate with a viewpoint-neutral moderation policy;
- user reputation, public temporary-ban count, and exponential temporary bans for trolling or personal attacks;
- anonymous but tamper-evident voting;
- related-news discovery through `Democracy.News`;
- public transparency pages for data sources, methods, AI models, moderation policy, and aggregation integrity;
- admin, moderation, data-ingestion, and audit tools;
- responsive desktop and mobile UI.

## Product Principles

1. Free civic participation
   - Citizens should not pay to vote, debate, or inspect representative alignment.
   - Monetization should happen around donations, grants, institutions, anonymized aggregate research, media embeds, and white-label civic tools.

2. Vote privacy before spectacle
   - Trust requires tamper evidence.
   - Safety requires anonymity.
   - Public blockchain should not store raw votes or traceable political behavior.

3. Debate should be open, not sanitized
   - Political debate often includes uncomfortable, angry, or unpopular views.
   - Moderation should be behavior-based and viewpoint-neutral.
   - Legitimate concerns should be allowed even when other platforms might find them awkward or controversial.

4. Attack behavior, not political position
   - Personal attacks, threats, harassment, spam, and trolling get enforced.
   - Good-faith argument, evidence, and lived experience should be protected.

5. The compass is the measurement language
   - AI analysis should map bills, arguments, summaries, comments, and media framing onto the political compass.
   - Generic positive/negative sentiment is too weak for this product.

6. The map is a first-class product surface
   - The SVG map work from the original prototype should be preserved and modernized.
   - Maps should not be a novelty. They should be the main way people see public will forming geographically.

7. Every claim needs provenance
   - Bill summaries, vote counts, news classifications, debate analysis, and representative comparison must show source, timestamp, method, and confidence.

## Target Users

### Citizens

People who want to understand a bill, express a view, compare themselves with their constituency, and see whether their MP aligns with them.

### Politically Disengaged Or Homeless Voters

People who do not feel represented by parties or MPs and need a clearer way to express issue-by-issue views.

### Journalists And Commentators

People who need evidence for "what does the public think about this bill?" and "where is the representative gap?"

### Campaigners And Civil Society

Organizations that want to understand public support, opposition, and concern clusters without relying only on polls or social media.

### Researchers

Academics and civic data analysts who need aggregate, anonymized, methodologically transparent data.

### Representatives

MPs, councillors, parties, and staff who want to see constituency views, disagreement, emerging arguments, and media framing.

## Information Architecture

Primary navigation:

- Bills
- Vote
- Debate
- News Lens
- Map
- Representatives
- My Voice
- Transparency

Secondary/admin navigation:

- Moderation Queue
- Data Imports
- AI Analyses
- Aggregation Snapshots
- Audit Log
- Source Registry
- Methodology
- User Appeals

## Primary App Surfaces

### 1. Civic Home

Purpose: orient returning and new users quickly.

Content:

- current top bills;
- "your constituency today" panel;
- map snapshot showing active public vote patterns;
- "where your MP diverges" panel;
- open debates needing participation;
- recent news framing shifts;
- trust and transparency status.

Desktop layout:

- left navigation rail;
- main feed of active civic issues;
- right column with constituency and trust widgets.

Mobile layout:

- bottom tab navigation;
- stacked issue cards;
- map preview with tap-to-expand.

### 2. Bill Workspace

This is the core product screen.

Sections:

- bill title, house, stage, status, official source links;
- AI plain-English summary with numbered citations;
- vote controls: For, Against, Abstain or richer options where bill type requires;
- political compass position of the bill;
- public vs MP alignment meter;
- local constituency vote breakdown;
- national vote breakdown;
- parliamentary/party vote breakdown;
- debate tabs;
- news lens tab;
- data and methodology tab;
- tamper-evident aggregation checkpoint.

Key interactions:

- save/follow bill;
- share bill view;
- retake or update stance classification if permitted;
- inspect citation;
- inspect AI rationale;
- open map in full-screen;
- compare this bill with related bills;
- verify vote receipt after voting.

### 3. Map Workspace

This should be one of the most beautiful parts of the product.

Map modes:

- public vote result by constituency;
- turnout/participation density;
- MP alignment or divergence;
- political compass lean by constituency;
- debate intensity;
- media framing exposure;
- change over time;
- party vote vs public vote;
- confidence/data completeness.

SVG map requirements:

- use constituency-level SVG boundaries where licensing allows;
- keep vector crispness at all zooms;
- support hover, tap, keyboard focus, and search;
- direct label on selected constituency;
- inset maps for London, Scotland islands, or other dense regions;
- color legends must be visible without hover;
- color encodings must survive color-deficiency checks;
- map should have URL-shareable state.

Color design:

- vote: green for for, red for against, gray for no data, with intensity by margin;
- compass: four-quadrant palette, not party colors;
- divergence: neutral-to-alert scale, with clear caveats;
- participation: sequential scale, not ideological colors.

### 4. Debate Workspace

Purpose: host real political debate while preventing personal abuse and manipulation.

Features:

- bill-linked debate threads;
- argument tags generated by AI and confirmed by users/moderators;
- pro, con, concern, question, evidence, lived experience, and rebuttal post types;
- threaded replies with depth limits;
- citation support;
- "steelman this argument" AI aid;
- "summarize disagreement" AI aid;
- sorting by constructive, newest, controversial, representative, and cited;
- debate health metrics;
- moderation transparency banner.

Debate should not become sterile. The UI should feel like a serious public forum, not a corporate comments widget.

### 5. News Lens

This is the revived `Democracy.News` product.

Purpose: show how the information environment around a bill leans.

Features:

- bill-related article discovery;
- article-level political compass placement;
- outlet-level trend view;
- recurring narrative clusters;
- comparison between bill text, public debate, parliamentary debate, and news framing;
- source list and provenance;
- user reports for incorrect matching or poor classification;
- neutral/mixed/uncertain classification states.

Views:

- article scatterplot on compass;
- source list with lean and confidence;
- narrative clusters;
- timeline of coverage;
- "what changed this week" summary;
- "coverage gaps" panel.

Important rule:

- Score article framing, not just outlet brand. A newspaper can publish mixed or unexpected framing.

### 6. Representative Profile

Purpose: show what a representative does compared with their constituents.

Sections:

- MP biography and constituency;
- recent votes;
- alignment score over time;
- issue-by-issue public divergence;
- party discipline view;
- speeches/debates linked to bills;
- public questions and responses if enabled;
- media mentions.

### 7. Constituency Profile

Purpose: make local public will visible.

Sections:

- active bills in the constituency;
- constituency vote map and trend;
- local debate themes;
- MP alignment;
- participation coverage;
- political compass position over time;
- comparison with national results;
- data confidence caveats.

### 8. My Voice

Purpose: give users agency and accountability without exposing private votes publicly.

Features:

- saved bills;
- personal vote history visible only to the user;
- private inclusion receipts;
- debate contributions;
- moderation status;
- reputation level;
- temporary-ban count and history visible according to policy;
- constituency settings;
- privacy controls;
- export/delete account requests.

### 9. Transparency Hub

Purpose: make the system inspectable.

Pages:

- methodology;
- data sources;
- AI model and prompt versions;
- aggregation snapshots;
- vote-integrity commitments;
- moderation policy;
- moderation statistics;
- appeals process;
- security and privacy model;
- funding and governance.

## Visual Design Direction

The product should feel like civic infrastructure: serious, beautiful, data-rich, and trustworthy. It should not look like a campaign site, social network, or generic SaaS dashboard.

Design qualities:

- map-first visual identity;
- crisp SVG/vector geography;
- white and charcoal base;
- restrained civic accent colors: teal, green, red, blue, gold;
- no party-color dominance;
- no purple gradient SaaS styling;
- compact but breathable density;
- direct labels over legend-heavy charts;
- tables where comparison matters;
- cards only for repeated items and side panels;
- accessible color and contrast;
- clear mobile states.

Component families:

- app shell with left rail on desktop and bottom tabs on mobile;
- bill header;
- vote control group;
- compass chart;
- constituency map;
- alignment meter;
- debate post;
- moderation notice;
- news item row;
- article compass scatterplot;
- source confidence label;
- data provenance chip;
- receipt verification panel;
- public audit snapshot row;
- user reputation badge.

Motion:

- map transitions when switching layers;
- subtle color interpolation for vote changes;
- expandable explanations;
- reduced-motion fallback;
- no decorative motion that does not carry meaning.

## AI System

AI is a set of explainable civic intelligence services, not a magic oracle.

AI capabilities:

- bill plain-English summaries;
- source-grounded bill Q&A;
- political compass classification of bills;
- debate summarization;
- argument clustering;
- comment stance and compass projection;
- article and media framing classification;
- moderation classification;
- abuse/spam/manipulation detection;
- translation and accessibility summaries;
- "what are both sides saying?" neutral explanation.

Every AI analysis must store:

- input source ids;
- source text hash;
- model;
- prompt/template version;
- generated timestamp;
- confidence;
- citations or rationale;
- compass coordinates where relevant;
- moderation category where relevant;
- review status;
- user challenge status.

AI should never silently overwrite deterministic counts. Votes are votes. AI is explanatory context.

## Political Compass Model

Axes:

- horizontal: economic left to economic right;
- vertical: authoritarian to libertarian.

Compass target types:

- bill text;
- amendment;
- parliamentary debate excerpt;
- public debate post;
- argument cluster;
- news article;
- media narrative;
- representative speech;
- constituency aggregate;
- national aggregate.

Stored output:

- `x`: -1 to +1, left to right;
- `y`: -1 to +1, libertarian to authoritarian, or choose the inverse and document it consistently;
- confidence;
- rationale;
- cited evidence;
- classifier version;
- human review state.

UI:

- show dot position;
- show quadrant label;
- show confidence;
- show source excerpts;
- allow "challenge this placement".

## Moderation Philosophy

The debate policy should be more permissive than mainstream social platforms while still protecting people from abuse.

Allowed:

- unpopular political opinions;
- criticism of parties, institutions, ideologies, religions, corporations, public policy, and representatives;
- strong language about policy;
- discussion of immigration, crime, gender, religion, class, inequality, welfare, policing, war, and other sensitive topics;
- evidence-backed claims;
- personal lived experience;
- good-faith concern, even if bluntly worded;
- direct disagreement.

Not allowed:

- threats or incitement to violence;
- targeted harassment;
- personal attacks against other users;
- doxxing;
- repeated bad-faith disruption;
- spam;
- impersonation;
- coordinated manipulation;
- dehumanization;
- slurs used as attacks;
- explicit praise or advocacy of violence against protected or political groups;
- posting private personal data;
- malicious false claims about another user.

Important nuance:

- "This policy is dangerous because..." is allowed.
- "People who support this policy are vermin" is not allowed.
- "I am worried immigration is affecting housing and wages" is allowed.
- "Attack this named person because of their background" is not allowed.

Moderation should assess behavior, target, and context, not just keywords.

## AI Moderation System

All conversations need AI moderation.

Moderation pipeline:

1. Pre-submit local hinting
   - Warn users before posting if the text appears to contain a personal attack or likely policy violation.
   - Offer a rewrite suggestion that preserves the argument.

2. Post-submit classifier
   - Classify content into allowed, allowed but heated, needs human review, hidden pending review, or blocked.

3. Debate quality classifier
   - Identify evidence, questions, rebuttals, concerns, personal attacks, sarcasm, spam, and derailment.

4. Human review queue
   - High-risk cases go to moderators.
   - Borderline political content should favor publication with review rather than automatic deletion.

5. Appeals
   - Users can appeal moderation actions.
   - Successful appeals improve future classifier calibration.

Moderation categories:

- clean;
- heated but legitimate;
- personal attack;
- harassment;
- threat;
- doxxing;
- spam;
- low-effort trolling;
- hate/dehumanization;
- incitement;
- misinformation requiring context;
- legal/safety escalation.

UI states:

- visible;
- visible with context warning;
- collapsed but expandable;
- hidden pending review;
- removed with reason;
- author-only pending appeal.

## Reputation And Ban System

The goal is to deter trolling without suppressing legitimate political disagreement.

Reputation inputs:

- constructive posts;
- cited evidence;
- good-faith debate;
- successful reports;
- community helpfulness;
- moderation violations;
- successful appeals;
- repeated low-effort behavior;
- temporary bans.

Temporary ban escalation:

- first clear violation: warning or 1 hour cooldown;
- second: 6 hour ban;
- third: 24 hour ban;
- fourth: 3 day ban;
- fifth: 7 day ban;
- sixth: 30 day ban;
- severe threats/doxxing: immediate long ban or permanent suspension.

Use exponential duration by default:

`duration = base_duration * 2^(recent_violation_count - 1)`

Decay:

- old violations should decay after sustained good behavior;
- severe violations decay slowly or not at all;
- successful appeals remove or reduce strikes.

Public visibility:

- user cards should show public temporary-ban count and current standing;
- avoid exposing private moderation details;
- show "temporary bans in last 12 months" and "current status";
- show a badge for "appeal upheld" only in aggregate if needed;
- do not expose deleted content when it would amplify abuse.

Why show bans:

- debate participants should know whether someone has a history of disruption;
- transparency helps deter trolling;
- the display must not become a harassment target, so keep it factual and compact.

## Anonymous Tamper-Evident Voting

Design goal:

Users can verify their vote was included. Observers can verify published aggregates were produced from an append-only event set. Nobody can prove to another person how they voted.

Approach:

1. Eligibility
   - User proves account, constituency, and verification level.
   - System issues an unlinkable voting credential for a specific bill/division.

2. Ballot casting
   - Vote is submitted with credential, not direct user identity.
   - Credential is marked spent without linking to vote choice.
   - Ballot includes bill id, option, constituency bucket, timestamp bucket, and integrity metadata.

3. Receipt
   - User receives private receipt proving ballot inclusion.
   - Receipt does not reveal vote choice to third parties.

4. Append-only log
   - Vote cast events, aggregation events, and publication events are appended.
   - Events are hash-chained.
   - Periodic Merkle roots are published.

5. Aggregation
   - Aggregates are recomputable from anonymized event sets.
   - Constituency slices obey privacy thresholds.
   - Small-cell suppression prevents deanonymization.

6. Optional public anchoring
   - Publish checkpoint hashes to public ledgers only if useful.
   - Do not publish raw votes or user-linked events to a blockchain.

## Data Model

Core civic data:

- `users`
- `profiles`
- `verification_claims`
- `constituencies`
- `representatives`
- `representative_terms`
- `parties`
- `bills`
- `bill_versions`
- `bill_events`
- `amendments`
- `divisions`
- `representative_votes`

Participation:

- `voting_credentials`
- `anonymous_ballots`
- `vote_receipts`
- `opinion_votes`
- `aggregation_snapshots`
- `append_only_events`
- `audit_events`

Debate:

- `debate_threads`
- `debate_posts`
- `post_revisions`
- `argument_clusters`
- `post_votes`
- `reports`
- `moderation_actions`
- `appeals`
- `user_reputation_events`
- `temporary_bans`

AI:

- `ai_analyses`
- `ai_analysis_sources`
- `ai_model_versions`
- `ai_prompt_versions`
- `compass_classifications`
- `moderation_classifications`

News:

- `news_sources`
- `news_items`
- `news_bill_links`
- `news_narratives`
- `media_compass_analyses`
- `source_trend_snapshots`

Maps and visualization:

- `map_geometries`
- `map_layers`
- `constituency_metrics`
- `visualization_snapshots`

Transparency:

- `data_sources`
- `data_import_runs`
- `methodology_versions`
- `public_reports`
- `funding_records`

## API Surface

Public API:

- `GET /api/bills`
- `GET /api/bills/:id`
- `GET /api/bills/:id/summary`
- `GET /api/bills/:id/votes/aggregate`
- `GET /api/bills/:id/map`
- `GET /api/bills/:id/news`
- `GET /api/bills/:id/debate`
- `GET /api/constituencies/:id`
- `GET /api/representatives/:id`
- `GET /api/transparency/snapshots`

Authenticated API:

- `POST /api/votes/credential`
- `POST /api/votes/cast`
- `GET /api/votes/receipt/:id`
- `POST /api/debate/posts`
- `POST /api/debate/posts/:id/report`
- `POST /api/debate/posts/:id/appeal`
- `POST /api/compass/challenge`
- `GET /api/me`
- `GET /api/me/receipts`
- `GET /api/me/moderation`

Admin API:

- `POST /api/admin/imports/run`
- `GET /api/admin/imports`
- `GET /api/admin/moderation/queue`
- `POST /api/admin/moderation/actions`
- `GET /api/admin/audit`
- `POST /api/admin/ai/reanalyze`

## Recommended Technical Stack

Application:

- Next.js App Router;
- TypeScript;
- React Server Components for read-heavy pages;
- client components for maps, charts, voting controls, debate composer, and filters;
- Tailwind or CSS modules with a strict design token layer;
- lucide icons for controls where appropriate.

Data:

- Postgres;
- Prisma or Drizzle;
- PostGIS for geography if needed;
- Redis for queues/cache/rate limits;
- object storage for source documents and snapshots.

Search:

- Postgres full text initially;
- Meilisearch, Typesense, or OpenSearch when needed.

Visualization:

- SVG for constituency maps where possible;
- D3 for map projection/color/interaction;
- Observable Plot or D3 for charts;
- Canvas only for very dense layers;
- direct labels and accessible legends.

Jobs:

- background worker for imports;
- scheduled bill and division sync;
- scheduled news discovery;
- AI analysis queue;
- moderation queue;
- aggregation snapshot generator.

AI:

- model provider abstraction;
- source-grounded summarization;
- classifier pipelines;
- moderation classifier;
- evaluation harness;
- prompt/model versioning.

Infrastructure:

- containerized app and worker;
- managed Postgres;
- managed Redis;
- object storage;
- CDN;
- observability;
- audit log retention;
- backup and restore.

## Data Ingestion

Pipelines:

1. Bills
   - import current bills, stages, official text, amendments, and source URLs.

2. Representatives
   - import MPs, parties, terms, constituencies, offices, and photos.

3. Divisions and votes
   - import parliamentary votes and map them to bills/divisions.

4. Debates
   - import Hansard/parliamentary debate text and speaker metadata.

5. Constituencies
   - import boundaries, voter counts, historical changes, and names.

6. News
   - discover related news from curated feeds and search APIs.
   - canonicalize URLs.
   - extract article text.
   - classify relation to bill.
   - classify compass framing.

Every import run should record:

- source;
- source URL;
- timestamp;
- record counts;
- content hashes;
- errors;
- version;
- affected entities.

## Accessibility And Inclusion

Requirements:

- WCAG 2.2 AA target;
- keyboard navigation across maps, debate, voting, and charts;
- screen-reader summaries for visualizations;
- non-color encodings for map layers;
- tap-friendly mobile map controls;
- readable typography;
- reduced-motion support;
- plain-English summaries;
- support for low-bandwidth mode;
- avoid hover-only details.

## Security And Privacy

Key risks:

- political preference leakage;
- postcode/identity linkage;
- coercion;
- vote selling or proof-of-vote pressure;
- doxxing;
- scraping user profiles;
- bot participation;
- data-source poisoning;
- prompt injection in article/debate text;
- model output manipulation.

Controls:

- separate identity data from vote data;
- encrypt sensitive data at rest;
- strict access controls;
- audit privileged access;
- rate limiting;
- bot detection;
- source sanitization before AI processing;
- moderation audit trails;
- privacy-preserving aggregates;
- public security policy;
- incident response plan.

## Testing And Quality

Core tests:

- voting eligibility;
- one credential per bill/division;
- anonymous ballot creation;
- receipt verification;
- aggregate recomputation;
- privacy threshold suppression;
- representative alignment calculations;
- map color scale correctness;
- AI provenance storage;
- moderation classifier policy examples;
- ban escalation and decay;
- appeal handling;
- news-to-bill matching;
- compass classification persistence.

Frontend tests:

- bill workspace flow;
- vote casting;
- receipt display;
- map layer switching;
- debate composer moderation hint;
- post report and appeal;
- news compass view;
- mobile navigation;
- keyboard navigation.

Visual QA:

- map color legends;
- constituency selection;
- responsive map insets;
- chart readability;
- debate density;
- empty/loading/stale states.

AI evaluation:

- golden moderation examples;
- adversarial political debate examples;
- false positive review;
- compass scoring calibration;
- source citation accuracy;
- summary hallucination checks;
- article matching precision.

## Launch Governance

The product needs governance before scale.

Required public pages:

- moderation policy;
- AI methodology;
- voting integrity model;
- privacy policy;
- funding policy;
- data-source policy;
- correction and appeal process;
- security contact.

Internal roles:

- product owner;
- civic data engineer;
- frontend/data visualization engineer;
- AI engineer;
- moderation lead;
- trust and safety reviewer;
- legal/privacy advisor;
- community manager.

## Delivery Roadmap

### Phase 0: Product And Trust Definition

Outputs:

- final product name and positioning;
- moderation constitution;
- trust and voting integrity architecture;
- AI compass methodology;
- data-source feasibility;
- visual design system concept;
- launch governance draft.

### Phase 1: Foundation

Outputs:

- Next.js app shell;
- auth;
- user profile;
- constituency selection;
- database schema;
- bill import;
- representative import;
- basic bill workspace;
- first SVG map layer.

### Phase 2: Voting And Maps

Outputs:

- anonymous voting credential flow;
- vote casting;
- receipt display;
- aggregate snapshots;
- map coloring by constituency vote;
- public/national/constituency results;
- MP alignment.

### Phase 3: Debate And Moderation

Outputs:

- debate threads and posts;
- AI moderation pipeline;
- pre-submit hints;
- moderation queue;
- reports and appeals;
- reputation events;
- exponential temporary bans;
- public user ban count display.

### Phase 4: AI Civic Intelligence

Outputs:

- bill summaries with citations;
- bill compass classification;
- argument clustering;
- debate summaries;
- public comment compass projection;
- challenge flow for AI classifications.

### Phase 5: Democracy.News

Outputs:

- related-news discovery;
- article extraction;
- news-to-bill linking;
- article compass scoring;
- source trend views;
- news lens UI.

### Phase 6: Transparency And Public Launch

Outputs:

- transparency hub;
- methodology pages;
- integrity snapshot explorer;
- funding/governance pages;
- public share cards;
- press/demo assets;
- analytics.

### Phase 7: Hardening And Scale

Outputs:

- security review;
- privacy review;
- load testing;
- AI evaluation harness;
- moderation staffing workflow;
- observability;
- backup and disaster recovery;
- incident playbooks.

## First Launch Definition

The launchable product should support:

- at least 50 active/current bills;
- constituency map layers for vote, turnout, compass lean, and MP alignment;
- authenticated user participation;
- anonymous vote receipts;
- AI summaries and compass classifications;
- active debate with moderation;
- public temporary-ban count on user profiles/cards;
- related news lens;
- transparency hub;
- public shareable bill pages;
- admin import and moderation tools.

## What To Build First

Build one complete vertical slice, but at launch quality:

1. One live bill imported from current sources.
2. Official bill text and cited AI summary.
3. User account and constituency assignment.
4. Anonymous vote credential and ballot.
5. Receipt and aggregate checkpoint.
6. SVG constituency map colored by vote result.
7. MP alignment panel.
8. Debate thread with AI moderation.
9. Reputation and temporary-ban display.
10. Related news lens with compass scoring.
11. Transparency page for this bill's data and methods.

After this works beautifully, scale horizontally to more bills.

## Open Decisions

- Product name: keep Democracy or use a more distinctive brand?
- First geography: UK Parliament only, or include local councils later?
- Verification level: email/postcode first, or third-party identity at launch?
- Public ban display: lifetime count, last 12 months, or both?
- Moderation staffing: volunteer, paid, partner, or hybrid?
- News sources: curated list first, search provider, or user-submitted links?
- Vote options: simple For/Against/Abstain or bill-specific options?
- Compass scale: -1 to +1, 0 to 100, or legacy coordinate mapping?
- Public API: launch day or after stability?

## Success Metrics

Participation:

- registered users;
- verified civic participants;
- votes per bill;
- debate posts per bill;
- constituency coverage;
- returning users.

Trust:

- receipt verification rate;
- aggregate recomputation success;
- moderation appeal success rate;
- AI challenge rate;
- summary correction rate;
- data freshness.

Impact:

- share rate of MP divergence pages;
- journalist citations;
- civil society usage;
- representative responses;
- funding/donation conversion;
- number of bills with meaningful public participation.

Quality:

- moderation false positive/negative rate;
- toxic thread containment;
- map comprehension;
- mobile completion rate;
- AI citation accuracy;
- news matching precision.
