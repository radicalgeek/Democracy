import type postgres from "postgres";

type Sql = postgres.Sql<Record<string, unknown>>;

type SourceSeed = {
  id: string;
  name: string;
  category: string;
  scope: string;
  owner: string;
  url: string;
  licence: string;
  officialStatus: string;
  refreshCadence: string;
  newcomerExplanation: string;
  compassScorePotential: string;
  aggregateViewPotential: string;
  caveats: string;
  metadata?: postgres.JSONValue;
};

const sources: SourceSeed[] = [
  {
    id: "postcodes-io",
    name: "Postcodes.io",
    category: "local-geography",
    scope: "UK",
    owner: "Ideal Postcodes open-source service",
    url: "https://api.postcodes.io/",
    licence: "MIT / open data inputs",
    officialStatus: "civic-maintained",
    refreshCadence: "Updated when OS and ONS data changes",
    newcomerExplanation: "Turns a postcode into places people recognise: council, ward, region and coordinates.",
    compassScorePotential: "Low directly; high as a join key for place-based compass aggregates.",
    aggregateViewPotential: "Personal dashboard, ward/council/constituency rollups, local issue maps.",
    caveats: "Not an official government service; use ONS/OS source provenance for high-risk geography."
  },
  {
    id: "mapit",
    name: "mySociety MapIt",
    category: "local-geography",
    scope: "UK",
    owner: "mySociety",
    url: "https://mapit.mysociety.org/",
    licence: "Service-specific terms",
    officialStatus: "civic-maintained",
    refreshCadence: "Maintained boundary service",
    newcomerExplanation: "Answers the practical question: which public bodies are responsible for this place?",
    compassScorePotential: "Low directly; high for geographic aggregation of scored issues.",
    aggregateViewPotential: "Power maps, representative lookup, service responsibility routing.",
    caveats: "May require paid or self-hosted use at scale."
  },
  {
    id: "os-boundary-line",
    name: "Ordnance Survey Boundary-Line",
    category: "local-geography",
    scope: "Great Britain",
    owner: "Ordnance Survey",
    url: "https://www.ordnancesurvey.co.uk/products/boundary-line",
    licence: "Free OS product terms",
    officialStatus: "official",
    refreshCadence: "Twice yearly",
    newcomerExplanation: "The map layer that lets people see councils, wards and other boundaries.",
    compassScorePotential: "Low directly; high for map-based ideological and mandate layers.",
    aggregateViewPotential: "Ward maps, council comparison maps, regional mandate maps.",
    caveats: "Great Britain coverage; Northern Ireland needs separate boundary handling."
  },
  {
    id: "democracy-club",
    name: "Democracy Club Data and APIs",
    category: "local-elections",
    scope: "UK",
    owner: "Democracy Club",
    url: "https://democracyclub.org.uk/projects/data/",
    licence: "Service-specific terms",
    officialStatus: "civic-maintained",
    refreshCadence: "Election-cycle driven",
    newcomerExplanation: "Shows which elections are coming up and who is on the ballot.",
    compassScorePotential: "High for candidate statements, parties and election issues.",
    aggregateViewPotential: "Election readiness, candidate comparison, local accountability timelines.",
    caveats: "Candidate richness depends on nominations, crowdsourcing and source verification."
  },
  {
    id: "open-council-data",
    name: "Open Council Data UK",
    category: "local-representation",
    scope: "UK councils",
    owner: "Lawson Data Services Ltd",
    url: "https://opencouncildata.co.uk/",
    licence: "Mixed free/paid datasets",
    officialStatus: "civic-maintained",
    refreshCadence: "Frequent manual/data updates",
    newcomerExplanation: "Explains who runs a council and which parties hold the seats.",
    compassScorePotential: "Medium for council control and party composition.",
    aggregateViewPotential: "Council control maps, party balance trends, councillor vacancy views.",
    caveats: "Not official; cross-check important records against council sites."
  },
  {
    id: "planning-data",
    name: "Planning Data",
    category: "planning",
    scope: "England",
    owner: "Ministry of Housing, Communities and Local Government",
    url: "https://www.planning.data.gov.uk/",
    licence: "Open Government Licence v3.0 unless stated",
    officialStatus: "official",
    refreshCadence: "Dataset/provider dependent",
    newcomerExplanation: "Shows what may be built or protected near someone and why it matters.",
    compassScorePotential: "High for housing, development, conservation and local growth trade-offs.",
    aggregateViewPotential: "Planning alerts, development pressure maps, local-plan debate clusters.",
    caveats: "Coverage is incomplete and improving; store dataset coverage by authority."
  },
  {
    id: "local-finance",
    name: "Local authority revenue expenditure and financing",
    category: "local-finance",
    scope: "England",
    owner: "MHCLG / GOV.UK",
    url: "https://www.gov.uk/government/collections/local-authority-revenue-expenditure-and-financing",
    licence: "Open Government Licence v3.0",
    officialStatus: "official statistics",
    refreshCadence: "Annual / release dependent",
    newcomerExplanation: "Shows what councils spend money on and where that money comes from.",
    compassScorePotential: "High for spending priorities and redistribution/service-state trade-offs.",
    aggregateViewPotential: "Council tax explainers, council peer comparisons, budget simulations.",
    caveats: "Finance categories need plain-English translation before public use."
  },
  {
    id: "council-tax",
    name: "Council Tax statistics",
    category: "tax",
    scope: "England",
    owner: "MHCLG / GOV.UK",
    url: "https://www.gov.uk/government/collections/council-tax-statistics",
    licence: "Open Government Licence v3.0",
    officialStatus: "official statistics",
    refreshCadence: "Annual / release dependent",
    newcomerExplanation: "Shows the local tax bill people actually receive and how it changes.",
    compassScorePotential: "High for property, income, local-service and precept debates.",
    aggregateViewPotential: "Council tax burden maps, band examples, precept breakdowns.",
    caveats: "Council tax is property-band based, not a full household ability-to-pay model."
  },
  {
    id: "obr-data",
    name: "OBR Data",
    category: "fiscal",
    scope: "UK",
    owner: "Office for Budget Responsibility",
    url: "https://obr.uk/data/",
    licence: "OBR published data terms",
    officialStatus: "official independent fiscal data",
    refreshCadence: "Forecast/release dependent",
    newcomerExplanation: "Shows what the fiscal watchdog thinks taxes, spending, debt and risks look like.",
    compassScorePotential: "High for tax/spending policies, fiscal risk and state capacity.",
    aggregateViewPotential: "Forecast-vs-reality, budget simulator, policy cost ledger.",
    caveats: "Forecasts are uncertain and must be labelled as forecasts, not facts."
  },
  {
    id: "hmt-pesa",
    name: "HM Treasury PESA",
    category: "fiscal",
    scope: "UK",
    owner: "HM Treasury",
    url: "https://www.gov.uk/government/collections/public-expenditure-statistical-analyses-pesa",
    licence: "Open Government Licence v3.0",
    officialStatus: "accredited official statistics",
    refreshCadence: "Annual",
    newcomerExplanation: "Shows what government spends by department, function and year.",
    compassScorePotential: "High for spending-priority and state-size comparisons.",
    aggregateViewPotential: "Department spend tracker, national budget explorer, issue spend maps.",
    caveats: "Treasury categories need translation and can differ from public service labels."
  },
  {
    id: "hmt-cra",
    name: "HM Treasury Country and regional analysis",
    category: "fiscal",
    scope: "UK countries and English regions",
    owner: "HM Treasury",
    url: "https://www.gov.uk/government/collections/country-and-regional-analysis",
    licence: "Open Government Licence v3.0",
    officialStatus: "accredited official statistics",
    refreshCadence: "Annual",
    newcomerExplanation: "Shows where identifiable public spending lands across the UK.",
    compassScorePotential: "Medium-high for regional redistribution and levelling-up debates.",
    aggregateViewPotential: "Regional spending maps, place fairness views, spending per head.",
    caveats: "Identifiable expenditure is not the same as all benefit received by residents."
  },
  {
    id: "wga",
    name: "Whole of Government Accounts",
    category: "fiscal",
    scope: "UK public sector",
    owner: "HM Treasury",
    url: "https://www.gov.uk/government/collections/whole-of-government-accounts",
    licence: "Open Government Licence v3.0",
    officialStatus: "official public-sector accounts",
    refreshCadence: "Annual",
    newcomerExplanation: "Shows the public sector like one giant set of accounts: assets, liabilities and risks.",
    compassScorePotential: "Medium for debt, assets, liabilities and intergenerational trade-offs.",
    aggregateViewPotential: "Public balance sheet, debt/risk dashboard, long-term fiscal views.",
    caveats: "Accounting concepts need careful beginner explanations."
  },
  {
    id: "ons-api",
    name: "ONS API",
    category: "statistics",
    scope: "UK",
    owner: "Office for National Statistics",
    url: "https://developer.ons.gov.uk/",
    licence: "Open Government Licence v3.0 unless stated",
    officialStatus: "official statistics API",
    refreshCadence: "Dataset dependent",
    newcomerExplanation: "Provides the numbers behind population, economy, health, work and place.",
    compassScorePotential: "Medium; high when joined to policy outcomes and place-based mandates.",
    aggregateViewPotential: "Place indicators, outcome dashboards, policy evidence pages.",
    caveats: "The beta API can change; store dataset versions and release dates."
  },
  {
    id: "hmrc-statistics",
    name: "HMRC statistics",
    category: "tax",
    scope: "UK",
    owner: "HM Revenue and Customs",
    url: "https://www.gov.uk/government/organisations/hm-revenue-customs/about/statistics",
    licence: "Open Government Licence v3.0 unless stated",
    officialStatus: "official statistics",
    refreshCadence: "Dataset dependent",
    newcomerExplanation: "Shows how the tax system raises money, who pays through which routes, and where gaps appear.",
    compassScorePotential: "High for distribution, incentives, enforcement, avoidance and state capacity.",
    aggregateViewPotential: "Tax burden explainers, relief distribution, tax gap and income-source comparisons.",
    caveats: "Use aggregate data only; avoid personal tax records and avoid editorial claims in platform voice."
  }
];

const POSTCODES_API = "https://api.postcodes.io/postcodes";

const localLayers = [
  {
    id: "who-runs-my-place",
    title: "Who runs my place?",
    layerType: "responsibility",
    summary: "Postcode-to-authority lookup, ward mapping and plain-English service responsibilities.",
    sourceId: "postcodes-io",
    beginnerLabel: "Start here: see the public bodies that affect your day-to-day life.",
    gamifiedAction: "Complete the local power map by identifying who handles bins, roads, planning and schools.",
    compassPotential: "Score local public priorities once people vote on service trade-offs.",
    aggregateView: "Rolls up to place power maps by postcode, ward, council and constituency.",
    status: "implemented-spine",
    sortOrder: 1
  },
  {
    id: "local-election-readiness",
    title: "Local election readiness",
    layerType: "elections",
    summary: "Election calendar, ballot papers, candidates, polling station context and past results.",
    sourceId: "democracy-club",
    beginnerLabel: "Know who is asking for power before polling day.",
    gamifiedAction: "Election-ready checklist: candidates viewed, polling place checked, one issue compared.",
    compassPotential: "Score candidate statements and party promises where source text exists.",
    aggregateView: "Rolls up to candidate maps, ward result history and public mandate gaps.",
    status: "planned",
    sortOrder: 2
  },
  {
    id: "council-money",
    title: "Council money",
    layerType: "finance",
    summary: "Council tax, service spend, local finance trends and peer comparisons.",
    sourceId: "local-finance",
    beginnerLabel: "See where the local bill goes without learning public finance first.",
    gamifiedAction: "Balance a council budget while preserving the services you care about.",
    compassPotential: "Score service and tax trade-offs by redistribution, local autonomy and state capacity.",
    aggregateView: "Rolls up to council tax burden, service spend, and peer-authority dashboards.",
    status: "implemented-spine",
    sortOrder: 3
  },
  {
    id: "planning-near-me",
    title: "Planning near me",
    layerType: "planning",
    summary: "Planning applications, local plans, brownfield land, protected places and developer contributions.",
    sourceId: "planning-data",
    beginnerLabel: "Understand what might change near your home and how to respond.",
    gamifiedAction: "Review one proposal: what changes, who benefits, who bears the cost?",
    compassPotential: "Score housing, growth, conservation and community-control arguments.",
    aggregateView: "Rolls up to development pressure maps and local-plan debate clusters.",
    status: "planned",
    sortOrder: 4
  }
];

const fiscalIndicators = [
  {
    id: "forecast-vs-reality",
    title: "Forecast vs reality",
    plainEnglish: "Compare what government expected to happen with what actually happened.",
    sourceId: "obr-data",
    period: "Forecast cycle",
    valueLabel: "Forecast, outturn and revision",
    trendLabel: "Shows whether plans survived contact with reality",
    whyItMatters: "Promises are easier to judge when forecasts, revisions and outcomes are side by side.",
    compassPotential: "Scores fiscal claims by state capacity, intervention, redistribution and risk tolerance.",
    aggregateView: "Rolls up to policy trust, department delivery and budget credibility views.",
    status: "implemented-spine",
    sortOrder: 1
  },
  {
    id: "where-spending-goes",
    title: "Where spending goes",
    plainEnglish: "Translate Treasury spending categories into public services people recognise.",
    sourceId: "hmt-pesa",
    period: "Annual",
    valueLabel: "Spend by service and department",
    trendLabel: "Shows what is growing, shrinking or being protected",
    whyItMatters: "The public can only set priorities if the budget is readable.",
    compassPotential: "Scores spending choices by state size, redistribution and social investment.",
    aggregateView: "Rolls up to issue budgets, department scorecards and public budget simulators.",
    status: "implemented-spine",
    sortOrder: 2
  },
  {
    id: "regional-spending",
    title: "Regional spending",
    plainEnglish: "Show where identifiable public spending lands across the UK.",
    sourceId: "hmt-cra",
    period: "Annual",
    valueLabel: "Spend by region/country",
    trendLabel: "Shows geographic balance and imbalance",
    whyItMatters: "People can compare local need, local contribution and visible investment.",
    compassPotential: "Scores place redistribution, centralisation and regional investment arguments.",
    aggregateView: "Rolls up to regional fairness maps and constituency/council context panels.",
    status: "planned",
    sortOrder: 3
  },
  {
    id: "public-balance-sheet",
    title: "Public balance sheet",
    plainEnglish: "Treat the public sector as one set of accounts: assets, liabilities, income and risk.",
    sourceId: "wga",
    period: "Annual",
    valueLabel: "Assets, liabilities and long-term obligations",
    trendLabel: "Shows what is being built, owed or deferred",
    whyItMatters: "Debt is only one part of the story; assets and obligations matter too.",
    compassPotential: "Scores intergenerational trade-offs and public-asset strategy.",
    aggregateView: "Rolls up to long-run fiscal sustainability and public wealth dashboards.",
    status: "planned",
    sortOrder: 4
  }
];

const taxScenarios = [
  {
    id: "worker-vs-asset-owner",
    title: "Work income vs asset income",
    persona: "Employee and asset owner",
    plainEnglish: "Compare how pay, dividends, capital gains and property income move through different tax routes.",
    sourceIds: ["hmrc-statistics", "obr-data"],
    visiblePattern: "Different income sources can face different rates, thresholds and planning opportunities.",
    compassPotential: "High: exposes labour/capital, redistribution and market-power trade-offs.",
    aggregateView: "Rolls up to income-source burden maps and policy measure compass scores.",
    status: "implemented-spine",
    sortOrder: 1
  },
  {
    id: "threshold-traps",
    title: "Thresholds and cliff edges",
    persona: "Growing household income",
    plainEnglish: "Show where allowances, withdrawals and thresholds change the next pound someone earns.",
    sourceIds: ["hmrc-statistics", "ons-api"],
    visiblePattern: "A headline tax rate can hide a much higher effective rate in specific ranges.",
    compassPotential: "High: shows incentives, welfare design and fiscal drag.",
    aggregateView: "Rolls up to household impact modelling and budget simulator warnings.",
    status: "implemented-spine",
    sortOrder: 2
  },
  {
    id: "council-tax-burden",
    title: "Council tax as lived burden",
    persona: "Renter, homeowner and pensioner",
    plainEnglish: "Compare council tax by band, property value proxy and household income scenario.",
    sourceIds: ["council-tax", "local-finance"],
    visiblePattern: "Local tax can look very different when measured against income or property value.",
    compassPotential: "High: local services, property, income and fairness trade-offs.",
    aggregateView: "Rolls up to council tax maps, local budget challenges and household examples.",
    status: "planned",
    sortOrder: 3
  },
  {
    id: "tax-gap",
    title: "Tax gap by behaviour",
    persona: "Compliant taxpayer and non-compliance segments",
    plainEnglish: "Show where tax expected by law is not collected, grouped by behaviour and taxpayer segment.",
    sourceIds: ["hmrc-statistics"],
    visiblePattern: "The lost revenue is not one thing; error, avoidance, evasion and non-payment differ.",
    compassPotential: "High: enforcement capacity, trust, burden-sharing and institutional legitimacy.",
    aggregateView: "Rolls up to enforcement dashboards and public service opportunity-cost views.",
    status: "planned",
    sortOrder: 4
  }
];

const aggregateViews = [
  {
    id: "my-civic-map",
    title: "My civic map",
    viewType: "person",
    summary: "Everything relevant to a person from postcode to council, constituency, services, representatives and issues.",
    sourceIds: ["postcodes-io", "mapit", "os-boundary-line"],
    beginnerQuestion: "Who has power where I live?",
    compassLens: "Shows local mandate and issue clusters once votes exist.",
    routeHint: "/local",
    status: "implemented-spine",
    sortOrder: 1
  },
  {
    id: "tax-system-map",
    title: "Tax system map",
    viewType: "issue",
    summary: "A plain-language map of taxes by income source, household type, threshold and relief.",
    sourceIds: ["hmrc-statistics", "obr-data", "ons-api"],
    beginnerQuestion: "Why do different people seem to pay in different ways?",
    compassLens: "Distributional effects, incentives, redistribution and state capacity.",
    routeHint: "/fiscal",
    status: "implemented-spine",
    sortOrder: 2
  },
  {
    id: "public-money-flow",
    title: "Public money flow",
    viewType: "institution",
    summary: "How taxes become departmental budgets, local grants, services, contracts and outcomes.",
    sourceIds: ["obr-data", "hmt-pesa", "hmt-cra", "wga"],
    beginnerQuestion: "Where did the money go, and what changed?",
    compassLens: "Spending priorities by issue, department, place and ideology.",
    routeHint: "/fiscal",
    status: "planned",
    sortOrder: 3
  }
];

const compassSeeds = [
  {
    subjectType: "source",
    subjectId: "hmrc-statistics",
    x: -4.5,
    y: 2.0,
    label: "redistribution and enforcement lens",
    explanation: "Tax data is scored by who pays, who benefits, what behaviour is incentivised, and how much state capacity is required.",
    confidence: 0.65,
    sourceId: "hmrc-statistics"
  },
  {
    subjectType: "source",
    subjectId: "planning-data",
    x: -1.5,
    y: 1.5,
    label: "local growth vs control lens",
    explanation: "Planning issues often combine housing supply, property rights, environmental protection and community consent.",
    confidence: 0.6,
    sourceId: "planning-data"
  },
  {
    subjectType: "aggregate_view",
    subjectId: "tax-system-map",
    x: -5.0,
    y: 1.0,
    label: "burden distribution",
    explanation: "The view compares income sources, reliefs, thresholds and household examples to make burden distribution legible.",
    confidence: 0.7,
    sourceId: "hmrc-statistics"
  }
];

export async function importCivicData(sql: Sql) {
  const [run] = await sql`
    insert into data_import_runs (kind, status, detail)
    values ('civic-data-expansion', 'running', '{}'::jsonb)
    returning id
  `;
  try {
    for (const source of sources) {
      await sql`
        insert into source_registry (
          id, name, category, scope, owner, url, licence, official_status,
          refresh_cadence, newcomer_explanation, compass_score_potential,
          aggregate_view_potential, caveats, metadata, updated_at
        )
        values (
          ${source.id}, ${source.name}, ${source.category}, ${source.scope}, ${source.owner},
          ${source.url}, ${source.licence}, ${source.officialStatus}, ${source.refreshCadence},
          ${source.newcomerExplanation}, ${source.compassScorePotential},
          ${source.aggregateViewPotential}, ${source.caveats}, ${sql.json(source.metadata ?? {})}, now()
        )
        on conflict (id) do update set
          name = excluded.name,
          category = excluded.category,
          scope = excluded.scope,
          owner = excluded.owner,
          url = excluded.url,
          licence = excluded.licence,
          official_status = excluded.official_status,
          refresh_cadence = excluded.refresh_cadence,
          newcomer_explanation = excluded.newcomer_explanation,
          compass_score_potential = excluded.compass_score_potential,
          aggregate_view_potential = excluded.aggregate_view_potential,
          caveats = excluded.caveats,
          metadata = excluded.metadata,
          updated_at = now()
      `;
    }

    for (const layer of localLayers) {
      await sql`
        insert into local_civic_layers (
          id, title, layer_type, summary, source_id, beginner_label, gamified_action,
          compass_potential, aggregate_view, status, sort_order, updated_at
        )
        values (
          ${layer.id}, ${layer.title}, ${layer.layerType}, ${layer.summary}, ${layer.sourceId},
          ${layer.beginnerLabel}, ${layer.gamifiedAction}, ${layer.compassPotential},
          ${layer.aggregateView}, ${layer.status}, ${layer.sortOrder}, now()
        )
        on conflict (id) do update set
          title = excluded.title,
          layer_type = excluded.layer_type,
          summary = excluded.summary,
          source_id = excluded.source_id,
          beginner_label = excluded.beginner_label,
          gamified_action = excluded.gamified_action,
          compass_potential = excluded.compass_potential,
          aggregate_view = excluded.aggregate_view,
          status = excluded.status,
          sort_order = excluded.sort_order,
          updated_at = now()
      `;
    }

    for (const indicator of fiscalIndicators) {
      await sql`
        insert into fiscal_indicators (
          id, title, plain_english, source_id, period, value_label, trend_label,
          why_it_matters, compass_potential, aggregate_view, status, sort_order, updated_at
        )
        values (
          ${indicator.id}, ${indicator.title}, ${indicator.plainEnglish}, ${indicator.sourceId},
          ${indicator.period}, ${indicator.valueLabel}, ${indicator.trendLabel},
          ${indicator.whyItMatters}, ${indicator.compassPotential}, ${indicator.aggregateView},
          ${indicator.status}, ${indicator.sortOrder}, now()
        )
        on conflict (id) do update set
          title = excluded.title,
          plain_english = excluded.plain_english,
          source_id = excluded.source_id,
          period = excluded.period,
          value_label = excluded.value_label,
          trend_label = excluded.trend_label,
          why_it_matters = excluded.why_it_matters,
          compass_potential = excluded.compass_potential,
          aggregate_view = excluded.aggregate_view,
          status = excluded.status,
          sort_order = excluded.sort_order,
          updated_at = now()
      `;
    }

    for (const scenario of taxScenarios) {
      await sql`
        insert into tax_scenarios (
          id, title, persona, plain_english, source_ids, visible_pattern,
          compass_potential, aggregate_view, status, sort_order, updated_at
        )
        values (
          ${scenario.id}, ${scenario.title}, ${scenario.persona}, ${scenario.plainEnglish},
          ${scenario.sourceIds}, ${scenario.visiblePattern}, ${scenario.compassPotential},
          ${scenario.aggregateView}, ${scenario.status}, ${scenario.sortOrder}, now()
        )
        on conflict (id) do update set
          title = excluded.title,
          persona = excluded.persona,
          plain_english = excluded.plain_english,
          source_ids = excluded.source_ids,
          visible_pattern = excluded.visible_pattern,
          compass_potential = excluded.compass_potential,
          aggregate_view = excluded.aggregate_view,
          status = excluded.status,
          sort_order = excluded.sort_order,
          updated_at = now()
      `;
    }

    for (const view of aggregateViews) {
      await sql`
        insert into aggregate_views (
          id, title, view_type, summary, source_ids, beginner_question,
          compass_lens, route_hint, status, sort_order, updated_at
        )
        values (
          ${view.id}, ${view.title}, ${view.viewType}, ${view.summary}, ${view.sourceIds},
          ${view.beginnerQuestion}, ${view.compassLens}, ${view.routeHint},
          ${view.status}, ${view.sortOrder}, now()
        )
        on conflict (id) do update set
          title = excluded.title,
          view_type = excluded.view_type,
          summary = excluded.summary,
          source_ids = excluded.source_ids,
          beginner_question = excluded.beginner_question,
          compass_lens = excluded.compass_lens,
          route_hint = excluded.route_hint,
          status = excluded.status,
          sort_order = excluded.sort_order,
          updated_at = now()
      `;
    }

    for (const score of compassSeeds) {
      await sql`
        insert into compass_scores (
          subject_type, subject_id, x, y, label, explanation, confidence, source_id
        )
        values (
          ${score.subjectType}, ${score.subjectId}, ${score.x}, ${score.y}, ${score.label},
          ${score.explanation}, ${score.confidence}, ${score.sourceId}
        )
        on conflict (subject_type, subject_id, method) do update set
          x = excluded.x,
          y = excluded.y,
          label = excluded.label,
          explanation = excluded.explanation,
          confidence = excluded.confidence,
          source_id = excluded.source_id,
          generated_at = now()
      `;
    }

    await sql`
      update data_import_runs
      set status = 'completed',
          detail = ${sql.json({
            sources: sources.length,
            localLayers: localLayers.length,
            fiscalIndicators: fiscalIndicators.length,
            taxScenarios: taxScenarios.length,
            aggregateViews: aggregateViews.length
          })},
          finished_at = now()
      where id = ${run.id}
    `;
    return {
      sources: sources.length,
      localLayers: localLayers.length,
      fiscalIndicators: fiscalIndicators.length,
      taxScenarios: taxScenarios.length,
      aggregateViews: aggregateViews.length
    };
  } catch (error) {
    await sql`
      update data_import_runs
      set status = 'failed',
          detail = ${sql.json({ error: error instanceof Error ? error.message : String(error) })},
          finished_at = now()
      where id = ${run.id}
    `;
    throw error;
  }
}

async function ensureCivicData(sql: Sql) {
  const [row] = await sql`select count(*)::int as count from source_registry`;
  if ((row?.count as number | undefined) === 0) await importCivicData(sql);
}

export async function listCivicSources(sql: Sql, category?: string) {
  await ensureCivicData(sql);
  const rows = category
    ? await sql`
        select * from source_registry
        where category = ${category}
        order by category, name
      `
    : await sql`
        select * from source_registry
        order by category, name
      `;
  return rows;
}

export async function localCivicOverview(sql: Sql) {
  await ensureCivicData(sql);
  const layers = await sql`
    select l.*, s.name as source_name, s.url as source_url, s.official_status
    from local_civic_layers l
    left join source_registry s on s.id = l.source_id
    order by l.sort_order, l.title
  `;
  const views = await sql`
    select * from aggregate_views
    where view_type in ('person', 'place', 'issue')
    order by sort_order, title
  `;
  const scores = await sql`
    select * from compass_scores
    where subject_type in ('source', 'aggregate_view')
    order by generated_at desc
  `;
  return {
    promise: "A newcomer-friendly local power map: who represents you, who runs services, where money goes, and what issues need a mandate.",
    layers,
    aggregateViews: views,
    compassScores: scores
  };
}

export async function fiscalCivicOverview(sql: Sql) {
  await ensureCivicData(sql);
  const indicators = await sql`
    select f.*, s.name as source_name, s.url as source_url, s.official_status
    from fiscal_indicators f
    left join source_registry s on s.id = f.source_id
    order by f.sort_order, f.title
  `;
  const scenarios = await sql`
    select * from tax_scenarios
    order by sort_order, title
  `;
  const views = await sql`
    select * from aggregate_views
    where view_type in ('issue', 'institution')
    order by sort_order, title
  `;
  const scores = await sql`
    select * from compass_scores
    where subject_type in ('source', 'aggregate_view')
    order by generated_at desc
  `;
  return {
    promise: "A layperson-readable fiscal map: taxes, spending, forecasts, risks, and household examples without editorialising.",
    indicators,
    taxScenarios: scenarios,
    aggregateViews: views,
    compassScores: scores
  };
}

export async function civicPostcodeProfile(postcode: string) {
  const cleaned = postcode.replace(/\s+/g, "").toUpperCase();
  if (!/^[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2}$/.test(cleaned)) {
    return { error: "invalid-postcode" as const };
  }

  const response = await fetch(`${POSTCODES_API}/${encodeURIComponent(cleaned)}`);
  if (response.status === 404) return { error: "postcode-not-found" as const };
  if (!response.ok) return { error: "lookup-unavailable" as const };

  const payload = (await response.json()) as {
    result?: {
      postcode?: string;
      latitude?: number | null;
      longitude?: number | null;
      country?: string | null;
      region?: string | null;
      parliamentary_constituency?: string | null;
      parliamentary_constituency_2024?: string | null;
      admin_district?: string | null;
      admin_county?: string | null;
      admin_ward?: string | null;
      parish?: string | null;
      ced?: string | null;
      ccg?: string | null;
      pfa?: string | null;
      codes?: Record<string, string | null>;
    };
  };
  const result = payload.result;
  if (!result) return { error: "postcode-not-found" as const };

  return {
    postcode: result.postcode ?? cleaned,
    location: {
      latitude: result.latitude ?? null,
      longitude: result.longitude ?? null,
      country: result.country ?? null,
      region: result.region ?? null
    },
    parliamentary: {
      constituency: result.parliamentary_constituency ?? null,
      constituency2024: result.parliamentary_constituency_2024 ?? null
    },
    local: {
      district: result.admin_district ?? null,
      county: result.admin_county ?? null,
      ward: result.admin_ward ?? null,
      parish: result.parish ?? null,
      ced: result.ced ?? null,
      ccg: result.ccg ?? null,
      policeForce: result.pfa ?? null
    },
    codes: result.codes ?? {},
    source: {
      id: "postcodes-io",
      name: "Postcodes.io",
      url: "https://api.postcodes.io/"
    },
    beginnerExplanation:
      "This turns a postcode into the public bodies and electoral areas that can be used for local dashboards, service responsibility, elections, planning and aggregate public mandates.",
    nextActions: [
      "Show the council and ward on your local power map.",
      "Join council tax, planning, councillor and election data to these areas.",
      "Aggregate votes and debate by ward/council only above privacy thresholds."
    ]
  };
}
