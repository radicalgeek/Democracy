import { useEffect, useState } from "react";
import { fetchNationalCompass, type NationalCompassPayload } from "../lib/api";

/**
 * The direction of the country, plotted from everything the platform stores:
 * how people vote (civic will), what they discuss and the sentiment of it,
 * average media influence, the governing party and the direction of its
 * current legislation, and every major party's revealed position.
 */
export function NationalCompass({ you }: { you: { x: number; y: number } | null }) {
  const [payload, setPayload] = useState<NationalCompassPayload | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let mounted = true;
    fetchNationalCompass()
      .then((data) => mounted && setPayload(data))
      .catch(() => mounted && setFailed(true));
    return () => {
      mounted = false;
    };
  }, []);

  if (failed) {
    return <p className="muted">The national compass needs the updated backend — start the new API to see it.</p>;
  }
  if (!payload) {
    return <p className="muted">Computing the national picture…</p>;
  }

  const size = 340;
  const padding = 26;
  const mid = size / 2;
  const plot = size - padding * 2;
  const place = (point: { x: number; y: number }) => ({
    cx: mid + (point.x / 10) * (plot / 2),
    cy: mid - (point.y / 10) * (plot / 2)
  });

  const partyColour = (colour: string | null) => (colour ? `#${colour.replace(/^#/, "")}` : "#66727a");
  const government = payload.government;
  const govPlaced = government?.party.compass ? place(government.party.compass) : null;
  const legislationPlaced = government?.legislation ? place(government.legislation) : null;
  const willPlaced = payload.civicWill ? place(payload.civicWill) : null;
  const discussionPlaced = payload.discussion ? place(payload.discussion) : null;
  const pollingPlaced = payload.polling ? place(payload.polling) : null;
  const mediaPlaced = payload.media.overall ? place(payload.media.overall) : null;
  const youPlaced = you ? place(you) : null;

  const formatPoint = (point: { x: number; y: number } | null) =>
    point ? `(${point.x.toFixed(1)}, ${point.y.toFixed(1)})` : "—";

  return (
    <div className="national-compass">
      <svg viewBox={`0 0 ${size} ${size}`} role="img" aria-label="The political direction of the country">
        <rect className="compass-plot-area" x={padding} y={padding} width={plot} height={plot} rx="8" />
        <line x1={mid} y1={padding} x2={mid} y2={size - padding} />
        <line x1={padding} y1={mid} x2={size - padding} y2={mid} />
        <text x={mid} y={padding - 8} textAnchor="middle">
          Authoritarian
        </text>
        <text x={mid} y={size - 6} textAnchor="middle">
          Libertarian
        </text>
        <text x={padding - 4} y={mid + 4} textAnchor="end">
          Left
        </text>
        <text x={size - padding + 4} y={mid + 4}>
          Right
        </text>

        {/* major parties, sized by seats */}
        {payload.parties.map((party) => {
          if (!party.compass) return null;
          const { cx, cy } = place(party.compass);
          const radius = 4 + Math.sqrt(party.seats) * 0.55;
          const isGoverning = government?.party.name === party.name;
          return (
            <g key={party.name}>
              <circle
                cx={cx}
                cy={cy}
                r={radius}
                fill={partyColour(party.colour)}
                opacity={0.78}
                stroke={isGoverning ? "#13232a" : "none"}
                strokeWidth={isGoverning ? 2.5 : 0}
              />
              <text className="party-label" x={cx} y={cy - radius - 4} textAnchor="middle">
                {party.abbreviation ?? party.name}
              </text>
            </g>
          );
        })}

        {/* direction of current legislation: arrow from governing party */}
        {govPlaced && legislationPlaced && (
          <g className="legislation-arrow">
            <defs>
              <marker id="direction-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                <path d="M0,0 L6,3 L0,6 Z" fill="#13232a" />
              </marker>
            </defs>
            <line
              x1={govPlaced.cx}
              y1={govPlaced.cy}
              x2={legislationPlaced.cx}
              y2={legislationPlaced.cy}
              style={{ stroke: "#13232a" }}
              strokeWidth={2}
              strokeDasharray="5 4"
              markerEnd="url(#direction-arrow)"
            />
          </g>
        )}

        {/* media influence average */}
        {mediaPlaced && (
          <rect
            className="compass-marker compass-marker-diamond"
            x={mediaPlaced.cx - 6}
            y={mediaPlaced.cy - 6}
            width={12}
            height={12}
            transform={`rotate(45 ${mediaPlaced.cx} ${mediaPlaced.cy})`}
            fill="#8a4f9e"
          />
        )}

        {/* public discussion */}
        {discussionPlaced && (
          <circle cx={discussionPlaced.cx} cy={discussionPlaced.cy} r={7} fill="none" stroke="#147b8e" strokeWidth={2.5} strokeDasharray="3 3" />
        )}

        {/* national polling — support-weighted public mood */}
        {pollingPlaced && (
          <g>
            <line x1={pollingPlaced.cx - 7} y1={pollingPlaced.cy} x2={pollingPlaced.cx + 7} y2={pollingPlaced.cy} stroke="#c97a1b" strokeWidth={2.5} />
            <line x1={pollingPlaced.cx} y1={pollingPlaced.cy - 7} x2={pollingPlaced.cx} y2={pollingPlaced.cy + 7} stroke="#c97a1b" strokeWidth={2.5} />
          </g>
        )}

        {/* civic will — the headline marker */}
        {willPlaced && (
          <g>
            <circle cx={willPlaced.cx} cy={willPlaced.cy} r={9} fill="#147b8e" opacity={0.92} />
            <circle cx={willPlaced.cx} cy={willPlaced.cy} r={13} fill="none" stroke="#147b8e" opacity={0.4} strokeWidth={2} />
          </g>
        )}

        {youPlaced && <circle className="compass-marker-you" cx={youPlaced.cx} cy={youPlaced.cy} r={6} fill="#bf443e" />}
      </svg>

      <div className="compass-legend national-legend">
        <div className="compass-legend-row">
          <span className="dot" style={{ background: "#147b8e" }} />
          <span className="legend-label">The public will</span>
          <span className="muted">
            {formatPoint(payload.civicWill)} · how people vote on bills and petitions here
            {payload.civicWill && ` (${payload.civicWill.sample} subjects)`}
          </span>
        </div>
        <div className="compass-legend-row">
          <span className="dot ring" />
          <span className="legend-label">Public discussion</span>
          <span className="muted">
            {formatPoint(payload.discussion)} · stance balance of the debate threads
          </span>
        </div>
        <div className="compass-legend-row">
          <span className="dot cross" style={{ color: "#c97a1b" }} />
          <span className="legend-label">National polling</span>
          <span className="muted">
            {formatPoint(payload.polling)} · party support (poll of polls) weighted onto each party's
            position — a derived mood point, not a measured public compass
          </span>
        </div>
        <div className="compass-legend-row">
          <span className="dot diamond" style={{ background: "#8a4f9e" }} />
          <span className="legend-label">Media influence</span>
          <span className="muted">
            {formatPoint(payload.media.overall)} · average coverage position
            {payload.media.overall && ` across ${payload.media.overall.sample} scored articles`}
          </span>
        </div>
        {government && (
          <div className="compass-legend-row">
            <span className="dot" style={{ background: partyColour(government.party.colour), boxShadow: "0 0 0 2px #13232a inset" }} />
            <span className="legend-label">Government ({government.party.abbreviation ?? government.party.name})</span>
            <span className="muted">
              {formatPoint(government.party.compass)} from division votes · arrow shows the direction
              of current legislation {formatPoint(government.legislation)}
            </span>
          </div>
        )}
        {youPlaced && you && (
          <div className="compass-legend-row">
            <span className="dot" style={{ background: "#bf443e" }} />
            <span className="legend-label">You</span>
            <span className="muted">{formatPoint(you)} · your questionnaire position</span>
          </div>
        )}
        <div className="national-party-strip">
          {payload.parties.map((party) => (
            <span key={party.name} className="national-party-chip">
              <i style={{ background: partyColour(party.colour) }} />
              {party.abbreviation ?? party.name} {formatPoint(party.compass)}
            </span>
          ))}
        </div>
        <p className="muted">
          Positions are revealed preference, not labels: parties and government from how they vote
          in divisions on compass-scored bills, the public from civic ballots, discussion from
          debate-post stances, media from scored coverage framing. National polling is the one
          external layer — current voting intention weighted onto party positions, for comparison.
        </p>
      </div>
    </div>
  );
}
