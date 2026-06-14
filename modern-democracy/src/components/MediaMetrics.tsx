import { useEffect, useState } from "react";
import { Activity, Building2, Megaphone, Newspaper, Scale as ScaleIcon } from "lucide-react";
import {
  fetchMediaMetrics,
  fetchNationalCompass,
  type MediaMetrics as MediaMetricsData,
  type NationalCompassPayload
} from "../lib/api";

const colour = (c: string | null) => (c ? `#${c.replace(/^#/, "")}` : "#66727a");
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
const closeness = (d: number) => Math.max(0, Math.min(100, Math.round(100 * (1 - d / 20))));

/**
 * Media-influence metrics: agenda-setting (share of voice, agenda leadership),
 * treatment (tone asymmetry), information quality (reliability of the diet),
 * and ownership plurality. Signal-first. `compact` shows just the headline
 * tiles (dashboard); full shows everything (Media page).
 */
export function MediaMetrics({ compact = false }: { compact?: boolean }) {
  const [m, setM] = useState<MediaMetricsData | null>(null);
  const [nc, setNc] = useState<NationalCompassPayload | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let on = true;
    fetchMediaMetrics().then((d) => on && setM(d)).catch(() => on && setFailed(true));
    fetchNationalCompass().then((d) => on && setNc(d)).catch(() => {});
    return () => {
      on = false;
    };
  }, []);

  if (failed) return <p className="muted">Media metrics need the updated backend.</p>;
  if (!m) return <p className="muted">Measuring media influence…</p>;

  const mix = m.reliabilityMix;
  const corroboratedPct = mix && mix.total ? Math.round((mix.corroborated / mix.total) * 100) : null;
  const mediaPublic =
    m.mediaOverall && nc?.civicWill ? closeness(dist(m.mediaOverall, nc.civicWill)) : null;

  const tiles = (
    <div className="mm-tiles">
      <div className="mm-tile">
        <span className="mm-tile-head"><Newspaper size={14} /> Information quality</span>
        <strong>{corroboratedPct != null ? `${corroboratedPct}%` : "—"}</strong>
        <em>well-corroborated{mix ? ` of ${mix.total} stories` : ""}</em>
      </div>
      <div className="mm-tile">
        <span className="mm-tile-head"><Building2 size={14} /> Ownership concentration</span>
        <strong>{m.ownership.top3Share}%</strong>
        <em>from the top 3 owners{m.ownership.byOwner.length ? ` of ${m.ownership.byOwner.length}` : ""}</em>
      </div>
      <div className="mm-tile">
        <span className="mm-tile-head"><Activity size={14} /> Sensationalism</span>
        <strong>{mix ? `${Math.round((mix.sensational ?? 0) * 100)}%` : "—"}</strong>
        <em>average sensational language</em>
      </div>
      <div className="mm-tile">
        <span className="mm-tile-head"><ScaleIcon size={14} /> Media ↔ public</span>
        <strong>{mediaPublic != null ? `${mediaPublic}%` : "—"}</strong>
        <em>common ground with the public will</em>
      </div>
    </div>
  );

  if (compact) return <div className="media-metrics">{tiles}</div>;

  const maxSov = Math.max(...m.shareOfVoice.parties.map((p) => p.count), 1);
  const maxOwner = Math.max(...m.ownership.byOwner.map((o) => o.share), 1);
  const maxOrigins = Math.max(...m.agendaLeadership.map((l) => l.origins), 1);

  return (
    <div className="media-metrics">
      {tiles}

      <div className="mm-grid">
        <section className="mm-panel">
          <h4><Megaphone size={15} /> Share of voice — who gets the airtime</h4>
          <div className="mm-bars">
            {m.shareOfVoice.parties.map((p) => (
              <div className="mm-bar" key={p.name}>
                <span className="mm-bar-label">{p.name}</span>
                <div className="bar"><div className="fill" style={{ width: `${(p.count / maxSov) * 100}%`, background: colour(p.colour) }} /></div>
                <strong>{p.count}</strong>
              </div>
            ))}
          </div>
          {m.shareOfVoice.members.length > 0 && (
            <p className="muted mm-sub">Most-covered MPs: {m.shareOfVoice.members.slice(0, 5).map((x) => `${x.name} (${x.count})`).join(" · ")}</p>
          )}
        </section>

        <section className="mm-panel">
          <h4><ScaleIcon size={15} /> Tone asymmetry — is coverage even-handed?</h4>
          <p className="muted mm-sub">
            Share of each party's coverage flagged (sensational / contested / single-source). Average is {m.meanHostileRate}%. Above-average is highlighted — a prompt to scrutinise, not a verdict.
          </p>
          <div className="mm-bars">
            {m.toneByParty.map((t) => {
              const hot = t.hostileRate >= m.meanHostileRate + 12;
              return (
                <div className="mm-bar" key={t.name}>
                  <span className="mm-bar-label">{t.name}</span>
                  <div className="bar"><div className="fill" style={{ width: `${t.hostileRate}%`, background: hot ? "#bf443e" : "#c9922c" }} /></div>
                  <strong className={hot ? "warn" : ""}>{t.hostileRate}%</strong>
                </div>
              );
            })}
          </div>
        </section>

        <section className="mm-panel">
          <h4><Building2 size={15} /> Ownership concentration</h4>
          <p className="muted mm-sub">Share of recent political coverage by owner. Concentration index (HHI): {m.ownership.hhi} (0 = plural, 1 = monopoly).</p>
          <div className="mm-bars">
            {m.ownership.byOwner.slice(0, 7).map((o) => (
              <div className="mm-bar" key={o.owner}>
                <span className="mm-bar-label" title={o.owner}>{o.owner}</span>
                <div className="bar"><div className="fill" style={{ width: `${(o.share / maxOwner) * 100}%` }} /></div>
                <strong>{o.share}%</strong>
              </div>
            ))}
          </div>
        </section>

        <section className="mm-panel">
          <h4><Newspaper size={15} /> Quality of the news diet</h4>
          {mix && (
            <div className="mm-stack" role="img" aria-label="Reliability mix">
              {([
                ["corroborated", mix.corroborated, "#168a5a"],
                ["contested", mix.contested, "#c9922c"],
                ["single-source", mix.single_source, "#bf443e"],
                ["opinion", mix.opinion, "#8a4f9e"]
              ] as Array<[string, number, string]>).map(([label, n, col]) => {
                const pct = mix.total ? (n / mix.total) * 100 : 0;
                return pct > 0 ? <span key={label} className="mm-stack-seg" style={{ width: `${pct}%`, background: col }} title={`${label}: ${n}`} /> : null;
              })}
            </div>
          )}
          <TrendSpark points={m.reliabilityTrend} />
        </section>

        <section className="mm-panel">
          <h4><Megaphone size={15} /> Agenda leadership — who breaks the stories</h4>
          <p className="muted mm-sub">Outlets that published first in a corroborated story cluster.</p>
          <div className="mm-bars">
            {m.agendaLeadership.length === 0 ? (
              <p className="muted">No corroborated clusters identified yet.</p>
            ) : (
              m.agendaLeadership.map((l) => (
                <div className="mm-bar" key={l.outlet}>
                  <span className="mm-bar-label">{l.outlet}</span>
                  <div className="bar"><div className="fill" style={{ width: `${(l.origins / maxOrigins) * 100}%`, background: "#147b8e" }} /></div>
                  <strong>{l.origins}</strong>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      <p className="media-influence-note">{m.note}</p>
    </div>
  );
}

function TrendSpark({ points }: { points: MediaMetricsData["reliabilityTrend"] }) {
  if (points.length < 2) return <p className="muted mm-sub">Trend builds as more weeks of coverage are scored.</p>;
  const w = 360;
  const h = 70;
  const px = 6;
  const x = (i: number) => px + (i / (points.length - 1)) * (w - px * 2);
  const y = (v: number) => h - 10 - (v / 100) * (h - 20);
  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.corroboratedPct).toFixed(1)}`).join(" ");
  return (
    <div className="mm-spark">
      <span className="muted mm-sub">Well-corroborated share, last {points.length} weeks</span>
      <svg viewBox={`0 0 ${w} ${h}`} className="mm-spark-svg" role="img" aria-label="Corroborated share trend">
        <path d={line} fill="none" stroke="#168a5a" strokeWidth={2} />
        <circle cx={x(points.length - 1)} cy={y(points[points.length - 1].corroboratedPct)} r={2.6} fill="#168a5a" />
      </svg>
    </div>
  );
}
