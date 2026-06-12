# Civic Data Expansion Plan

Date: 2026-06-11

## Strategic Objective

Democracy should evolve from a parliamentary bill tracker into a civic operating system for direct public decision-making. The long-term product direction is to digitise democratic participation so people can deliberate, vote, audit power, and coordinate around public decisions directly.

The platform must not imply official electoral authority unless it has a lawful mandate to do so. The safe framing is:

- make representation continuously auditable;
- make public will visible before and after institutional decisions;
- let people self-organise around bills, budgets, services, planning, and local issues;
- reduce dependency on representatives where lawful direct participation, delegation, petitions, referendums, consultations, or civic mandates can operate;
- preserve privacy, legitimacy, provenance, and coercion resistance.

## Product Experience Principles

The product must be accessible to people who are new to politics. Most users should not need to understand parliamentary procedure, local government tiers, fiscal rules, tax bands, or policy jargon before they can act.

Design for:

- plain-English explanations before institutional terminology;
- "why this matters to you" summaries for every issue, bill, tax, budget, service, and planning item;
- progressive disclosure from simple summaries into source documents, charts, methods, and raw data;
- glossary-backed terms for concepts such as division, precept, deficit, fiscal drag, marginal tax, local plan, statutory instrument, and committee stage;
- confidence and caveat labels that are understandable without statistical training;
- mobile-first reading, voting, comparing, and sharing.

Gamification is appropriate when it increases civic literacy, participation, or follow-through without trivialising politics. Avoid manipulative streak mechanics around sensitive political choices. Prefer civic mastery and contribution loops:

- civic literacy levels;
- source-reading badges;
- "understood the issue" checkpoints;
- deliberation quality rewards;
- local knowledge quests;
- budget-balancing challenges;
- policy trade-off simulations;
- representative-alignment discoveries;
- community contribution milestones;
- non-partisan election readiness checklists.

## Compass And Aggregation Principles

As many features and data sources as reasonably possible should be scored against the political compass, while making clear that compass scores are analytical aids rather than truth claims.

Compass-score candidates:

- bills, amendments, statutory instruments, and policy proposals;
- public comments, arguments, and debate clusters;
- media articles and source framing;
- council plans, local budget priorities, and planning applications;
- department consultations and policy papers;
- party manifestos, candidate statements, councillor statements, and ministerial claims;
- tax and spending measures, including their distributional effects;
- public mandate aggregates.

Every score should store:

- source text or data slice;
- model/version;
- prompt/method;
- timestamp;
- confidence;
- explanation;
- uncertainty or disagreement;
- reviewer override where applicable.

All data should roll up into interesting views, not sit as isolated datasets. Each source integration should define at least one aggregate:

- by person: my postcode, my ward, my constituency, my income/household scenario, my representatives;
- by place: ward, council, constituency, region, nation;
- by issue: housing, tax, migration, health, transport, climate, education, policing, welfare;
- by institution: council, department, agency, Parliament, committee, regulator;
- by time: before/after vote, budget year, forecast vs outturn, election cycle, policy lifecycle;
- by ideology: compass clusters, alignment gaps, argument distribution, media framing distribution;
- by trust: source quality, transparency, confidence, completeness, auditability.

## Source Strategy

Prefer authoritative sources first, then maintained civic infrastructure, then council- or department-specific scraping only where no canonical source exists.

Every imported dataset should store:

- source URL;
- source owner;
- licence;
- import timestamp;
- upstream update cadence;
- geographic scope;
- newcomer explanation;
- compass-score potential;
- aggregate-view potential;
- provenance confidence;
- known caveats;
- schema version;
- whether the source is official, civic-maintained, commercial, or scraped.

## Local Government Data Sources

### Civic Geography

Primary sources:

- [GOV.UK Find your local council](https://www.gov.uk/find-local-council): postcode-to-council lookup and council website discovery.
- [Postcodes.io](https://api.postcodes.io/): UK postcode validation, geolocation, and administrative/geospatial attributes. The service is open source and reports regular updates from Ordnance Survey and ONS data.
- [mySociety MapIt](https://mapit.mysociety.org/): postcode or point-to-boundary API for constituencies, councils, parishes, counties, and related areas.
- [Ordnance Survey Boundary-Line](https://www.ordnancesurvey.co.uk/products/boundary-line): administrative and electoral boundaries for Great Britain, updated twice yearly, available as download/API in geospatial formats.
- [ONS Open Geography Portal](https://geoportal.statistics.gov.uk/): statistical geographies, administrative boundaries, lookup files, ONS Postcode Directory, ONS UPRN Directory, and geographic code registers.

Feature implications:

- postcode-based civic profile;
- local authority, ward/division, parish/town council, combined authority, police area, planning authority, Westminster constituency, and devolved-legislature mapping;
- "who is responsible for what here?" explanations;
- local maps for wards, councils, authorities, planning areas, and service responsibility.

### Council Structure And Responsibilities

Primary source:

- [GOV.UK Understand how your council works](https://www.gov.uk/understand-how-your-council-works): explains English council types and service responsibilities.

Feature implications:

- plain-English local power map;
- service-responsibility routing for bins, roads, schools, social care, planning, libraries, transport, housing, council tax, and parish/town services;
- council-type-aware navigation so users do not blame the wrong authority.

### Local Elections, Candidates, Ballot Papers, And Results

Primary civic source:

- [Democracy Club Data and APIs](https://democracyclub.org.uk/projects/data/): election lookup, ballot papers by postcode, boundary-change tracking, polling station data, candidates for district councils and above, historical candidate data back to 2010, and candidate results where available.

Feature implications:

- "Who can I vote for locally?";
- election calendar and reminders;
- candidate comparison pages;
- local election history;
- ward and council result trends;
- polling-station lookup;
- candidate accountability after election.

### Councillors, Council Control, Parties, And Compositions

Primary civic source:

- [Open Council Data UK](https://opencouncildata.co.uk/): councillors, parties, council compositions, control, by-elections, party trackers, and council changes.

Feature implications:

- current council control;
- ruling party or coalition;
- councillor roster by ward;
- vacancies and defections;
- council composition timeline;
- "my councillors" profile cards.

Caveat: treat Open Council Data UK as maintained civic/private infrastructure, not as an official statutory source. Store provenance clearly and cross-check high-risk facts against council websites where possible.

### Local Finance, Council Tax, And Transparency

Primary sources:

- [Local authority revenue expenditure and financing](https://www.gov.uk/government/collections/local-authority-revenue-expenditure-and-financing): MHCLG/GOV.UK official statistics for local authority revenue expenditure, financing, budgets, outturns, and individual authority data.
- [Council Tax statistics](https://www.gov.uk/government/collections/council-tax-statistics): council tax levels, collection rates, non-domestic rates, and town/parish precepts.
- [Local government transparency code 2015](https://www.gov.uk/government/publications/local-government-transparency-code-2015): minimum datasets local authorities should publish, frequency, and publication method.

Feature implications:

- "where does my council tax go?";
- local budget and spending trend explainer;
- council tax band and precept breakdown;
- local financial risk indicators;
- spending per resident;
- comparisons against similar authorities;
- transparency-code compliance score.

### Procurement And Contracts

Primary sources:

- [Contracts Finder](https://www.gov.uk/contracts-finder): contract opportunities and awards over GBP 12,000 including VAT for UK government and agencies, with links to devolved procurement portals.
- Council transparency-code publications for spend over GBP 500, where available.

Feature implications:

- local contract search;
- supplier concentration views;
- upcoming procurement alerts;
- recurring vendor detection;
- spend-to-outcome analysis;
- local "follow the money" pages.

Caveat: local spend-over-500 data is fragmented across council websites and formats. Treat as a later ingestion phase unless a council exposes structured data.

### Planning And Housing

Primary source:

- [Planning Data](https://www.planning.data.gov.uk/): England planning and housing data platform with search, map, bulk downloads, and API. Datasets include local authority districts, local planning authorities, wards, planning applications, brownfield land, local plans, conservation areas, listed buildings, tree preservation zones, developer agreements, infrastructure funding statements, and related planning/housing categories.

Feature implications:

- local planning alerts;
- "what is changing near me?";
- planning application summaries;
- map overlays for development, conservation, green belt, flood risk, heritage, and transport nodes;
- local-plan explainers;
- citizen deliberation and vote surfaces around applications and plans;
- developer contribution and infrastructure funding tracker.

Caveat: the platform warns that coverage may be incomplete and not yet all of England. Store coverage status per dataset and local planning authority.

### Public Realm Issue Signals

Primary civic source:

- [FixMyStreet reports dashboard](https://www.fixmystreet.com/reports): public issue reports and aggregate dashboards for potholes, fly-tipping, graffiti, and other local problems.

Feature implications:

- neighbourhood issue heatmaps;
- reported-vs-fixed indicators;
- local issue trend alerts;
- service responsiveness metrics;
- issue-to-debate flow;
- issue-to-councillor/council accountability.

Caveat: reports measure user behaviour and platform coverage as well as real-world problems. Do not treat them as objective incidence counts without caveats.

### Meetings, Agendas, Minutes, Decisions, And Council Votes

Current state:

- No clean national equivalent of Parliament APIs was found for council meetings, motions, amendments, votes, and minutes.
- Many councils publish agendas and minutes on their own sites, often through heterogeneous committee-management systems.

Feature implications:

- local meeting ingestion should start with pilots;
- scrape or integrate one council system at a time;
- normalize agendas, reports, decisions, motions, attendance, and recorded votes;
- use AI summarization only with citations to source documents;
- add council meeting records after proving source reliability.

## Central Government And Departmental Data Sources

### Cross-Government Discovery

Primary sources:

- [GOV.UK departments, agencies and public bodies](https://www.gov.uk/government/organisations): canonical organisation directory. It listed 24 ministerial departments when checked.
- [GOV.UK research and statistics search](https://www.gov.uk/search/research-and-statistics): searchable index for published statistics, upcoming statistics, cancelled statistics, and research. It listed over 100,000 research and statistics results when checked.
- [data.gov.uk / National Data Library](https://www.data.gov.uk/): curated public data collections covering business/economy, environment, government, land/property, people, transport, and early years. The government collection explicitly includes election results, local government finance, and Council Tax.

Feature implications:

- department profile pages;
- departmental policy and statistics feed;
- "what evidence does this department publish?";
- source registry by department;
- cross-department data coverage map;
- policy-to-data lineage for claims made by ministers or departments.

### Parliament And Legislation

Primary sources:

- [UK Parliament Developer Hub](https://developer.parliament.uk/): open APIs under the Open Parliament Licence.
- [Bills API](https://bills-api.parliament.uk/): bill data for both Houses.
- [Commons Votes API](https://commonsvotes-api.parliament.uk/): Commons division and voting data.
- Other Parliament APIs listed by the Developer Hub include Members, Lords Votes, oral questions and motions, statutory instruments, treaties, Erskine May, Parliament Now, written questions/statements, and committees.
- [legislation.gov.uk](https://www.legislation.gov.uk/): official UK legislation service. Direct developer-page access may be gated by browser verification, but the site remains the canonical legislation source.

Feature implications:

- lawmaking timeline from bill introduction to act and statutory instruments;
- vote alignment by MP, party, constituency, and public sentiment;
- committee inquiry tracker;
- written question tracker;
- ministerial answer accountability;
- statutory instrument watchlist;
- "what changed in law?" explainers.

### National Statistics And Social/Economic Indicators

Primary sources:

- [ONS Developer Hub](https://developer.ons.gov.uk/): open, unrestricted API at `https://api.beta.ons.gov.uk/v1` with no API keys required. Supports dataset filtering and observation access.
- [ONS API datasets endpoint](https://api.beta.ons.gov.uk/v1/datasets): programmatic dataset catalogue including national, local-authority, economic, health, business, wellbeing, trade, and real-time indicators.
- [ONS Open Geography Portal](https://geoportal.statistics.gov.uk/): boundaries, codes, and geographic lookup infrastructure.

Feature implications:

- constituency/local-authority/national indicator pages;
- public-will vs socioeconomic reality dashboards;
- local wellbeing, health, business, population, labour, death, trade, and tax-benefit context;
- data-backed AI explainers for "what is happening in this place?";
- comparable places and peer-authority analysis.

### Fiscal Data And Public Finances

Primary sources:

- [OBR Data](https://obr.uk/data/): public finance databanks, historical forecasts, ready reckoners, long-term determinants, policy measures, uncertainty ratings, forecast revisions, policy risks, and supplementary data.
- [OBR Economic and fiscal outlook March 2026](https://obr.uk/efo/economic-and-fiscal-outlook-march-2026/): five-year economy, receipts, spending, borrowing, debt, fiscal risks, policy measures, charts, tables, and detailed forecast spreadsheets.
- [HM Treasury PESA](https://www.gov.uk/government/collections/public-expenditure-statistical-analyses-pesa): annual public expenditure statistical analyses with outturns, current estimates, and spending plans.
- [HM Treasury Country and regional analysis](https://www.gov.uk/government/collections/country-and-regional-analysis): identifiable expenditure by UK countries and English regions.
- [Whole of Government Accounts](https://www.gov.uk/government/collections/whole-of-government-accounts): consolidated UK public-sector financial statements. WGA consolidates audited accounts of over 10,000 public-sector organisations and supports scrutiny and long-term fiscal analysis.

Feature implications:

- national fiscal dashboard;
- "what does this policy cost?";
- tax, spending, borrowing, and debt explainer;
- OBR forecast vs outturn tracker;
- policy-costing confidence and uncertainty;
- fiscal-risk register;
- regional spending map;
- "budget simulator" for citizens;
- long-run fiscal history explorer;
- debt-interest sensitivity tool;
- department spending plan tracker.

### Tax, Welfare, And Household Impact

Likely sources to integrate:

- OBR policy measures, ready reckoners, uncertainty ratings, and receipts/spending forecasts.
- ONS tax-benefits datasets and income distribution datasets through the ONS API.
- HMRC statistics pages for receipts, tax gaps, tax reliefs, income tax, National Insurance, VAT, corporation tax, customs, and trade where public structured files exist.
- DWP Stat-Xplore and DWP statistics for Universal Credit, benefits, pensions, sanctions, and labour-market support.

Feature implications:

- household impact modelling;
- "how would this tax/spending change affect people like me?";
- benefit and tax-credit policy trackers;
- tax-gap and enforcement dashboard;
- welfare trends explainer;
- distributional analysis by income, region, household type, and age.
- tax burden and benefit incidence views written for laypeople;
- side-by-side examples for workers, renters, homeowners, landlords, pensioners, small businesses, high earners, asset owners, and people receiving benefits;
- plain-English explanation of marginal rates, effective rates, fiscal drag, thresholds, allowances, reliefs, employer taxes, VAT, excise duties, capital gains, inheritance tax, and council tax;
- "who pays, who benefits, who is exempt, and who can plan around it?" charts using official aggregate data;
- tax-relief and tax-gap explainers that show scale, winners, losers, and policy choices without using loaded language;
- compass scoring for tax/spending measures based on distributional effect, state capacity, market intervention, redistribution, and behavioural incentives.

Caveat: never store individual tax, benefit, health, or identity records. Use only public aggregate data unless a lawful, privacy-preserving, consented workflow exists.

HMRC and tax data should be especially accessible. The product should help laypeople understand how the tax system works and where burdens fall by showing neutral, source-backed comparisons rather than asserting conclusions. Let patterns become visible through charts, examples, and aggregate views:

- effective tax by income source;
- work income vs asset income comparisons;
- employee vs self-employed vs company-owner examples;
- household lifecycle examples;
- cliff edges, thresholds, and withdrawal-rate traps;
- tax relief distribution by income group or sector where public data supports it;
- council tax as a share of property value or income;
- VAT and excise effects on lower- and higher-income households;
- tax gap by behaviour type, taxpayer segment, and enforcement route;
- public service received vs taxes paid as an exploratory model with strong caveats.

Avoid saying "the tax system is unfair" as platform voice. Instead, present official aggregates, simple scenarios, and distributional comparisons that allow users to see and debate fairness themselves.

### Departmental And Sector Data Themes

Candidate department/source areas:

- Department for Transport, National Highways, DVLA, ORR, rail, roads, public transport, accident and congestion statistics.
- Department for Education, school performance, school funding, Ofsted, attendance, exclusions, SEND, early years, apprenticeship and skills data.
- Department of Health and Social Care, NHS England, UKHSA, CQC, public health, waiting times, hospital performance, social care and medicines data.
- Department for Environment, Food and Rural Affairs, Environment Agency, flood risk, water quality, air quality, waste, farming, biodiversity, land management, permits.
- Department for Energy Security and Net Zero, energy generation, tariffs, fuel poverty, emissions, grid, climate and decarbonisation datasets.
- Department for Business and Trade, Companies House, insolvency, imports/exports, business counts, subsidy and trade remedy data.
- Home Office, police recorded crime, immigration/asylum statistics, fire statistics, public safety data.
- Ministry of Justice, courts, tribunals, prisons, probation, legal aid, sentencing, reoffending data.
- Ministry of Defence, procurement, spending, equipment, veterans, armed forces statistics.
- Department for Work and Pensions, benefits, pensions, Universal Credit, labour market support, disability and sanctions statistics.
- Ministry of Housing, Communities and Local Government, local government finance, housing, planning, homelessness, council tax, devolution and regional development.

Feature implications:

- public service observability;
- evidence-backed policy pages;
- department scorecards;
- service performance maps;
- "claim checker" for ministerial statements;
- mandate tracking: what the public voted for vs what departments delivered;
- departmental backlog and risk dashboards;
- cross-policy impact maps.

## Product Features To Add

### Local Democracy Features

1. My Local Democracy dashboard
   - postcode-based authority, ward, representatives, responsibilities, elections, issues, planning, council tax, and local spending.
   - newcomer mode explains each institution and shows one useful next action.

2. Council profile pages
   - control, composition, councillors, executive model, committees, elections, budgets, contracts, transparency score, and service responsibilities.
   - aggregate up to comparable council rankings, service responsibility maps, and local ideological/fiscal profiles.

3. Local representative accountability
   - councillor profiles, attendance where available, declared roles, committee memberships, public issue alignment, and response history.

4. Local election workspace
   - candidates, ballot papers, polling locations, past results, ward changes, and post-election accountability.

5. Planning lens
   - planning applications, local plans, brownfield land, conservation, tree preservation, listed buildings, flood risk, and citizen debate/vote surfaces.

6. Council tax and budget explainer
   - where money comes from, where it goes, what changed, how the authority compares, and which trade-offs citizens prefer.
   - use simple household examples and gamified budget-balancing challenges.

7. Local issue tracker
   - public-realm reports, service responsiveness, issue heatmaps, debate, voting, and escalation to the responsible authority.

8. Local meeting pilot
   - council agenda/minute ingestion for selected councils, with citation-backed AI summaries and decision extraction.

### National Democracy Features

1. Department pages
   - remit, ministers, agencies, budget, datasets, statistics, consultations, open risks, current legislation, and delivery metrics.

2. Policy cost and fiscal impact engine
   - join bill/policy proposals to OBR policy measures, PESA spending categories, departmental budgets, tax receipts, and debt/borrowing projections.

3. Budget simulator
   - let users adjust taxes, spending, borrowing, debt targets, and departmental budgets; show OBR-style caveats and uncertainty.
   - include guided "balance the budget" and "fund this promise" modes for people new to fiscal policy.

4. Forecast vs reality tracker
   - compare OBR forecasts, Treasury plans, ONS outturns, and actual delivery.

5. Fiscal risk dashboard
   - surface OBR policy risks, long-term pressures, debt-interest sensitivity, demographic pressure, climate risk, and welfare trends.

6. Public mandate ledger
   - for each bill, budget, planning decision, service change, or departmental priority: show public vote, representative vote, department action, spending consequence, and outcome indicators.
   - aggregate up to public-vs-representative alignment by issue, place, party, department, and compass quadrant.

7. Ministerial claim checker
   - attach claims to source datasets, official statistics, policy documents, and observed outcomes. Mark source confidence and update when data changes.

8. Participatory budgeting
   - local and national budget allocation exercises, with privacy-preserving public aggregates and explicit non-binding/official status.

9. Delegable direct democracy
   - issue-by-issue citizen mandates, liquid delegation, revocable proxies, deliberation rooms, and aggregate public positions. This should be designed as civic self-organisation first, and only treated as legally binding where a jurisdiction adopts it.

10. Civic API
   - public read API for sources, aggregates, representative alignment, public sentiment, budget simulations, and data provenance.

## Architecture Notes

Add data model families for:

- `source_registry`
- `source_import_runs`
- `source_scores`
- `geographies`
- `geography_relationships`
- `public_bodies`
- `public_body_responsibilities`
- `representatives`
- `representative_terms`
- `elections`
- `ballot_papers`
- `candidates`
- `council_compositions`
- `budgets`
- `spending_lines`
- `tax_lines`
- `fiscal_forecasts`
- `policy_costings`
- `policy_risks`
- `contracts`
- `planning_entities`
- `public_issues`
- `consultations`
- `meeting_documents`
- `decision_records`
- `public_mandates`
- `aggregate_snapshots`
- `aggregate_views`
- `compass_scores`
- `user_civic_progress`
- `civic_explainers`

Use stable external identifiers wherever possible:

- ONS/GSS geography codes;
- Parliament IDs;
- Democracy Club election/candidate IDs;
- Companies House company numbers;
- GOV.UK organisation slugs;
- OBR publication/version identifiers;
- official document URLs;
- source-specific planning and procurement IDs.

## Privacy And Trust Constraints

- Political views, votes, postcode, ward, identity verification, and participation history are sensitive.
- Never expose individual political behaviour.
- Use small-cell suppression and privacy thresholds for local aggregates.
- Keep ballot identity separated from ballot content.
- Use source provenance and confidence labels throughout.
- AI summaries must cite source documents and store model/version metadata.
- AI stance or compass scores are secondary analysis, never equivalent to a user's explicit vote.
- For fiscal and policy simulations, distinguish official forecasts, platform calculations, assumptions, and user-created scenarios.
- Gamification must reward learning, evidence use, deliberation quality, and civic follow-through, not ideological conformity or compulsive participation.
- Tax and welfare explainers must use official or clearly modelled aggregate data and avoid storing personal financial data unless a privacy-preserving user-owned scenario tool is explicitly built.

## Implementation Roadmap

### Phase 1: Local Civic Baseline

- Import local authority and ward geography.
- Resolve user postcode to local authorities and ward/division.
- Add council profile pages.
- Add councillor/council composition data.
- Add local election and candidate data.
- Add council tax and local finance explainer.

### Phase 2: Planning, Issues, And Local Accountability

- Import Planning Data datasets for selected authorities.
- Add planning application alerts and summaries.
- Add public issue reports and service responsiveness indicators.
- Add local vote/debate surfaces tied to planning and service issues.
- Add local transparency score.

### Phase 3: Central Government Data Spine

- Build department and public-body registry from GOV.UK.
- Import OBR databanks, policy measures, forecasts, uncertainty ratings, and risks.
- Import PESA, CRA, and WGA datasets.
- Connect Parliament bill/vote data to fiscal and departmental sources.
- Build policy cost and fiscal impact pages.

### Phase 4: Mandate And Simulation Layer

- Add participatory budget simulator.
- Add public mandate ledger.
- Add forecast-vs-reality tracker.
- Add issue-by-issue delegation and revocable proxy model.
- Add direct-democracy aggregate APIs.

### Phase 5: Meeting And Decision Extraction Pilots

- Select 3-5 councils with reliable agenda/minute systems.
- Ingest agendas, reports, decisions, attendance, and votes where available.
- Build citation-backed AI summaries.
- Normalize extracted decisions to public mandates, budgets, planning items, and service changes.
- Decide whether meeting ingestion can generalize nationally.

## Open Decisions

- Initial geography: England-only local government, or UK-wide with uneven data coverage?
- Should MapIt be used as a paid service, self-hosted, or replaced with ONS/Postcodes.io plus local boundary joins?
- Should Open Council Data UK be licensed as a core dependency or used only for prototypes?
- Which fiscal model depth is enough for launch: source-linked dashboards, simple budget simulator, or OBR-style scenario engine?
- How should liquid/delegable democracy be framed so it remains lawful, safe, and non-misleading?
- Which councils should be used for meeting/minutes pilots?
- What public mandate threshold should trigger representative/council/department notifications?

## Source Links

- [GOV.UK Find your local council](https://www.gov.uk/find-local-council)
- [GOV.UK Understand how your council works](https://www.gov.uk/understand-how-your-council-works)
- [Postcodes.io](https://api.postcodes.io/)
- [mySociety MapIt](https://mapit.mysociety.org/)
- [Ordnance Survey Boundary-Line](https://www.ordnancesurvey.co.uk/products/boundary-line)
- [ONS Open Geography Portal](https://geoportal.statistics.gov.uk/)
- [Democracy Club Data and APIs](https://democracyclub.org.uk/projects/data/)
- [Open Council Data UK](https://opencouncildata.co.uk/)
- [Local authority revenue expenditure and financing](https://www.gov.uk/government/collections/local-authority-revenue-expenditure-and-financing)
- [Council Tax statistics](https://www.gov.uk/government/collections/council-tax-statistics)
- [Local government transparency code 2015](https://www.gov.uk/government/publications/local-government-transparency-code-2015)
- [Contracts Finder](https://www.gov.uk/contracts-finder)
- [Planning Data](https://www.planning.data.gov.uk/)
- [FixMyStreet reports](https://www.fixmystreet.com/reports)
- [GOV.UK departments, agencies and public bodies](https://www.gov.uk/government/organisations)
- [GOV.UK research and statistics](https://www.gov.uk/search/research-and-statistics)
- [data.gov.uk / National Data Library](https://www.data.gov.uk/)
- [UK Parliament Developer Hub](https://developer.parliament.uk/)
- [Bills API](https://bills-api.parliament.uk/)
- [Commons Votes API](https://commonsvotes-api.parliament.uk/)
- [legislation.gov.uk](https://www.legislation.gov.uk/)
- [ONS Developer Hub](https://developer.ons.gov.uk/)
- [ONS API datasets](https://api.beta.ons.gov.uk/v1/datasets)
- [OBR Data](https://obr.uk/data/)
- [OBR Economic and fiscal outlook March 2026](https://obr.uk/efo/economic-and-fiscal-outlook-march-2026/)
- [HM Treasury PESA](https://www.gov.uk/government/collections/public-expenditure-statistical-analyses-pesa)
- [HM Treasury Country and regional analysis](https://www.gov.uk/government/collections/country-and-regional-analysis)
- [Whole of Government Accounts](https://www.gov.uk/government/collections/whole-of-government-accounts)
