import type { FiscalCivicOverview, LocalCivicOverview } from "../lib/api";

export const fallbackLocalCivicOverview: LocalCivicOverview = {
  promise:
    "A newcomer-friendly local power map: who represents you, who runs services, where money goes, and what issues need a mandate.",
  layers: [
    {
      id: "who-runs-my-place",
      title: "Who runs my place?",
      layer_type: "responsibility",
      summary: "Postcode-to-authority lookup, ward mapping and plain-English service responsibilities.",
      source_id: "postcodes-io",
      beginner_label: "Start here: see the public bodies that affect your day-to-day life.",
      gamified_action: "Complete the local power map by identifying who handles bins, roads, planning and schools.",
      compass_potential: "Score local public priorities once people vote on service trade-offs.",
      aggregate_view: "Rolls up to place power maps by postcode, ward, council and constituency.",
      status: "implemented-spine",
      source_name: "Postcodes.io",
      source_url: "https://api.postcodes.io/",
      official_status: "civic-maintained"
    },
    {
      id: "local-election-readiness",
      title: "Local election readiness",
      layer_type: "elections",
      summary: "Election calendar, ballot papers, candidates, polling station context and past results.",
      source_id: "democracy-club",
      beginner_label: "Know who is asking for power before polling day.",
      gamified_action: "Election-ready checklist: candidates viewed, polling place checked, one issue compared.",
      compass_potential: "Score candidate statements and party promises where source text exists.",
      aggregate_view: "Rolls up to candidate maps, ward result history and public mandate gaps.",
      status: "planned",
      source_name: "Democracy Club Data and APIs",
      source_url: "https://democracyclub.org.uk/projects/data/",
      official_status: "civic-maintained"
    },
    {
      id: "council-money",
      title: "Council money",
      layer_type: "finance",
      summary: "Council tax, service spend, local finance trends and peer comparisons.",
      source_id: "local-finance",
      beginner_label: "See where the local bill goes without learning public finance first.",
      gamified_action: "Balance a council budget while preserving the services you care about.",
      compass_potential: "Score service and tax trade-offs by redistribution, local autonomy and state capacity.",
      aggregate_view: "Rolls up to council tax burden, service spend, and peer-authority dashboards.",
      status: "implemented-spine",
      source_name: "Local authority revenue expenditure and financing",
      source_url: "https://www.gov.uk/government/collections/local-authority-revenue-expenditure-and-financing",
      official_status: "official statistics"
    },
    {
      id: "planning-near-me",
      title: "Planning near me",
      layer_type: "planning",
      summary: "Planning applications, local plans, brownfield land, protected places and developer contributions.",
      source_id: "planning-data",
      beginner_label: "Understand what might change near your home and how to respond.",
      gamified_action: "Review one proposal: what changes, who benefits, who bears the cost?",
      compass_potential: "Score housing, growth, conservation and community-control arguments.",
      aggregate_view: "Rolls up to development pressure maps and local-plan debate clusters.",
      status: "planned",
      source_name: "Planning Data",
      source_url: "https://www.planning.data.gov.uk/",
      official_status: "official"
    }
  ],
  aggregateViews: [
    {
      id: "my-civic-map",
      title: "My civic map",
      view_type: "person",
      summary: "Everything relevant to a person from postcode to council, constituency, services, representatives and issues.",
      source_ids: ["postcodes-io", "mapit", "os-boundary-line"],
      beginner_question: "Who has power where I live?",
      compass_lens: "Shows local mandate and issue clusters once votes exist.",
      route_hint: "/local",
      status: "implemented-spine"
    }
  ],
  compassScores: [
    {
      subject_type: "source",
      subject_id: "planning-data",
      x: -1.5,
      y: 1.5,
      label: "local growth vs control lens",
      explanation: "Planning issues combine housing supply, property rights, environmental protection and community consent.",
      confidence: 0.6,
      source_id: "planning-data"
    }
  ]
};

export const fallbackFiscalCivicOverview: FiscalCivicOverview = {
  promise:
    "A layperson-readable fiscal map: taxes, spending, forecasts, risks, and household examples without editorialising.",
  indicators: [
    {
      id: "forecast-vs-reality",
      title: "Forecast vs reality",
      plain_english: "Compare what government expected to happen with what actually happened.",
      source_id: "obr-data",
      period: "Forecast cycle",
      value_label: "Forecast, outturn and revision",
      trend_label: "Shows whether plans survived contact with reality",
      why_it_matters: "Promises are easier to judge when forecasts, revisions and outcomes are side by side.",
      compass_potential: "Scores fiscal claims by state capacity, intervention, redistribution and risk tolerance.",
      aggregate_view: "Rolls up to policy trust, department delivery and budget credibility views.",
      status: "implemented-spine",
      source_name: "OBR Data",
      source_url: "https://obr.uk/data/",
      official_status: "official independent fiscal data"
    },
    {
      id: "where-spending-goes",
      title: "Where spending goes",
      plain_english: "Translate Treasury spending categories into public services people recognise.",
      source_id: "hmt-pesa",
      period: "Annual",
      value_label: "Spend by service and department",
      trend_label: "Shows what is growing, shrinking or being protected",
      why_it_matters: "The public can only set priorities if the budget is readable.",
      compass_potential: "Scores spending choices by state size, redistribution and social investment.",
      aggregate_view: "Rolls up to issue budgets, department scorecards and public budget simulators.",
      status: "implemented-spine",
      source_name: "HM Treasury PESA",
      source_url: "https://www.gov.uk/government/collections/public-expenditure-statistical-analyses-pesa",
      official_status: "accredited official statistics"
    }
  ],
  taxScenarios: [
    {
      id: "worker-vs-asset-owner",
      title: "Work income vs asset income",
      persona: "Employee and asset owner",
      plain_english: "Compare how pay, dividends, capital gains and property income move through different tax routes.",
      source_ids: ["hmrc-statistics", "obr-data"],
      visible_pattern: "Different income sources can face different rates, thresholds and planning opportunities.",
      compass_potential: "High: exposes labour/capital, redistribution and market-power trade-offs.",
      aggregate_view: "Rolls up to income-source burden maps and policy measure compass scores.",
      status: "implemented-spine"
    },
    {
      id: "threshold-traps",
      title: "Thresholds and cliff edges",
      persona: "Growing household income",
      plain_english: "Show where allowances, withdrawals and thresholds change the next pound someone earns.",
      source_ids: ["hmrc-statistics", "ons-api"],
      visible_pattern: "A headline tax rate can hide a much higher effective rate in specific ranges.",
      compass_potential: "High: shows incentives, welfare design and fiscal drag.",
      aggregate_view: "Rolls up to household impact modelling and budget simulator warnings.",
      status: "implemented-spine"
    }
  ],
  aggregateViews: [
    {
      id: "tax-system-map",
      title: "Tax system map",
      view_type: "issue",
      summary: "A plain-language map of taxes by income source, household type, threshold and relief.",
      source_ids: ["hmrc-statistics", "obr-data", "ons-api"],
      beginner_question: "Why do different people seem to pay in different ways?",
      compass_lens: "Distributional effects, incentives, redistribution and state capacity.",
      route_hint: "/fiscal",
      status: "implemented-spine"
    },
    {
      id: "public-money-flow",
      title: "Public money flow",
      view_type: "institution",
      summary: "How taxes become departmental budgets, local grants, services, contracts and outcomes.",
      source_ids: ["obr-data", "hmt-pesa", "hmt-cra", "wga"],
      beginner_question: "Where did the money go, and what changed?",
      compass_lens: "Spending priorities by issue, department, place and ideology.",
      route_hint: "/fiscal",
      status: "planned"
    }
  ],
  compassScores: [
    {
      subject_type: "source",
      subject_id: "hmrc-statistics",
      x: -4.5,
      y: 2,
      label: "redistribution and enforcement lens",
      explanation: "Tax data is scored by who pays, who benefits, what behaviour is incentivised, and how much state capacity is required.",
      confidence: 0.65,
      source_id: "hmrc-statistics"
    },
    {
      subject_type: "aggregate_view",
      subject_id: "tax-system-map",
      x: -5,
      y: 1,
      label: "burden distribution",
      explanation: "The view compares income sources, reliefs, thresholds and household examples to make burden distribution legible.",
      confidence: 0.7,
      source_id: "hmrc-statistics"
    }
  ]
};
