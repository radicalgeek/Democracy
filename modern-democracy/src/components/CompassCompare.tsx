import type { CompassComparison } from "../lib/api";

type ExtraPoint = {
  key: string;
  label: string;
  color: string;
  point: { x: number; y: number; sample: number };
};

type CompassCompareProps = {
  compass: CompassComparison;
  mpName: string | null;
  constituencyName: string;
  you?: { x: number; y: number } | null;
  extras?: ExtraPoint[];
};

const COLORS = {
  you: "#bf443e",
  mp: "#147b8e",
  party: "#c9922c",
  constituency: "#168a5a",
  national: "#356caa"
} as const;

/**
 * Plots MP / party / constituency / country compass positions (±10 scale,
 * derived from votes on compass-scored bills) on one chart with proximity
 * scores between them.
 */
export function CompassCompare({ compass, mpName, constituencyName, you, extras }: CompassCompareProps) {
  const size = 260;
  const padding = 22;
  const mid = size / 2;
  const plot = size - padding * 2;
  const place = (point: { x: number; y: number }) => ({
    cx: mid + (point.x / 10) * (plot / 2),
    cy: mid - (point.y / 10) * (plot / 2)
  });

  const points = [
    { key: "you", label: "You (questionnaire)", point: you ? { ...you, sample: 1 } : null },
    { key: "mp", label: mpName ?? "MP", point: compass.mp },
    { key: "party", label: compass.partyName ?? "Party", point: compass.party },
    { key: "constituency", label: constituencyName, point: compass.constituency },
    { key: "national", label: "Country (civic votes)", point: compass.national }
  ].filter((entry) => entry.point != null) as Array<{
    key: keyof typeof COLORS;
    label: string;
    point: { x: number; y: number; sample: number };
  }>;

  if (points.length === 0) {
    return (
      <p className="muted">
        Not enough compass-scored votes yet — positions appear once bills with divisions have been
        analysed.
      </p>
    );
  }

  const proximities = compass.proximities;
  const youMp =
    you && compass.mp
      ? Math.max(
          0,
          Math.round(100 * (1 - Math.hypot(you.x - compass.mp.x, you.y - compass.mp.y) / Math.hypot(20, 20)))
        )
      : null;
  const bars = [
    { label: "You ↔ MP", value: youMp },
    { label: `MP ↔ ${constituencyName}`, value: proximities?.mpConstituency },
    { label: "MP ↔ Country", value: proximities?.mpNational },
    { label: `MP ↔ ${compass.partyName ?? "Party"}`, value: proximities?.mpParty },
    { label: `${compass.partyName ?? "Party"} ↔ Country`, value: proximities?.partyNational }
  ].filter((bar) => bar.value != null);

  return (
    <div className="compass-compare">
      <svg viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Political compass comparison">
        <rect x={padding} y={padding} width={plot} height={plot} rx="8" />
        <line x1={mid} y1={padding} x2={mid} y2={size - padding} />
        <line x1={padding} y1={mid} x2={size - padding} y2={mid} />
        <text x={mid} y={padding - 6} textAnchor="middle">
          Authoritarian
        </text>
        <text x={mid} y={size - 4} textAnchor="middle">
          Libertarian
        </text>
        <text x={padding - 4} y={mid + 4} textAnchor="end">
          Left
        </text>
        <text x={size - padding + 4} y={mid + 4}>
          Right
        </text>
        {(extras ?? []).map((entry) => {
          const { cx, cy } = place(entry.point);
          return (
            <rect
              key={entry.key}
              x={cx - 5}
              y={cy - 5}
              width={10}
              height={10}
              transform={`rotate(45 ${cx} ${cy})`}
              fill={entry.color}
              opacity={0.85}
            />
          );
        })}
        {points.map((entry) => {
          const { cx, cy } = place(entry.point);
          return <circle key={entry.key} cx={cx} cy={cy} r={7} fill={COLORS[entry.key]} />;
        })}
      </svg>
      <div className="compass-legend">
        {points.map((entry) => (
          <div key={entry.key} className="compass-legend-row">
            <span className="dot" style={{ background: COLORS[entry.key] }} />
            <span className="legend-label">{entry.label}</span>
            <span className="muted">
              ({entry.point.x.toFixed(1)}, {entry.point.y.toFixed(1)})
              {entry.key !== "you" && ` · ${entry.point.sample} votes`}
            </span>
          </div>
        ))}
        {(extras ?? []).map((entry) => (
          <div key={entry.key} className="compass-legend-row">
            <span className="dot diamond" style={{ background: entry.color }} />
            <span className="legend-label">{entry.label}</span>
            <span className="muted">
              ({entry.point.x.toFixed(1)}, {entry.point.y.toFixed(1)}) · {entry.point.sample} articles
            </span>
          </div>
        ))}
        {bars.length > 0 && (
          <div className="proximity-bars">
            {bars.map((bar) => (
              <div key={bar.label} className="proximity-bar">
                <span>{bar.label}</span>
                <div className="bar">
                  <div className="fill" style={{ width: `${bar.value}%` }} />
                </div>
                <strong>{bar.value}%</strong>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
