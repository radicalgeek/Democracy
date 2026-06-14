export type CompassMarker = {
  x: number;
  y: number;
  label: string;
  color: string;
  shape?: "circle" | "diamond";
};

export function MiniCompass({
  markers,
  connect = false,
  label,
  showLegend = markers.length > 1
}: {
  markers: CompassMarker[];
  connect?: boolean;
  label: string;
  showLegend?: boolean;
}) {
  const size = 112;
  const padding = 14;
  const mid = size / 2;
  const plot = size - padding * 2;
  const place = (marker: CompassMarker) => ({
    x: mid + (marker.x / 10) * (plot / 2),
    y: mid - (marker.y / 10) * (plot / 2)
  });
  const placed = markers.map((marker) => ({ marker, ...place(marker) }));

  return (
    <div className={showLegend ? "mini-compass-frame with-key" : "mini-compass-frame"}>
      <svg className="mini-compass" viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label}>
        <rect className="mini-compass-area" x={padding} y={padding} width={plot} height={plot} rx="7" />
        <line x1={mid} y1={padding} x2={mid} y2={size - padding} />
        <line x1={padding} y1={mid} x2={size - padding} y2={mid} />
        <text x={mid} y={padding - 4} textAnchor="middle">
          Auth
        </text>
        <text x={mid} y={size - 4} textAnchor="middle">
          Lib
        </text>
        <text x={padding - 4} y={mid + 3} textAnchor="end">
          L
        </text>
        <text x={size - padding + 4} y={mid + 3}>
          R
        </text>
        {connect && placed.length >= 2 && (
          <line
            className="mini-compass-link"
            x1={placed[0].x}
            y1={placed[0].y}
            x2={placed[1].x}
            y2={placed[1].y}
          />
        )}
        {placed.map(({ marker, x, y }) =>
          marker.shape === "diamond" ? (
            <rect
              key={marker.label}
              className="mini-compass-marker"
              x={x - 4.5}
              y={y - 4.5}
              width={9}
              height={9}
              transform={`rotate(45 ${x} ${y})`}
              fill={marker.color}
            >
              <title>{marker.label}</title>
            </rect>
          ) : (
            <circle
              key={marker.label}
              className="mini-compass-marker"
              cx={x}
              cy={y}
              r={5}
              fill={marker.color}
            >
              <title>{marker.label}</title>
            </circle>
          )
        )}
      </svg>
      {showLegend && markers.length > 1 && (
        <div className="mini-compass-key" aria-hidden="true">
          {markers.map((marker) => (
            <span key={marker.label}>
              <i
                className={marker.shape === "diamond" ? "diamond" : "circle"}
                style={{ backgroundColor: marker.color }}
              />
              {marker.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
