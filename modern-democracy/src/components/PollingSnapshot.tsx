import { useEffect, useState } from "react";
import { BarChart3, TrendingUp, Users } from "lucide-react";
import { PollingTrend } from "./PollingTrend";
import { HelpTrigger } from "./HelpTrigger";
import { HelpCircle } from "lucide-react";
import {
  fetchLeaderApproval,
  fetchPollingSnapshot,
  fetchPollingTrend,
  type LeaderApproval,
  type PollingSnapshot as PollingSnapshotData,
  type PollingTrend as PollingTrendData
} from "../lib/api";

/**
 * National polling snapshot — poll-of-polls average, trend, per-party spread
 * and leader net approval, all from free openly-licensed sources. A separate
 * comparison layer to the platform's own anonymous-ballot civic will. CC BY 4.0
 * requires the visible BritPolls attribution shown at the foot of the card.
 */
export function PollingSnapshot({ compact = false }: { compact?: boolean }) {
  const [snapshot, setSnapshot] = useState<PollingSnapshotData | null>(null);
  const [trend, setTrend] = useState<PollingTrendData | null>(null);
  const [leaders, setLeaders] = useState<LeaderApproval | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let mounted = true;
    fetchPollingSnapshot()
      .then((data) => mounted && setSnapshot(data))
      .catch(() => mounted && setFailed(true));
    fetchPollingTrend(26)
      .then((data) => mounted && setTrend(data))
      .catch(() => {});
    fetchLeaderApproval()
      .then((data) => mounted && setLeaders(data))
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  if (failed) {
    return <p className="muted">Polling needs the updated backend — start the new API to see it.</p>;
  }
  if (!snapshot) {
    return <p className="muted">Loading the latest polling…</p>;
  }

  const pop = snapshot.pollOfPolls;
  const maxShare = pop ? Math.max(...pop.parties.map((party) => party.percent), 1) : 1;

  return (
    <div className="polling-snapshot">
      <div className="polling-head">
        <div className="panel-title">
          <BarChart3 size={18} />
          <div>
            <h3>National voting intention</h3>
            <HelpTrigger topicId="polling" inline>
              <HelpCircle size={16} />
            </HelpTrigger>
          </div>
        </div>
        {pop && <span className="muted polling-asof">Poll of polls · to {pop.date}</span>}
      </div>

      {pop ? (
        <div className="polling-bars">
          {pop.parties
            .filter((party) => party.code !== "oth")
            .map((party) => (
              <div className="polling-bar" key={party.code}>
                <span className="polling-bar-label">{party.label}</span>
                <div className="bar">
                  <div
                    className="fill"
                    style={{
                      width: `${(party.percent / maxShare) * 100}%`,
                      background: party.colour ? `#${party.colour}` : "var(--muted)"
                    }}
                  />
                </div>
                <strong>{party.percent.toFixed(1)}%</strong>
              </div>
            ))}
        </div>
      ) : (
        <p className="muted">No poll-of-polls average ingested yet.</p>
      )}

      {!compact && trend && (
        <div className="polling-section">
          <h4>
            <TrendingUp size={15} /> Trend (last 6 months)
          </h4>
          <PollingTrend data={trend} />
        </div>
      )}

      {!compact && snapshot.spread.length > 0 && (
        <div className="polling-section">
          <h4>Spread across pollsters</h4>
          <p className="muted polling-spread-note">
            Range between the most and least favourable recent poll for each party — the gap is the
            house effect plus sampling noise, why no single poll is "the answer".
          </p>
          <div className="polling-spread">
            {snapshot.spread.map((party) => (
              <span key={party.code} className="polling-spread-row">
                <i style={{ background: `#${party.colour}` }} />
                {party.label}: {party.min.toFixed(0)}–{party.max.toFixed(0)}%
              </span>
            ))}
          </div>
        </div>
      )}

      {!compact && leaders && leaders.leaders.length > 0 && (
        <div className="polling-section">
          <h4>
            <Users size={15} /> Leader net approval
          </h4>
          <div className="leader-approval">
            {leaders.leaders.map((leader) => (
              <div className="leader-row" key={leader.leader}>
                <span className="leader-name">
                  <i style={{ background: leader.colour ? `#${leader.colour}` : "var(--muted)" }} />
                  {leader.leader}
                </span>
                {leader.net != null && (
                  <strong className={leader.net >= 0 ? "net positive" : "net negative"}>
                    {leader.net > 0 ? "+" : ""}
                    {Math.round(leader.net)}
                  </strong>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="polling-attribution">
        {snapshot.attribution}. A poll is a sample, not a vote — it carries a margin of error.
      </p>
    </div>
  );
}
