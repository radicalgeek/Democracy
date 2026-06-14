import { useEffect, useMemo, useState } from "react";
import { Activity, Compass as CompassIcon, MessagesSquare, ScrollText, Users2 } from "lucide-react";
import { NationalCompass } from "./NationalCompass";
import { HelpTrigger } from "./HelpTrigger";
import { HelpCircle } from "lucide-react";
import {
  fetchBillStats,
  fetchNationalCompass,
  type BillStats,
  type NationalCompassPayload,
  type NationalCompassVector
} from "../lib/api";

type Vec = { x: number; y: number };

const distance = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y);
/** Compass distance → friendly "common ground" percentage (closer = higher). */
const commonGround = (d: number) => Math.max(0, Math.min(100, Math.round(100 * (1 - d / 20))));

/**
 * The home centrepiece: the health of our democracy expressed on the political
 * compass. It plots the whole of society — the public's civic votes, the
 * national mood, the debate, the media, the government and every party — and
 * places "you" within that spread. The framing is belonging, not opposition:
 * we show where your views sit among everyone else's and the common ground you
 * share, never "you vs them".
 */
export function DemocracyHealth({
  you,
  onStartTour
}: {
  you: Vec | null;
  onStartTour: () => void;
}) {
  const [nc, setNc] = useState<NationalCompassPayload | null>(null);
  const [stats, setStats] = useState<BillStats | null>(null);

  useEffect(() => {
    let mounted = true;
    fetchNationalCompass().then((d) => mounted && setNc(d)).catch(() => {});
    fetchBillStats().then((d) => mounted && setStats(d)).catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  // Where you sit among society — ranked by shared ground (positive framing).
  const neighbours = useMemo(() => {
    if (!you || !nc) return [];
    const vec = (v: NationalCompassVector) => (v ? { x: v.x, y: v.y } : null);
    const points: Array<{ label: string; v: Vec | null; colour: string }> = [
      { label: "the public's civic votes", v: vec(nc.civicWill), colour: "#147b8e" },
      { label: "national polling", v: vec(nc.polling), colour: "#c97a1b" },
      { label: "the public debate", v: vec(nc.discussion), colour: "#147b8e" },
      { label: "media coverage", v: vec(nc.media.overall), colour: "#8a4f9e" },
      ...(nc.government
        ? [
            {
              label: `the government (${nc.government.party.abbreviation ?? nc.government.party.name})`,
              v: vec(nc.government.party.compass),
              colour: nc.government.party.colour ? `#${nc.government.party.colour}` : "#66727a"
            }
          ]
        : []),
      ...nc.parties.map((p) => ({
        label: p.name,
        v: vec(p.compass),
        colour: p.colour ? `#${p.colour}` : "#66727a"
      }))
    ];
    return points
      .filter((p): p is { label: string; v: Vec; colour: string } => Boolean(p.v))
      .map((p) => ({ ...p, pct: commonGround(distance(you, p.v)) }))
      .sort((a, b) => b.pct - a.pct);
  }, [you, nc]);

  // Representation alignment: how close the public's will is to the government.
  const alignment = useMemo(() => {
    if (!nc?.civicWill || !nc.government?.party.compass) return null;
    return commonGround(distance(nc.civicWill, nc.government.party.compass));
  }, [nc]);

  return (
    <section className="workspace-section">
      <div className="section-heading">
        <CompassIcon size={20} />
        <div>
          <h2>The state of our democracy</h2>
          <p>
            Everything we collect on one compass — how the country votes, debates, polls and
            governs — with your own position shown among it. This is where you sit in the national
            picture, not against it.
            <HelpTrigger topicId="compass" inline>
              <HelpCircle size={15} />
            </HelpTrigger>
          </p>
        </div>
      </div>

      <div className="democracy-health">
        <div className="panel democracy-compass">
          <NationalCompass you={you} payload={nc} />
        </div>

        <div className="panel common-ground">
          <h3>
            <Users2 size={16} /> Where you sit in society
          </h3>
          {!you ? (
            <>
              <p className="muted">
                Place yourself on the compass to see the common ground you share with the public,
                the parties and the government.
              </p>
              <button className="primary" onClick={onStartTour}>
                Find your position
              </button>
            </>
          ) : neighbours.length === 0 ? (
            <p className="muted">Mapping society's positions…</p>
          ) : (
            <>
              <p className="muted">
                The common ground your compass position shares with the rest of the country —
                closest first.
              </p>
              <div className="common-ground-list">
                {neighbours.slice(0, 6).map((n) => (
                  <div className="common-ground-row" key={n.label}>
                    <span className="cg-label">
                      <i style={{ background: n.colour }} />
                      {n.label}
                    </span>
                    <div className="bar">
                      <div className="fill" style={{ width: `${n.pct}%`, background: n.colour }} />
                    </div>
                    <strong>{n.pct}%</strong>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="health-tiles">
        <HealthTile
          icon={<Users2 size={15} />}
          label="Participation"
          value={stats ? stats.engagement.ballots.toLocaleString() : "—"}
          hint={stats ? `civic ballots · ${stats.engagement.posts} debate posts` : "civic ballots cast"}
        />
        <HealthTile
          icon={<MessagesSquare size={15} />}
          label="Open debate"
          value={stats ? String(stats.engagement.hansard) : "—"}
          hint={stats ? `Hansard debates · ${nc?.parties.length ?? 0} parties mapped` : "debates tracked"}
        />
        <HealthTile
          icon={<ScrollText size={15} />}
          label="Legislation moving"
          value={stats ? String(stats.totals.inProgress) : "—"}
          hint={
            stats
              ? `before Parliament · ${stats.totals.acts} became law${stats.passRate != null ? ` (${stats.passRate}%)` : ""}`
              : "bills in progress"
          }
        />
        <HealthTile
          icon={<Activity size={15} />}
          label="Public ↔ government"
          value={alignment != null ? `${alignment}%` : "—"}
          hint="common ground on the compass"
          tone={alignment != null ? (alignment >= 50 ? "good" : "watch") : undefined}
        />
      </div>
    </section>
  );
}

function HealthTile({
  icon,
  label,
  value,
  hint,
  tone
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
  tone?: "good" | "watch";
}) {
  return (
    <div className={tone ? `health-tile ${tone}` : "health-tile"}>
      <div className="health-tile-head">
        {icon}
        <span>{label}</span>
      </div>
      <strong>{value}</strong>
      <em>{hint}</em>
    </div>
  );
}
