import { useEffect, useState } from "react";
import { fetchPartyPopularity, type PartyPopularity as Data } from "../lib/api";
import { NewsMentions } from "./NewsMentions";

/**
 * A party's polling trend with the news events around it — coverage and support
 * shown together as context (correlation, not proof of cause).
 */
export function PartyPopularity({ partyId, colour }: { partyId: number; colour: string }) {
  const [data, setData] = useState<Data | null>(null);

  useEffect(() => {
    let mounted = true;
    fetchPartyPopularity(partyId)
      .then((d) => mounted && setData(d))
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, [partyId]);

  if (!data) return <p className="muted">Loading popularity…</p>;
  if (data.trend.length < 2) {
    return <p className="muted">Not enough polling history yet to plot this party's trend.</p>;
  }

  const width = 520;
  const height = 170;
  const padX = 30;
  const padY = 14;
  const plotW = width - padX * 2;
  const plotH = height - padY * 2;
  const max = Math.max(...data.trend.map((p) => p.percent), 10);
  const niceMax = Math.ceil(max / 5) * 5;
  const x = (i: number) => padX + (i / (data.trend.length - 1)) * plotW;
  const y = (v: number) => padY + plotH - (v / niceMax) * plotH;
  const line = data.trend.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.percent).toFixed(1)}`).join(" ");

  // Map each event date onto the trend line for a marker.
  const firstDate = new Date(data.trend[0].date).getTime();
  const lastDate = new Date(data.trend[data.trend.length - 1].date).getTime();
  const span = Math.max(1, lastDate - firstDate);
  const eventX = (d: string) => padX + ((new Date(d).getTime() - firstDate) / span) * plotW;

  return (
    <div className="party-popularity">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Party polling trend with news events" className="popularity-chart">
        {[0, niceMax / 2, niceMax].map((v) => (
          <g key={v}>
            <line x1={padX} y1={y(v)} x2={width - padX} y2={y(v)} className="chart-grid" />
            <text x={padX - 6} y={y(v) + 3} textAnchor="end" className="chart-axis">{Math.round(v)}</text>
          </g>
        ))}
        {data.events.map((e, i) => {
          const ex = eventX(e.date);
          if (ex < padX || ex > width - padX) return null;
          return <line key={i} x1={ex} y1={padY} x2={ex} y2={height - padY} className="event-marker" />;
        })}
        <path d={line} fill="none" stroke={colour} strokeWidth={2.4} />
        <circle cx={x(data.trend.length - 1)} cy={y(data.trend[data.trend.length - 1].percent)} r={3} fill={colour} />
        <text x={padX} y={height - 1} className="chart-axis">{data.trend[0].date}</text>
        <text x={width - padX} y={height - 1} textAnchor="end" className="chart-axis">{data.trend[data.trend.length - 1].date}</text>
      </svg>
      <p className="muted popularity-note">{data.note} Vertical lines mark dated news events below.</p>
      <NewsMentions items={data.events.map((e, i) => ({
        id: i + 1,
        title: e.title,
        url: e.url,
        source: e.source ?? "Unknown source",
        publishedAt: e.date,
        compass: null,
        bias: e.bias,
        factualLabel: e.factualLabel,
        factualScore: null,
        corroboratingOutlets: 0
      }))} emptyText="No dated news events for this party yet." />
    </div>
  );
}
