import type { MediaCompassPayload } from "../lib/api";

type MediaLandscapeProps = {
  media: MediaCompassPayload;
  you: { x: number; y: number } | null;
};

const OUTLET_COLORS = ["#356caa", "#bf8a2e", "#168a5a", "#8a4f9e", "#b3552f", "#147b8e", "#7a7f4b"];

function proximity(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.max(0, Math.round(100 * (1 - Math.hypot(a.x - b.x, a.y - b.y) / Math.hypot(20, 20))));
}

/**
 * Where the outlets we ingest sit on the compass, judged from the framing of
 * their recent politics coverage, and — when the user has taken the
 * questionnaire — how close each one is to them.
 */
export function MediaLandscape({ media, you }: MediaLandscapeProps) {
  if (media.outlets.length === 0) {
    return <p className="muted">No compass-scored coverage yet — articles are scored as they are ingested.</p>;
  }

  const size = 260;
  const padding = 22;
  const mid = size / 2;
  const plot = size - padding * 2;
  const place = (point: { x: number; y: number }) => ({
    cx: mid + (point.x / 10) * (plot / 2),
    cy: mid - (point.y / 10) * (plot / 2)
  });

  const ranked = you
    ? [...media.outlets].sort((a, b) => proximity(you, b) - proximity(you, a))
    : media.outlets;
  const youPlaced = you ? place(you) : null;

  return (
    <div className="compass-compare">
      <svg viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Media outlets on the political compass">
        <rect className="compass-plot-area" x={padding} y={padding} width={plot} height={plot} rx="8" />
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
        {media.outlets.map((outlet, index) => {
          const { cx, cy } = place(outlet);
          return (
            <rect
              key={outlet.name}
              className="compass-marker compass-marker-diamond"
              x={cx - 5}
              y={cy - 5}
              width={10}
              height={10}
              transform={`rotate(45 ${cx} ${cy})`}
              fill={OUTLET_COLORS[index % OUTLET_COLORS.length]}
              opacity={0.9}
            />
          );
        })}
        {youPlaced && (
          <circle className="compass-marker compass-marker-you" cx={youPlaced.cx} cy={youPlaced.cy} r={7} fill="#bf443e" />
        )}
      </svg>
      <div className="compass-legend">
        {you && (
          <div className="compass-legend-row">
            <span className="dot" style={{ background: "#bf443e" }} />
            <span className="legend-label">You (questionnaire)</span>
            <span className="muted">
              ({you.x.toFixed(1)}, {you.y.toFixed(1)})
            </span>
          </div>
        )}
        <div className="proximity-bars">
          {ranked.map((outlet) => {
            const index = media.outlets.indexOf(outlet);
            const value = you ? proximity(you, outlet) : null;
            return (
              <div key={outlet.name} className="proximity-bar">
                <span>
                  <i
                    className="dot diamond"
                    style={{ background: OUTLET_COLORS[index % OUTLET_COLORS.length] }}
                  />{" "}
                  {outlet.name}
                  <em className="muted"> · {outlet.sample} articles</em>
                </span>
                {value != null ? (
                  <>
                    <div className="bar">
                      <div className="fill" style={{ width: `${value}%` }} />
                    </div>
                    <strong>{value}%</strong>
                  </>
                ) : (
                  <strong className="muted">
                    ({outlet.x.toFixed(1)}, {outlet.y.toFixed(1)})
                  </strong>
                )}
              </div>
            );
          })}
        </div>
        <p className="muted">
          Outlet positions are the mean compass score of their recent politics coverage as framed in
          headlines and summaries — coverage lean, not a verdict on the outlet.
          {you && " Bars show how close each outlet's coverage sits to your questionnaire position."}
        </p>
      </div>
    </div>
  );
}
