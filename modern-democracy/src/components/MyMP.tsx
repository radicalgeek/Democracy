import { useEffect, useMemo, useState } from "react";
import { BarChart3, Compass as CompassIcon, ExternalLink, Landmark, Loader2, ScrollText, UserRound, Vote } from "lucide-react";
import { CompassCompare } from "./CompassCompare";
import { divisionUrl } from "./RepresentativesPanel";
import { storedMyCompass } from "./Onboarding";
import {
  fetchConstituencyProfile,
  storedChoice,
  type AccountUser,
  type CompassComparison,
  type ConstituencyProfile
} from "../lib/api";

type MyMPProps = {
  user: AccountUser | null;
  onRequireAccount: () => void;
};

function percent(value: number, total: number) {
  return total ? Math.round((value / total) * 100) : 0;
}

export function MyMP({ user, onRequireAccount }: MyMPProps) {
  const [profile, setProfile] = useState<
    (ConstituencyProfile & { compass?: CompassComparison }) | null
  >(null);
  const [state, setState] = useState<"idle" | "loading" | "ready" | "error">("idle");

  const constituencyId = user?.constituencyId ?? null;

  useEffect(() => {
    if (!constituencyId) return;
    let mounted = true;
    setState("loading");
    fetchConstituencyProfile(constituencyId)
      .then((payload) => {
        if (!mounted) return;
        setProfile(payload);
        setState("ready");
      })
      .catch(() => mounted && setState("error"));
    return () => {
      mounted = false;
    };
  }, [constituencyId]);

  // "Does my MP vote like me" — compared on this device only, using the vote
  // choices stored locally when ballots were cast. The server never sees it.
  const personal = useMemo(() => {
    if (!profile) return { compared: 0, matched: 0 };
    let compared = 0;
    let matched = 0;
    for (const record of profile.votingRecord) {
      if (!record.billId) continue;
      const mine = storedChoice(record.billId);
      if (!mine || mine === "abstain") continue;
      compared += 1;
      const mpChoice = record.vote === "aye" ? "for" : "against";
      if (mpChoice === mine) matched += 1;
    }
    return { compared, matched };
  }, [profile]);

  if (!user) {
    return (
      <section className="workspace-section">
        <div className="section-heading">
          <Landmark size={20} />
          <div>
            <h2>My MP</h2>
            <p>See who represents you, how they vote, and how closely they match their constituents.</p>
          </div>
        </div>
        <div className="panel mp-cta">
          <p className="muted">
            Sign up with your postcode and we'll show your constituency, your MP, their full voting
            record, and how often they vote the way you and your neighbours do.
          </p>
          <button className="primary" onClick={onRequireAccount}>
            Create account
          </button>
        </div>
      </section>
    );
  }

  if (state === "loading" || state === "idle") {
    return (
      <section className="workspace-section mp-loading">
        <Loader2 size={20} className="spin" /> Loading your constituency…
      </section>
    );
  }

  if (state === "error" || !profile) {
    return (
      <section className="workspace-section">
        <p className="muted">Could not load your constituency profile right now.</p>
      </section>
    );
  }

  const { mp, alignment } = profile;

  return (
    <>
      <section className="workspace-section">
        <div className="section-heading">
          <Landmark size={20} />
          <div>
            <h2>{profile.constituency.name}</h2>
            <p>
              Your constituency · {profile.participation.ballots.toLocaleString()} civic ballots cast
              here so far
            </p>
          </div>
        </div>

        {mp ? (
          <div className="mp-card panel" style={{ borderTopColor: mp.partyColour ? `#${mp.partyColour}` : "var(--line)" }}>
            {mp.thumbnailUrl ? (
              <img src={mp.thumbnailUrl} alt={mp.name} className="mp-photo" />
            ) : (
              <div className="mp-photo placeholder">
                <UserRound size={28} />
              </div>
            )}
            <div className="mp-card-body">
              <h3>{mp.name}</h3>
              <p>
                <span
                  className="party-chip"
                  style={{ background: mp.partyColour ? `#${mp.partyColour}` : "var(--muted)" }}
                >
                  {mp.party ?? "Independent"}
                </span>{" "}
                Member of Parliament for {profile.constituency.name}
              </p>
            </div>
            <div className="mp-scores">
              <div className="mp-score">
                <span>Votes with this constituency</span>
                <strong>{alignment.percent != null ? `${alignment.percent}%` : "—"}</strong>
                <em>
                  {alignment.compared > 0
                    ? `${alignment.matched} of ${alignment.compared} compared divisions`
                    : "not enough overlapping votes yet"}
                </em>
              </div>
              <div className="mp-score">
                <span>Votes with you</span>
                <strong>
                  {personal.compared > 0
                    ? `${percent(personal.matched, personal.compared)}%`
                    : "—"}
                </strong>
                <em>
                  {personal.compared > 0
                    ? `${personal.matched} of ${personal.compared} bills you both voted on`
                    : "cast civic votes on bills your MP has divided on"}
                </em>
              </div>
            </div>
          </div>
        ) : (
          <div className="panel">
            <p className="muted">No sitting MP found for this constituency in the imported data.</p>
          </div>
        )}
      </section>

      {profile.compass && (
        <section className="workspace-section">
          <div className="section-heading">
            <CompassIcon size={20} />
            <div>
              <h2>Political compass: who stands where</h2>
              <p>
                Positions derived from votes on compass-scored bills — the MP's and party's division
                votes, and civic-vote majorities for this constituency and the country. Voting
                against a bill counts as endorsing its opposite.
              </p>
            </div>
          </div>
          <div className="panel">
            <CompassCompare
              compass={profile.compass}
              mpName={mp?.name ?? null}
              constituencyName={profile.constituency.name}
              you={storedMyCompass()}
            />
          </div>
        </section>
      )}

      {alignment.comparisons.length > 0 && (
        <section className="workspace-section">
          <div className="section-heading">
            <BarChart3 size={20} />
            <div>
              <h2>MP vs civic vote</h2>
              <p>
                Divisions on bills where enough civic ballots exist to publish a majority. Scope
                shows whether the comparison uses this constituency's ballots or the national count.
              </p>
            </div>
          </div>
          <div className="comparison-list">
            {alignment.comparisons.map((item) => (
              <article className="comparison-row panel" key={item.divisionId}>
                <div>
                  <strong>{item.billTitle ?? item.divisionTitle}</strong>
                  <span className="muted">{item.divisionTitle}</span>
                </div>
                <div className="comparison-verdict">
                  <span>
                    MP voted <strong className={item.mpVote}>{item.mpVote}</strong>
                  </span>
                  <span className="muted">{item.scope} majority</span>
                  <span className={item.matched ? "match yes" : "match no"}>
                    {item.matched ? "agreed" : "disagreed"}
                  </span>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {profile.civicVotes.length > 0 && (
        <section className="workspace-section">
          <div className="section-heading">
            <Vote size={20} />
            <div>
              <h2>How {profile.constituency.name} votes here</h2>
              <p>
                Civic ballots cast on this platform by people in your constituency (slices below{" "}
                {profile.participation.privacyThreshold} ballots are withheld for privacy).
              </p>
            </div>
          </div>
          <div className="civic-vote-list">
            {profile.civicVotes.map((row) => (
              <article className="civic-vote-row panel" key={row.billId}>
                <strong>{row.billTitle}</strong>
                <div className="civic-bars">
                  <div className="civic-bar">
                    <span>For {percent(row.for, row.total)}%</span>
                    <div className="bar">
                      <div className="fill for" style={{ width: `${percent(row.for, row.total)}%` }} />
                    </div>
                  </div>
                  <div className="civic-bar">
                    <span>Against {percent(row.against, row.total)}%</span>
                    <div className="bar">
                      <div
                        className="fill against"
                        style={{ width: `${percent(row.against, row.total)}%` }}
                      />
                    </div>
                  </div>
                </div>
                <span className="muted">{row.total.toLocaleString()} ballots</span>
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="workspace-section">
        <div className="section-heading">
          <ScrollText size={20} />
          <div>
            <h2>{mp ? `${mp.name}'s recent votes in the Commons` : "Recent Commons divisions"}</h2>
            <p>Live from the official Commons Votes API.</p>
          </div>
        </div>
        <div className="division-list">
          {profile.votingRecord.map((record) => (
            <article className="division-row" key={record.divisionId}>
              <div>
                <strong>{record.title}</strong>
                <span className="muted">
                  {new Date(record.date).toLocaleDateString("en-GB")} · Ayes {record.ayeCount} ·
                  Noes {record.noCount}
                </span>
              </div>
              <span className={`division-vote ${record.vote}`}>
                {record.vote === "aye" ? "Aye" : "No"}
              </span>
              <a
                className="division-link"
                href={divisionUrl(record.divisionId)}
                target="_blank"
                rel="noreferrer"
                aria-label="Open this division on votes.parliament.uk"
                title="Open on votes.parliament.uk"
              >
                <ExternalLink size={14} />
              </a>
            </article>
          ))}
          {profile.votingRecord.length === 0 && (
            <p className="muted">No recorded divisions for this MP in the imported window yet.</p>
          )}
        </div>
      </section>
    </>
  );
}
