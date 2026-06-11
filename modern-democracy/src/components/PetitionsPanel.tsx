import { useState } from "react";
import { ExternalLink, ScrollText, Users } from "lucide-react";
import type { Petition, PetitionLive, VoteChoice } from "../data/types";
import { Compass } from "./Compass";
import { DebatePanel } from "./DebatePanel";
import { VotePanel } from "./VotePanel";

type PetitionsPanelProps = {
  petitions: Petition[];
  livePetitions: PetitionLive[];
};

function percent(value: number, total: number) {
  return total ? Math.round((value / total) * 100) : 0;
}

function stateLabel(state: string) {
  return state.replace(/-/g, " ");
}

export function PetitionsPanel({ petitions, livePetitions }: PetitionsPanelProps) {
  const [selectedId, setSelectedId] = useState(petitions[0]?.id);
  const [votes, setVotes] = useState<Record<string, VoteChoice>>({});

  const petition = petitions.find((item) => item.id === selectedId) ?? petitions[0];
  if (!petition) return null;

  const signatureProgress = Math.min(
    100,
    Math.round((petition.signatures / petition.debateThreshold) * 100)
  );
  const responseMarker = Math.round(
    (petition.responseThreshold / petition.debateThreshold) * 100
  );

  return (
    <>
      <section className="workspace-section">
        <div className="section-heading">
          <ScrollText size={20} />
          <div>
            <h2>Petitions</h2>
            <p>
              Debate and vote on the demands behind official UK petitions, with AI compass scoring
              of each petition and argument.
            </p>
          </div>
        </div>
        <div className="bills-grid">
          {petitions.map((item) => (
            <article
              className={item.id === petition.id ? "bill-row selected" : "bill-row"}
              key={item.id}
            >
              <div>
                <strong>{item.title}</strong>
                <span>
                  {stateLabel(item.state)} · {item.signatures.toLocaleString()} signatures ·{" "}
                  {item.publicVote.turnout.toLocaleString()} civic votes
                </span>
              </div>
              <button onClick={() => setSelectedId(item.id)}>
                {item.id === petition.id ? "Open" : "Select"}
              </button>
            </article>
          ))}
        </div>
      </section>

      <section className="hero-workspace">
        <div className="bill-copy">
          <div className="status-row">
            <span>Petition</span>
            <span>{stateLabel(petition.state)}</span>
            <span>Opened {petition.openedAt}</span>
          </div>
          <h1>{petition.title}</h1>
          <p>{petition.background}</p>
          {petition.governmentResponse && (
            <p className="muted">{petition.governmentResponse}</p>
          )}
          <div className="citation-row">
            <a href={petition.sourceUrl} target="_blank" rel="noreferrer">
              petition.parliament.uk
            </a>
          </div>
        </div>
        <VotePanel
          integrity={petition.integrity}
          selectedVote={votes[petition.id] ?? null}
          onVote={(vote) => setVotes((current) => ({ ...current, [petition.id]: vote }))}
        />
      </section>

      <div className="petition-grid">
        <section className="panel">
          <div className="panel-title">
            <Users size={18} />
            <div>
              <h3>Signature thresholds</h3>
              <p>
                {petition.signatures.toLocaleString()} signatures ·{" "}
                {petition.responseThreshold.toLocaleString()} for a government response ·{" "}
                {petition.debateThreshold.toLocaleString()} for a parliamentary debate.
              </p>
            </div>
          </div>
          <div className="petition-progress">
            <div className="petition-progress-track">
              <div className="petition-progress-fill" style={{ width: `${signatureProgress}%` }} />
              <span className="threshold-marker" style={{ left: `${responseMarker}%` }} />
            </div>
            <div className="petition-progress-labels">
              <span>Response: {petition.signatures >= petition.responseThreshold ? "reached" : "pending"}</span>
              <span>Debate: {petition.signatures >= petition.debateThreshold ? "reached" : "pending"}</span>
            </div>
          </div>
          <div className="metric-stack">
            <div>
              <span>For</span>
              <strong>{percent(petition.publicVote.for, petition.publicVote.turnout)}%</strong>
            </div>
            <div>
              <span>Against</span>
              <strong>{percent(petition.publicVote.against, petition.publicVote.turnout)}%</strong>
            </div>
            <div>
              <span>Abstain</span>
              <strong>{percent(petition.publicVote.abstain, petition.publicVote.turnout)}%</strong>
            </div>
          </div>
          <p className="muted">
            Signatures show support only; the civic vote lets opponents register too, so the two
            can disagree.
          </p>
        </section>

        <section className="panel">
          <h3>Political direction</h3>
          <Compass point={petition.compass} />
          <p className="muted">{petition.compass.rationale}</p>
        </section>
      </div>

      <DebatePanel posts={petition.debate} />

      <section className="workspace-section">
        <div className="section-heading">
          <ExternalLink size={20} />
          <div>
            <h2>Trending open petitions</h2>
            <p>Live from the official Petitions API, ready to adopt for civic voting.</p>
          </div>
        </div>
        <div className="bills-grid">
          {livePetitions.map((item) => (
            <article className="bill-row" key={item.id}>
              <div>
                <strong>{item.title}</strong>
                <span>
                  {stateLabel(item.state)} · {item.signatures.toLocaleString()} signatures
                </span>
              </div>
              <a href={item.sourceUrl} target="_blank" rel="noreferrer">
                Source
              </a>
            </article>
          ))}
          {livePetitions.length === 0 && (
            <p className="muted">
              Live petitions unavailable; showing sample petitions above. Integration status is on
              the Transparency tab.
            </p>
          )}
        </div>
      </section>
    </>
  );
}
