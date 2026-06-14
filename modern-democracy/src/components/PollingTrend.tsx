import type { PollingTrend as PollingTrendData } from "../lib/api";

/**
 * Poll-of-polls trend over time: one line per party from the dated averages.
 * Pure SVG, no deps. Source attribution is the caller's responsibility (the
 * snapshot card renders it once for the whole block).
 */
export function PollingTrend({ data }: { data: PollingTrendData }) {
  const points = data.points;
  if (points.length < 2) {
    return <p className="muted">The trend line fills in as more dated poll-of-polls averages are ingested.</p>;
  }

  const width = 520;
  const height = 200;
  const padX = 30;
  const padY = 16;
  const plotW = width - padX * 2;
  const plotH = height - padY * 2;

  const values = points.flatMap((point) =>
    data.parties.map((party) => point[party.code]).filter((v): v is number => typeof v === "number")
  );
  const maxY = Math.max(35, Math.ceil((Math.max(...values) + 4) / 5) * 5);

  const x = (index: number) => padX + (index / (points.length - 1)) * plotW;
  const y = (value: number) => padY + plotH - (value / maxY) * plotH;

  const gridLines = [0, maxY / 2, maxY];

  return (
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Poll of polls trend over time" className="polling-trend">
      {gridLines.map((value) => (
        <g key={value}>
          <line x1={padX} y1={y(value)} x2={width - padX} y2={y(value)} className="polling-grid" />
          <text x={padX - 6} y={y(value) + 3} textAnchor="end" className="polling-axis">
            {Math.round(value)}
          </text>
        </g>
      ))}
      {data.parties.map((party) => {
        const path = points
          .map((point, index) => {
            const value = point[party.code];
            if (typeof value !== "number") return null;
            return `${index === 0 ? "M" : "L"}${x(index).toFixed(1)},${y(value).toFixed(1)}`;
          })
          .filter(Boolean)
          .join(" ");
        if (!path) return null;
        const last = [...points].reverse().find((point) => typeof point[party.code] === "number");
        return (
          <g key={party.code}>
            <path d={path} fill="none" stroke={`#${party.colour}`} strokeWidth={2} />
            {last && typeof last[party.code] === "number" && (
              <circle cx={x(points.length - 1)} cy={y(last[party.code])} r={2.6} fill={`#${party.colour}`} />
            )}
          </g>
        );
      })}
      <text x={padX} y={height - 2} className="polling-axis">
        {points[0].date}
      </text>
      <text x={width - padX} y={height - 2} textAnchor="end" className="polling-axis">
        {points[points.length - 1].date}
      </text>
    </svg>
  );
}
