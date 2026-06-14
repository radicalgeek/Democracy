import { useEffect, useState } from "react";
import { Activity, CheckCircle2, Landmark, ScrollText, Vote, XCircle } from "lucide-react";
import { fetchBillStats, type BillStats } from "../lib/api";

/** Canonical order of the legislative journey, for the stage funnel. */
const STAGE_ORDER = [
  "1st reading",
  "2nd reading",
  "Committee stage",
  "Report stage",
  "3rd reading",
  "Consideration of amendments",
  "Royal Assent"
];

function orderStages(byStage: BillStats["byStage"]) {
  const known = STAGE_ORDER.map((stage) => byStage.find((s) => s.stage === stage)).filter(
    (s): s is { stage: string; count: number } => Boolean(s)
  );
  const extras = byStage
    .filter((s) => !STAGE_ORDER.includes(s.stage))
    .sort((a, b) => b.count - a.count);
  return [...known, ...extras];
}

/**
 * Rich statistics panel for the Bills screen: how many bills are progressing,
 * how many became law vs were defeated, where they sit in the process,
 * parliamentary throughput over time, and the civic engagement they attract.
 */
export function BillsStats({ onOpenBill }: { onOpenBill?: (billId: number) => void }) {
  const [stats, setStats] = useState<BillStats | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let mounted = true;
    fetchBillStats()
      .then((data) => mounted && setStats(data))
      .catch(() => mounted && setFailed(true));
    return () => {
      mounted = false;
    };
  }, []);

  if (failed) {
    return <p className="muted">Bill statistics need the updated backend — start the new API to see them.</p>;
  }
  if (!stats) {
    return <p className="muted">Crunching the numbers on every tracked bill…</p>;
  }

  const { totals, engagement } = stats;
  const stages = orderStages(stats.byStage);
  const maxStage = Math.max(...stages.map((s) => s.count), 1);
  const housePeak = Math.max(totals.commons, totals.lords, 1);

  return (
    <div className="bills-stats">
      <div className="bills-stat-cards">
        <StatCard icon={<ScrollText size={16} />} label="Tracked bills" value={totals.total} hint="in the imported window" />
        <StatCard
          icon={<CheckCircle2 size={16} />}
          label="Became law"
          value={totals.acts}
          hint={stats.passRate != null ? `${stats.passRate}% of decided bills passed` : "Royal Assent"}
          tone="pass"
        />
        <StatCard icon={<Activity size={16} />} label="In progress" value={totals.inProgress} hint="still before Parliament" />
        <StatCard
          icon={<XCircle size={16} />}
          label="Defeated"
          value={totals.defeated}
          hint={stats.failRate != null ? `${stats.failRate}% of decided bills fell` : "fell or withdrawn"}
          tone="fail"
        />
      </div>

      <div className="bills-stats-grid">
        <section className="bills-stats-panel">
          <h4>Where bills are in the process</h4>
          <div className="stage-funnel">
            {stages.map((stage) => (
              <div className="stage-bar" key={stage.stage}>
                <span className="stage-label">{stage.stage}</span>
                <div className="bar">
                  <div
                    className={stage.stage === "Royal Assent" ? "fill pass" : "fill"}
                    style={{ width: `${(stage.count / maxStage) * 100}%` }}
                  />
                </div>
                <strong>{stage.count}</strong>
              </div>
            ))}
          </div>
        </section>

        <section className="bills-stats-panel">
          <h4>By house</h4>
          <div className="house-split">
            <div className="house-row">
              <span className="house-label">Commons</span>
              <div className="bar">
                <div className="fill commons" style={{ width: `${(totals.commons / housePeak) * 100}%` }} />
              </div>
              <strong>{totals.commons}</strong>
            </div>
            <div className="house-row">
              <span className="house-label">Lords</span>
              <div className="bar">
                <div className="fill lords" style={{ width: `${(totals.lords / housePeak) * 100}%` }} />
              </div>
              <strong>{totals.lords}</strong>
            </div>
          </div>

          <h4 className="bills-engagement-head">Civic engagement</h4>
          <div className="bills-engagement">
            <span><Vote size={13} /> {engagement.ballots.toLocaleString()} civic ballots</span>
            <span><Landmark size={13} /> {engagement.divisions} divisions</span>
            <span><ScrollText size={13} /> {engagement.hansard} Hansard debates</span>
          </div>
        </section>

        <section className="bills-stats-panel wide">
          <h4>Parliamentary activity (last 18 months)</h4>
          <ThroughputChart points={stats.throughput} />
        </section>

        {stats.recentActs.length > 0 && (
          <section className="bills-stats-panel">
            <h4>Recently became law</h4>
            <div className="recent-acts">
              {stats.recentActs.map((act) => (
                <button
                  key={act.id}
                  className="recent-act"
                  onClick={() => onOpenBill?.(act.id)}
                  disabled={!onOpenBill}
                >
                  <CheckCircle2 size={13} />
                  <span className="recent-act-title">{act.title}</span>
                  <span className="muted">
                    {act.house ?? ""}
                    {act.lastUpdated
                      ? ` · ${new Date(act.lastUpdated).toLocaleDateString("en-GB", { month: "short", year: "numeric" })}`
                      : ""}
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  hint,
  tone
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  hint: string;
  tone?: "pass" | "fail";
}) {
  return (
    <div className={tone ? `bills-stat-card ${tone}` : "bills-stat-card"}>
      <div className="bills-stat-head">
        {icon}
        <span>{label}</span>
      </div>
      <strong>{value.toLocaleString()}</strong>
      <em>{hint}</em>
    </div>
  );
}

/** Monthly parliamentary-activity area chart (pure SVG). */
function ThroughputChart({ points }: { points: BillStats["throughput"] }) {
  if (points.length < 2) {
    return <p className="muted">The activity chart fills in as more dated stage events are imported.</p>;
  }
  const width = 560;
  const height = 170;
  const padX = 34;
  const padY = 14;
  const plotW = width - padX * 2;
  const plotH = height - padY * 2;
  const maxY = Math.max(...points.map((p) => p.events), 1);
  const niceMax = Math.ceil(maxY / 5) * 5;

  const x = (i: number) => padX + (i / (points.length - 1)) * plotW;
  const y = (v: number) => padY + plotH - (v / niceMax) * plotH;

  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.events).toFixed(1)}`).join(" ");
  const area = `${line} L${x(points.length - 1).toFixed(1)},${y(0)} L${x(0).toFixed(1)},${y(0)} Z`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Parliamentary activity over time" className="throughput-chart">
      {[0, niceMax / 2, niceMax].map((v) => (
        <g key={v}>
          <line x1={padX} y1={y(v)} x2={width - padX} y2={y(v)} className="chart-grid" />
          <text x={padX - 6} y={y(v) + 3} textAnchor="end" className="chart-axis">{Math.round(v)}</text>
        </g>
      ))}
      <path d={area} className="throughput-area" />
      <path d={line} className="throughput-line" />
      <text x={padX} y={height - 1} className="chart-axis">{points[0].month}</text>
      <text x={width - padX} y={height - 1} textAnchor="end" className="chart-axis">{points[points.length - 1].month}</text>
    </svg>
  );
}
