import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  BadgePercent,
  BarChart3,
  BookOpenCheck,
  Building2,
  ChevronRight,
  Flame,
  Gamepad2,
  Landmark,
  Map,
  MapPinned,
  MessageSquare,
  ReceiptText,
  Scale,
  School,
  ShieldCheck
} from "lucide-react";
import { fallbackFiscalCivicOverview, fallbackLocalCivicOverview } from "../data/civicFallback";
import {
  fetchFiscalCivicOverview,
  fetchLocalCivicOverview,
  type AccountUser,
  type FiscalCivicOverview,
  type FiscalIndicator,
  type LocalCivicLayer,
  type LocalCivicOverview,
  type TaxScenario
} from "../lib/api";

const SPENDING_LINKS = {
  pesa: "https://www.gov.uk/government/collections/public-expenditure-statistical-analyses-pesa",
  majorProjects: "https://www.gov.uk/government/collections/major-projects-data",
  nao: "https://www.nao.org.uk/reports/",
  pac: "https://committees.parliament.uk/committee/127/public-accounts-committee/"
};

const SPENDING_AREAS = [
  { name: "Welfare and pensions", amount: 350, color: "#147b8e", note: "Social protection", source: "HM Treasury PESA", href: SPENDING_LINKS.pesa },
  { name: "Health", amount: 245, color: "#2f8d68", note: "NHS and health services", source: "HM Treasury PESA", href: SPENDING_LINKS.pesa },
  { name: "Education", amount: 131, color: "#d49a2f", note: "Schools, further and higher education", source: "HM Treasury PESA", href: SPENDING_LINKS.pesa },
  { name: "Debt interest", amount: 104, color: "#bf443e", note: "Cost of servicing government debt", source: "HM Treasury PESA", href: SPENDING_LINKS.pesa },
  { name: "Defence", amount: 57, color: "#3d6477", note: "Military capability and operations", source: "HM Treasury PESA", href: SPENDING_LINKS.pesa },
  { name: "Public order and safety", amount: 51, color: "#6f5f87", note: "Police, courts and prisons", source: "HM Treasury PESA", href: SPENDING_LINKS.pesa },
  { name: "Transport", amount: 44, color: "#9d6b38", note: "Road, rail and local transport", source: "HM Treasury PESA", href: SPENDING_LINKS.pesa }
];

const DEPARTMENT_RISK = [
  {
    department: "DWP",
    spend: "£300bn+",
    risk: "Very high",
    waste: "£9.3bn overpayments flagged in recent scrutiny",
    score: 78,
    source: "Public Accounts Committee scrutiny",
    href: SPENDING_LINKS.pac
  },
  {
    department: "MOD",
    spend: "£50bn+",
    risk: "Very high",
    waste: "Major project cancellation and nuclear transparency flags",
    score: 74,
    source: "PAC, NAO and major projects data",
    href: SPENDING_LINKS.majorProjects
  },
  {
    department: "Home Office",
    spend: "£20bn+",
    risk: "High",
    waste: "Asylum, migration and procurement pressure",
    score: 66,
    source: "NAO value-for-money reports",
    href: SPENDING_LINKS.nao
  },
  {
    department: "DHSC",
    spend: "£190bn+",
    risk: "High",
    waste: "Large spend, waiting-list pressure and procurement exposure",
    score: 61,
    source: "PESA and NAO health reports",
    href: SPENDING_LINKS.nao
  },
  {
    department: "DfE",
    spend: "£100bn+",
    risk: "Medium",
    waste: "School estate, SEND and capital delivery pressure",
    score: 48,
    source: "PESA and major projects data",
    href: SPENDING_LINKS.majorProjects
  }
];

const LOCAL_ISSUES = [
  { label: "Housing", pressure: 84, trend: "+12", owner: "Council + Westminster", signals: 328, thread: "Repairs and empty homes" },
  { label: "GP access", pressure: 72, trend: "+8", owner: "NHS + Westminster", signals: 189, thread: "GP appointments" },
  { label: "Roads", pressure: 61, trend: "+5", owner: "County / unitary", signals: 146, thread: "Road repairs backlog" },
  { label: "Schools", pressure: 56, trend: "+3", owner: "Council + DfE", signals: 137, thread: "School places" },
  { label: "Buses", pressure: 49, trend: "-2", owner: "Council + operators", signals: 214, thread: "Bus routes after 6pm" }
];

const LOCAL_RESPONSIBILITIES = [
  { service: "Bins", owner: "District / unitary", pressure: 34, clarity: 91 },
  { service: "Roads", owner: "County / unitary", pressure: 61, clarity: 77 },
  { service: "Planning", owner: "Council", pressure: 68, clarity: 68 },
  { service: "Schools", owner: "Council + DfE", pressure: 56, clarity: 59 },
  { service: "Police", owner: "PCC + Home Office", pressure: 47, clarity: 52 },
  { service: "NHS", owner: "ICB + DHSC", pressure: 72, clarity: 45 }
];

const LOCAL_DISCUSSIONS = [
  { topic: "Repairs and empty homes", votes: 328, heat: 82, action: "Open thread" },
  { topic: "Bus routes after 6pm", votes: 214, heat: 64, action: "Compare routes" },
  { topic: "GP appointments", votes: 189, heat: 58, action: "Service score" },
  { topic: "School places", votes: 137, heat: 42, action: "Mandate" }
];

type CivicDataPanelProps = {
  mode: "local" | "fiscal";
  user?: AccountUser | null;
  /** Navigate to the Transparency page, where the source catalog now lives. */
  onOpenSources?: () => void;
};

export function CivicDataPanel({ mode, user = null, onOpenSources }: CivicDataPanelProps) {
  const [local, setLocal] = useState<LocalCivicOverview | null>(null);
  const [fiscal, setFiscal] = useState<FiscalCivicOverview | null>(null);
  const [dataSource, setDataSource] = useState<"backend" | "fallback">("backend");

  useEffect(() => {
    let mounted = true;
    setDataSource("backend");
    const load = mode === "local" ? fetchLocalCivicOverview() : fetchFiscalCivicOverview();
    load
      .then((payload) => {
        if (!mounted) return;
        if (mode === "local") setLocal(payload as LocalCivicOverview);
        else setFiscal(payload as FiscalCivicOverview);
      })
      .catch(() => {
        if (!mounted) return;
        setDataSource("fallback");
        if (mode === "local") setLocal(fallbackLocalCivicOverview);
        else setFiscal(fallbackFiscalCivicOverview);
      });
    return () => {
      mounted = false;
    };
  }, [mode]);

  if (mode === "local") {
    return (
      <LocalPlanView
        overview={local}
        dataSource={dataSource}
        user={user}
        onOpenSources={onOpenSources}
      />
    );
  }
  return <FiscalPlanView overview={fiscal} dataSource={dataSource} onOpenSources={onOpenSources} />;
}

/**
 * Click-to-expand row: the summary line carries the numbers; all prose lives
 * in the body and only appears when the reader drills in.
 */
function DrillRow({
  icon,
  title,
  meta,
  aside,
  visual,
  children
}: {
  icon?: ReactNode;
  title: string;
  meta?: string;
  aside?: ReactNode;
  visual?: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <article className={open ? "drill open" : "drill"}>
      <button
        type="button"
        className="drill-summary"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        {icon}
        <span className="drill-copy">
          <strong>{title}</strong>
          {meta && <small>{meta}</small>}
        </span>
        {visual}
        {aside}
        <ChevronRight size={15} className="drill-chevron" />
      </button>
      {open && <div className="drill-body">{children}</div>}
    </article>
  );
}

function SourceLink({ href, label }: { href: string; label: string }) {
  return (
    <a className="civic-source-link" href={href} target="_blank" rel="noreferrer">
      {label} <ChevronRight size={14} />
    </a>
  );
}

function LocalPlanView({
  overview,
  dataSource,
  user,
  onOpenSources
}: {
  overview: LocalCivicOverview | null;
  dataSource: "backend" | "fallback";
  user: AccountUser | null;
  onOpenSources?: () => void;
}) {
  const placeName = user?.constituencyName ?? "your area";
  const sourceCount = overview?.layers.length ?? 0;
  const averagePressure = Math.round(
    LOCAL_ISSUES.reduce((total, issue) => total + issue.pressure, 0) / LOCAL_ISSUES.length
  );
  const topIssue = LOCAL_ISSUES[0];
  const totalSignals = LOCAL_DISCUSSIONS.reduce((total, thread) => total + thread.votes, 0);

  return (
    <>
      <DataSourceNotice dataSource={dataSource} />
      <section className="workspace-section local-hero">
        <div className="section-heading">
          <MapPinned size={20} />
          <div>
            <h2>{user ? `${placeName}: local dashboard` : "Local dashboard"}</h2>
            <p>Tap any row to drill into the detail.</p>
          </div>
        </div>
        <div className="local-score-strip">
          <Metric label="Area pressure" value={averagePressure} />
          <div>
            <span>Top issue</span>
            <strong>{topIssue.label}</strong>
          </div>
          <Metric label="Public signals" value={totalSignals} />
          <Metric label="Live sources" value={sourceCount} />
        </div>
      </section>

      <section className="workspace-section">
        <div className="section-heading">
          <Flame size={20} />
          <div>
            <h2>What's under pressure</h2>
          </div>
        </div>
        <div className="local-view-grid">
          <article className="panel local-pressure-panel">
            <header>
              <strong>Issue pressure</strong>
              <span>tap an issue for detail</span>
            </header>
            <div className="drill-list">
              {LOCAL_ISSUES.map((issue) => (
                <DrillRow
                  key={issue.label}
                  title={issue.label}
                  visual={
                    <span className="local-bar-track drill-bar">
                      <i style={{ width: `${issue.pressure}%` }} />
                    </span>
                  }
                  aside={
                    <em className={issue.trend.startsWith("+") ? "trend-up" : "trend-down"}>
                      {issue.trend}
                    </em>
                  }
                >
                  <p>
                    Pressure {issue.pressure}/100 from {issue.signals} public signals, trending{" "}
                    {issue.trend} this quarter.
                  </p>
                  <div className="drill-facts">
                    <span>
                      <strong>Who owns it</strong> {issue.owner}
                    </span>
                    <span>
                      <strong>Live thread</strong> {issue.thread}
                    </span>
                  </div>
                </DrillRow>
              ))}
            </div>
          </article>

          <article className="panel local-ownership-panel">
            <header>
              <strong>Service ownership</strong>
              <span>pressure vs clarity</span>
            </header>
            <div className="ownership-grid">
              {LOCAL_RESPONSIBILITIES.map((item) => (
                <div className="ownership-cell" key={item.service}>
                  <header>
                    <b>{item.service}</b>
                    <em>{item.pressure}</em>
                  </header>
                  <small>{item.owner}</small>
                  <div className="ownership-meter">
                    <span style={{ width: `${item.clarity}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </article>

          <article className="panel local-discussion-heat">
            <header>
              <strong>Discussion heat</strong>
              <span>{totalSignals} signals</span>
            </header>
            {LOCAL_DISCUSSIONS.map((thread) => (
              <div className="discussion-heat-row" key={thread.topic}>
                <div>
                  <strong>{thread.topic}</strong>
                  <span>{thread.votes} signals</span>
                </div>
                <div className="discussion-heat-bar" aria-hidden="true">
                  <span style={{ width: `${thread.heat}%` }} />
                </div>
                <em>{thread.action}</em>
              </div>
            ))}
          </article>

          <article className="panel local-map-preview">
            <header>
              <strong>Responsibility map</strong>
              <span>who to pressure</span>
            </header>
            <div className="responsibility-map">
              {LOCAL_ISSUES.slice(0, 4).map((issue) => (
                <div key={issue.label}>
                  <strong>{issue.label}</strong>
                  <span>{issue.owner}</span>
                  <em style={{ width: `${issue.pressure}%` }} />
                </div>
              ))}
            </div>
            <div className="map-preview-legend">
              <span>longer bars = more unresolved pressure</span>
            </div>
          </article>
        </div>
      </section>

      <section className="workspace-section local-discussions-section">
        <div className="section-heading">
          <MessageSquare size={20} />
          <div>
            <h2>Open local threads</h2>
          </div>
        </div>
        <div className="drill-list">
          <DrillRow
            icon={<School size={18} />}
            title={`What is the most ignored problem in ${placeName}?`}
            meta="Open local thread"
          >
            <p>Collect evidence, personal impact, and the public body that should answer.</p>
          </DrillRow>
          <DrillRow
            icon={<School size={18} />}
            title="Which local service has got better or worse?"
            meta="Service score"
          >
            <p>
              Useful for bins, road repairs, GP access, school places, buses, housing and planning.
            </p>
          </DrillRow>
          <DrillRow
            icon={<School size={18} />}
            title="What should your representatives be forced to answer?"
            meta="Mandate builder"
          >
            <p>
              Convert anger into a clear question, then let people vote and compare it with official
              action.
            </p>
          </DrillRow>
        </div>
      </section>

      <SourcesPointer
        icon={<Map size={16} />}
        count={sourceCount}
        kind="local"
        onOpenSources={onOpenSources}
      />
    </>
  );
}

function FiscalPlanView({
  overview,
  dataSource,
  onOpenSources
}: {
  overview: FiscalCivicOverview | null;
  dataSource: "backend" | "fallback";
  onOpenSources?: () => void;
}) {
  const sourceCount = (overview?.indicators.length ?? 0) + (overview?.taxScenarios.length ?? 0);
  const trackedSpend = SPENDING_AREAS.reduce((total, area) => total + area.amount, 0);
  const maxSpend = Math.max(...SPENDING_AREAS.map((area) => area.amount));
  const topRisk = DEPARTMENT_RISK[0];
  let spendStart = 0;
  const spendingConic = SPENDING_AREAS.map((area) => {
    const start = spendStart;
    const end = start + (area.amount / trackedSpend) * 100;
    spendStart = end;
    return `${area.color} ${start}% ${end}%`;
  }).join(", ");
  const householdScenario = overview?.taxScenarios[0];
  const workerScenario = overview?.taxScenarios.find((scenario) =>
    scenario.title.toLowerCase().includes("worker")
  ) ?? overview?.taxScenarios[1];
  const businessScenario = overview?.taxScenarios.find((scenario) =>
    scenario.title.toLowerCase().includes("company")
  ) ?? overview?.taxScenarios[2];

  const taxStories = [
    {
      title: householdScenario?.title ?? "Worker on a wage",
      persona: householdScenario?.persona ?? "Someone paid through PAYE",
      body:
        householdScenario?.plain_english ??
        "Show what comes off a payslip, what is taxed later through spending, and what support is lost as income changes.",
      pattern:
        householdScenario?.visible_pattern ??
        "The headline tax rate is only part of the story; thresholds, benefits and indirect taxes change the real burden."
    },
    {
      title: workerScenario?.title ?? "Self-employed or small business owner",
      persona: workerScenario?.persona ?? "Someone whose income is less predictable",
      body:
        workerScenario?.plain_english ??
        "Compare take-home money, National Insurance, expenses, VAT registration and late-payment risk.",
      pattern:
        workerScenario?.visible_pattern ??
        "Two people earning similar amounts can face very different timing, paperwork and risk."
    },
    {
      title: businessScenario?.title ?? "Asset income vs work income",
      persona: businessScenario?.persona ?? "Income from ownership rather than wages",
      body:
        businessScenario?.plain_english ??
        "Put dividends, capital gains, rent and wages side by side in plain English.",
      pattern:
        businessScenario?.visible_pattern ??
        "The system treats different kinds of income differently, even before wealth is counted."
    }
  ];

  return (
    <>
      <DataSourceNotice dataSource={dataSource} />
      <section className="workspace-section fiscal-hero">
        <div className="section-heading">
          <ReceiptText size={20} />
          <div>
            <h2>Follow the money</h2>
            <p>Tap any row to drill into the detail and its official source.</p>
          </div>
        </div>
        <div className="local-score-strip">
          <div>
            <span>Tracked spend</span>
            <strong>£{trackedSpend}bn</strong>
          </div>
          <div>
            <span>Biggest area</span>
            <strong>{SPENDING_AREAS[0].name.split(" ")[0]} £{SPENDING_AREAS[0].amount}bn</strong>
          </div>
          <div>
            <span>Top waste risk</span>
            <strong>
              {topRisk.department} {topRisk.score}/100
            </strong>
          </div>
          <Metric label="Audit sources" value={sourceCount} />
        </div>
      </section>

      <section className="workspace-section">
        <div className="section-heading">
          <BarChart3 size={20} />
          <div>
            <h2>Where your money is spent</h2>
          </div>
        </div>
        <div className="spending-board">
          <article className="panel spending-total-card">
            <span>Tracked in this view</span>
            <strong>£{trackedSpend}bn</strong>
            <div className="spending-donut" style={{ background: `conic-gradient(${spendingConic})` }}>
              <span>service spend</span>
            </div>
            <SourceLink href={SPENDING_LINKS.pesa} label="HM Treasury PESA" />
          </article>
          <div className="panel spending-list drill-list" aria-label="Public spending by service area">
            {SPENDING_AREAS.map((area) => (
              <DrillRow
                key={area.name}
                title={area.name}
                visual={
                  <span className="spending-bar drill-bar" aria-hidden="true">
                    <span
                      style={{ width: `${(area.amount / maxSpend) * 100}%`, background: area.color }}
                    />
                  </span>
                }
                aside={<em className="drill-amount">£{area.amount}bn</em>}
              >
                <p>
                  {area.note} — {Math.round((area.amount / trackedSpend) * 100)}% of the spend
                  tracked in this view.
                </p>
                <SourceLink href={area.href} label={area.source} />
              </DrillRow>
            ))}
          </div>
        </div>
      </section>

      <section className="workspace-section">
        <div className="section-heading">
          <Flame size={20} />
          <div>
            <h2>Department waste and delivery risk</h2>
          </div>
        </div>
        <div className="drill-list">
          {DEPARTMENT_RISK.map((department) => (
            <DrillRow
              key={department.department}
              title={department.department}
              meta={`${department.spend} annual spend`}
              visual={
                <span className="risk-meter drill-bar">
                  <span style={{ width: `${department.score}%` }} />
                </span>
              }
              aside={<em className="risk-pill">{department.risk}</em>}
            >
              <p>{department.waste}.</p>
              <div className="drill-facts">
                <span>
                  <strong>Risk score</strong> {department.score}/100
                </span>
              </div>
              <SourceLink href={department.href} label={department.source} />
            </DrillRow>
          ))}
        </div>
      </section>

      <section className="workspace-section">
        <div className="section-heading">
          <BadgePercent size={20} />
          <div>
            <h2>HMRC, translated into real life</h2>
          </div>
        </div>
        <div className="drill-list">
          {taxStories.map((story) => (
            <DrillRow
              key={story.title}
              icon={<ReceiptText size={18} />}
              title={story.title}
              meta={story.persona}
            >
              <p>{story.body}</p>
              <div className="tax-pattern">
                <strong>What becomes visible</strong>
                <span>{story.pattern}</span>
              </div>
            </DrillRow>
          ))}
        </div>
      </section>

      <section className="workspace-section">
        <div className="section-heading">
          <MessageSquare size={20} />
          <div>
            <h2>Turn the data into votes</h2>
          </div>
        </div>
        <div className="drill-list">
          <DrillRow
            icon={<Scale size={18} />}
            title="Which taxes feel invisible until the money is gone?"
            meta="Tax lens"
          >
            <p>
              Payslip deductions, VAT, rent, childcare cliffs, fuel, council tax and student loan
              deductions can be compared in one view.
            </p>
          </DrillRow>
          <DrillRow
            icon={<Landmark size={18} />}
            title="Where should public money show up locally?"
            meta="Service check"
          >
            <p>
              Connect spending claims to visible services: waiting lists, school places, transport,
              policing, roads and housing.
            </p>
          </DrillRow>
          <DrillRow
            icon={<MessageSquare size={18} />}
            title="What trade-off would you actually vote for?"
            meta="Mandate builder"
          >
            <p>
              Turn budget choices into plain options: pay more, cut elsewhere, borrow, delay, or
              redesign the service.
            </p>
          </DrillRow>
        </div>
      </section>

      <SourcesPointer
        icon={<Landmark size={16} />}
        count={sourceCount}
        kind="fiscal"
        onOpenSources={onOpenSources}
      />
    </>
  );
}

/** Slim pointer row — the full source catalog lives on the Transparency page. */
function SourcesPointer({
  icon,
  count,
  kind,
  onOpenSources
}: {
  icon: ReactNode;
  count: number;
  kind: "local" | "fiscal";
  onOpenSources?: () => void;
}) {
  if (!onOpenSources) return null;
  return (
    <button type="button" className="sources-pointer" onClick={onOpenSources}>
      {icon}
      <span>
        {count} {kind} source paths and methods — see the Transparency page
      </span>
      <ChevronRight size={15} />
    </button>
  );
}

/**
 * The full civic source catalog — every local layer, fiscal indicator and tax
 * scenario with its method and official link. Lives on the Transparency page;
 * the Local and Fiscal dashboards link here instead of carrying it themselves.
 */
export function CivicSourcesPanel() {
  const [local, setLocal] = useState<LocalCivicOverview | null>(null);
  const [fiscal, setFiscal] = useState<FiscalCivicOverview | null>(null);
  const [fellBack, setFellBack] = useState(false);

  useEffect(() => {
    let mounted = true;
    fetchLocalCivicOverview()
      .then((payload) => mounted && setLocal(payload))
      .catch(() => {
        if (!mounted) return;
        setFellBack(true);
        setLocal(fallbackLocalCivicOverview);
      });
    fetchFiscalCivicOverview()
      .then((payload) => mounted && setFiscal(payload))
      .catch(() => {
        if (!mounted) return;
        setFellBack(true);
        setFiscal(fallbackFiscalCivicOverview);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const localCount = local?.layers.length ?? 0;
  const fiscalCount = (fiscal?.indicators.length ?? 0) + (fiscal?.taxScenarios.length ?? 0);

  return (
    <>
      {fellBack && <DataSourceNotice dataSource="fallback" />}
      <section className="workspace-section">
        <div className="section-heading">
          <Map size={20} />
          <div>
            <h2>Local sources and methods</h2>
            <p>{localCount} source paths behind the Local dashboard.</p>
          </div>
        </div>
        <div className="civic-grid compact">
          {(local?.layers ?? []).map((layer) => (
            <LocalLayerCard key={layer.id} layer={layer} />
          ))}
          {!local && skeletonCards(4)}
        </div>
      </section>
      <section className="workspace-section">
        <div className="section-heading">
          <Landmark size={20} />
          <div>
            <h2>Fiscal sources and methods</h2>
            <p>{fiscalCount} source paths behind the Fiscal dashboard.</p>
          </div>
        </div>
        <div className="civic-grid compact">
          {(fiscal?.indicators ?? []).map((indicator) => (
            <FiscalIndicatorCard key={indicator.id} indicator={indicator} />
          ))}
          {(fiscal?.taxScenarios ?? []).map((scenario) => (
            <TaxScenarioCard key={scenario.id} scenario={scenario} />
          ))}
          {!fiscal && skeletonCards(4)}
        </div>
      </section>
    </>
  );
}

function DataSourceNotice({ dataSource }: { dataSource: "backend" | "fallback" }) {
  if (dataSource === "backend") return null;
  return (
    <section className="workspace-section civic-notice">
      <div className="section-heading">
        <ShieldCheck size={20} />
        <div>
          <h2>Built-in civic catalog</h2>
          <p>
            The updated backend is not available in this browser session, so this tab is showing the
            bundled source catalog and product model. Start the updated API to use live endpoints.
          </p>
        </div>
      </div>
    </section>
  );
}

function LocalLayerCard({ layer }: { layer: LocalCivicLayer }) {
  return (
    <article className="panel civic-card">
      <CardHeader title={layer.title} status={layer.status} icon={<Building2 size={17} />} />
      <p>{layer.summary}</p>
      <div className="civic-callout">
        <BookOpenCheck size={16} />
        <span>{layer.beginner_label}</span>
      </div>
      {layer.gamified_action && (
        <div className="civic-callout game">
          <Gamepad2 size={16} />
          <span>{layer.gamified_action}</span>
        </div>
      )}
      <CivicMeta label="Compass" value={layer.compass_potential} />
      <CivicMeta label="Aggregate" value={layer.aggregate_view} />
      {layer.source_url && (
        <SourceLink href={layer.source_url} label={layer.source_name ?? layer.source_id ?? "Source"} />
      )}
    </article>
  );
}

function FiscalIndicatorCard({ indicator }: { indicator: FiscalIndicator }) {
  return (
    <article className="panel civic-card">
      <CardHeader title={indicator.title} status={indicator.status} icon={<BarChart3 size={17} />} />
      <p>{indicator.plain_english}</p>
      <div className="civic-callout">
        <Scale size={16} />
        <span>{indicator.why_it_matters}</span>
      </div>
      <CivicMeta label="Measure" value={indicator.value_label} />
      <CivicMeta label="Trend" value={indicator.trend_label} />
      <CivicMeta label="Compass" value={indicator.compass_potential} />
      <CivicMeta label="Aggregate" value={indicator.aggregate_view} />
      {indicator.source_url && (
        <SourceLink
          href={indicator.source_url}
          label={indicator.source_name ?? indicator.source_id ?? "Source"}
        />
      )}
    </article>
  );
}

function TaxScenarioCard({ scenario }: { scenario: TaxScenario }) {
  return (
    <article className="panel civic-card tax-card">
      <CardHeader title={scenario.title} status={scenario.status} icon={<ReceiptText size={17} />} />
      <span className="civic-kicker">{scenario.persona}</span>
      <p>{scenario.plain_english}</p>
      <div className="tax-pattern">
        <strong>Visible pattern</strong>
        <span>{scenario.visible_pattern}</span>
      </div>
      <CivicMeta label="Compass" value={scenario.compass_potential} />
      <CivicMeta label="Aggregate" value={scenario.aggregate_view} />
    </article>
  );
}

function CardHeader({
  title,
  status,
  icon
}: {
  title: string;
  status: string;
  icon: ReactNode;
}) {
  return (
    <header className="civic-card-header">
      <div>
        {icon}
        <h3>{title}</h3>
      </div>
      <span className={status.includes("implemented") ? "status-pill live" : "status-pill"}>
        {status.includes("implemented") ? "spine live" : "planned"}
      </span>
    </header>
  );
}

function CivicMeta({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="civic-meta">
      <strong>{label}</strong>
      <span>{value}</span>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function skeletonCards(count: number) {
  return Array.from({ length: count }, (_, index) => (
    <article className="panel civic-card" key={index}>
      <div className="loading-line wide" />
      <div className="loading-line" />
      <div className="loading-line short" />
    </article>
  ));
}
