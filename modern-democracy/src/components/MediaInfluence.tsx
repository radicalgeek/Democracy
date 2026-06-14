import { useEffect, useState } from "react";
import { AlertTriangle, Building2, CheckCircle2, HelpCircle, Newspaper } from "lucide-react";
import { MiniCompass } from "./MiniCompass";
import { fetchMediaInfluence, type MediaInfluence as MediaInfluenceData } from "../lib/api";

function reliabilityColour(r: number | null) {
  if (r == null) return "#9aa6ad";
  if (r < 40) return "#bf443e";
  if (r < 60) return "#c9922c";
  return "#168a5a";
}
function reliabilityTone(r: number | null) {
  if (r == null) return "muted";
  if (r < 40) return "low";
  if (r < 60) return "watch";
  return "good";
}

/** Decode numeric HTML entities left in some feed titles. */
function decode(text: string) {
  return text
    .replace(/&#(\d+);/g, (_, c) => String.fromCharCode(Number(c)))
    .replace(/&#x([0-9a-f]+);/gi, (_, c) => String.fromCharCode(parseInt(c, 16)))
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'");
}

const LABEL_COPY: Record<string, { text: string; tone: string }> = {
  "well-corroborated": { text: "well corroborated", tone: "good" },
  contested: { text: "contested", tone: "watch" },
  "single-source": { text: "single source", tone: "watch" },
  opinion: { text: "opinion", tone: "muted" }
};

/**
 * Media influence on our democracy: one card per outlet (its own compass lean,
 * reliability, ownership and coverage breakdown), the stories worth scrutiny
 * (heavy bias / sensational / single-source / uncorroborated), and the
 * narratives shaping the conversation. `detailed` shows everything (Media page);
 * otherwise it's a dashboard summary.
 */
export function MediaInfluence({ detailed = false }: { detailed?: boolean }) {
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

  const outlets = data.outlets.slice().sort((a, b) => (b.reliability ?? -1) - (a.reliability ?? -1));
  const shownOutlets = detailed ? outlets : outlets.slice(0, 6);
  const shownFlagged = detailed ? data.flagged : data.flagged.slice(0, 4);
  const shownNarratives = detailed ? data.narratives : data.narratives.slice(0, 6);

  return (
    <div className="media-influence">
      <div className="media-influence-stats">
        <span><CheckCircle2 size={14} /> {data.counts.corroborated} well-corroborated</span>
        <span><AlertTriangle size={14} /> {data.counts.contested} contested</span>
        <span><AlertTriangle size={14} /> {data.counts.single_source} single-source</span>
        <span className="muted">{data.counts.articles} stories assessed · {data.outlets.length} outlets</span>
      </div>

      <div className="outlet-card-grid">
        {shownOutlets.map((o) => (
          <article className="outlet-card" key={o.name}>
            <div className="outlet-card-head">
              <strong>{o.name}</strong>
              <span className={`rel-pill ${reliabilityTone(o.reliability)}`}>
                {o.reliability != null ? `${Math.round(o.reliability)}` : "—"}
              </span>
            </div>
            <span className="outlet-owner">
              <Building2 size={11} /> {o.owner}
            </span>
            <div className="outlet-card-body">
              <MiniCompass
                markers={[{ x: o.x, y: o.y, label: o.name, color: reliabilityColour(o.reliability), shape: "diamond" }]}
                label={`${o.name} coverage lean`}
              />
              <div className="outlet-card-stats">
                <span>{o.sample} scored · lean ({o.x.toFixed(1)}, {o.y.toFixed(1)})</span>
                {o.sensational != null && (
                  <span className={o.sensational >= 0.4 ? "warn" : ""}>
                    {Math.round(o.sensational * 100)}% sensational language
                  </span>
                )}
                <div className="outlet-labels">
                  {o.labels.corroborated > 0 && <span className="fact-pill good">{o.labels.corroborated} corrob.</span>}
                  {o.labels.contested > 0 && <span className="fact-pill watch">{o.labels.contested} contested</span>}
                  {o.labels.singleSource > 0 && <span className="fact-pill watch">{o.labels.singleSource} single-src</span>}
                  {o.labels.opinion > 0 && <span className="fact-pill muted">{o.labels.opinion} opinion</span>}
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>

      {shownFlagged.length > 0 && (
        <div className="flagged-coverage">
          <h4><AlertTriangle size={15} /> Stories worth a closer read</h4>
          <p className="muted">
            Flagged for scrutiny — heavy framing, sensational language, single-source or
            uncorroborated claims. A prompt to read carefully, not a verdict that a story is false.
          </p>
          <div className="flagged-list">
            {shownFlagged.map((f) => (
              <a className="flagged-story" href={f.url} target="_blank" rel="noreferrer" key={f.id}>
                <div className="flagged-copy">
                  <strong>{decode(f.title)}</strong>
                  <span className="muted">
                    {f.source}
                    {f.publishedAt && ` · ${new Date(f.publishedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`}
                  </span>
                </div>
                <div className="flag-reasons">
                  {f.reasons.map((r) => (
                    <span className="flag-pill" key={r}>{r}</span>
                  ))}
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      <div className="media-narratives">
        <h4><Newspaper size={15} /> Narratives shaping our politics</h4>
        {shownNarratives.length === 0 ? (
          <p className="muted">Narratives surface as more coverage is ingested and scored.</p>
        ) : (
          <div className="narrative-grid">
            {shownNarratives.map((n) => {
              const label = n.factualLabel ? LABEL_COPY[n.factualLabel] : null;
              return (
                <article className="narrative-card" key={n.narrative}>
                  <div className="narrative-head">
                    <strong>{n.narrative}</strong>
                    {label && <span className={`fact-pill ${label.tone}`}>{label.text}</span>}
                  </div>
                  <p className="muted">{decode(n.summary)}</p>
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
