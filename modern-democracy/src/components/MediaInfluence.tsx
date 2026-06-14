import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, HelpCircle, Newspaper } from "lucide-react";
import { fetchMediaInfluence, type MediaInfluence as MediaInfluenceData } from "../lib/api";

function reliabilityColour(r: number | null) {
  if (r == null) return "#9aa6ad";
  if (r < 40) return "#bf443e";
  if (r < 60) return "#c9922c";
  return "#168a5a";
}

const LABEL_COPY: Record<string, { text: string; tone: string }> = {
  "well-corroborated": { text: "well corroborated", tone: "good" },
  contested: { text: "contested", tone: "watch" },
  "single-source": { text: "single source", tone: "watch" },
  opinion: { text: "opinion", tone: "muted" }
};

/**
 * Media influence on our democracy: where outlets sit on the compass, how
 * reliable their coverage is (corroboration-led, with the evidence shown), and
 * the narratives shaping the conversation. A landscape, not a list.
 */
export function MediaInfluence() {
  const [data, setData] = useState<MediaInfluenceData | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let mounted = true;
    fetchMediaInfluence()
      .then((d) => mounted && setData(d))
      .catch(() => mounted && setFailed(true));
    return () => {
      mounted = false;
    };
  }, []);

  if (failed) return <p className="muted">Media analysis needs the updated backend.</p>;
  if (!data) return <p className="muted">Reading the room…</p>;

  const size = 300;
  const pad = 24;
  const mid = size / 2;
  const plot = size - pad * 2;
  const place = (x: number, y: number) => ({ cx: mid + (x / 10) * (plot / 2), cy: mid - (y / 10) * (plot / 2) });

  return (
    <div className="media-influence">
      <div className="media-influence-stats">
        <span><CheckCircle2 size={14} /> {data.counts.corroborated} well-corroborated</span>
        <span><AlertTriangle size={14} /> {data.counts.contested} contested</span>
        <span><AlertTriangle size={14} /> {data.counts.single_source} single-source</span>
        <span className="muted">{data.counts.articles} stories assessed</span>
      </div>

      <div className="media-influence-grid">
        <div className="media-landscape-plot">
          <svg viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Where news outlets sit on the political compass">
            <rect className="compass-plot-area" x={pad} y={pad} width={plot} height={plot} rx="8" />
            <line x1={mid} y1={pad} x2={mid} y2={size - pad} />
            <line x1={pad} y1={mid} x2={size - pad} y2={mid} />
            <text x={mid} y={pad - 8} textAnchor="middle">Authoritarian</text>
            <text x={mid} y={size - 6} textAnchor="middle">Libertarian</text>
            <text x={pad - 4} y={mid + 4} textAnchor="end">Left</text>
            <text x={size - pad + 4} y={mid + 4}>Right</text>
            {data.outlets.map((o) => {
              const { cx, cy } = place(o.x, o.y);
              return (
                <circle key={o.name} cx={cx} cy={cy} r={5} fill={reliabilityColour(o.reliability)} opacity={0.85}>
                  <title>{o.name} — {o.reliability != null ? `${Math.round(o.reliability)}/100 reliability` : "reliability pending"}, {o.sample} scored</title>
                </circle>
              );
            })}
          </svg>
          <p className="muted media-plot-note">
            Each dot is an outlet, placed by the average framing of its recent coverage and coloured
            by factual reliability (green high → red low).
          </p>
        </div>

        <div className="media-outlet-list">
          <h4>Outlet reliability</h4>
          {data.outlets
            .slice()
            .sort((a, b) => (b.reliability ?? -1) - (a.reliability ?? -1))
            .slice(0, 8)
            .map((o) => (
              <div className="media-outlet-row" key={o.name}>
                <span className="media-outlet-name">{o.name}</span>
                <div className="bar">
                  <div
                    className="fill"
                    style={{ width: `${o.reliability ?? 0}%`, background: reliabilityColour(o.reliability) }}
                  />
                </div>
                <strong>{o.reliability != null ? Math.round(o.reliability) : "—"}</strong>
              </div>
            ))}
        </div>
      </div>

      <div className="media-narratives">
        <h4>
          <Newspaper size={15} /> Narratives shaping our politics
        </h4>
        {data.narratives.length === 0 ? (
          <p className="muted">Narratives surface as more coverage is ingested and scored.</p>
        ) : (
          <div className="narrative-grid">
            {data.narratives.map((n) => {
              const label = n.factualLabel ? LABEL_COPY[n.factualLabel] : null;
              return (
                <article className="narrative-card" key={n.narrative}>
                  <div className="narrative-head">
                    <strong>{n.narrative}</strong>
                    {label && <span className={`fact-pill ${label.tone}`}>{label.text}</span>}
                  </div>
                  <p className="muted">{n.summary}</p>
                  <span className="narrative-meta">
                    {n.articleCount} stories · {n.outlets.length} outlets
                    {n.lean && ` · lean (${n.lean.x.toFixed(1)}, ${n.lean.y.toFixed(1)})`}
                  </span>
                </article>
              );
            })}
          </div>
        )}
      </div>

      <p className="media-influence-note">
        <HelpCircle size={13} /> {data.note}
      </p>
    </div>
  );
}
