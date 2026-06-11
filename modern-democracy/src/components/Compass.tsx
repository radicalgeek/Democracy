import type { CompassPoint } from "../data/types";

type CompassProps = {
  point: CompassPoint;
  compact?: boolean;
};

export function Compass({ point, compact = false }: CompassProps) {
  const size = compact ? 160 : 220;
  const padding = 18;
  const mid = size / 2;
  const plotSize = size - padding * 2;
  const x = mid + (point.x * plotSize) / 2;
  const y = mid - (point.y * plotSize) / 2;

  return (
    <div className={compact ? "compass compact" : "compass"}>
      <svg
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={`Political compass position: ${point.label}`}
      >
        <rect x={padding} y={padding} width={plotSize} height={plotSize} rx="8" />
        <line x1={mid} y1={padding} x2={mid} y2={size - padding} />
        <line x1={padding} y1={mid} x2={size - padding} y2={mid} />
        <text x={mid} y={padding - 5} textAnchor="middle">
          Authoritarian
        </text>
        <text x={mid} y={size - 3} textAnchor="middle">
          Libertarian
        </text>
        <text x={padding - 4} y={mid + 4} textAnchor="end">
          Left
        </text>
        <text x={size - padding + 4} y={mid + 4}>
          Right
        </text>
        <circle cx={x} cy={y} r={compact ? 6 : 8} />
      </svg>
      <div>
        <strong>{point.label}</strong>
        <span>{Math.round(point.confidence * 100)}% confidence</span>
      </div>
    </div>
  );
}
