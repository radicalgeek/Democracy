import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  Ban,
  Check,
  ExternalLink,
  Loader2,
  MessageSquare,
  PenLine,
  ScrollText,
  Send,
  Users
} from "lucide-react";
import type { Petition, PetitionLive, VoteChoice } from "../data/types";
import { Compass } from "./Compass";
import {
  fetchPetitionDetail,
  fetchPetitions,
  submitPetitionDebatePost,
  votePetition,
  type BackendDebatePost,
  type BackendPetition,
  type PetitionDetailPayload
} from "../lib/api";

const RESPONSE_THRESHOLD = 10_000;
const DEBATE_THRESHOLD = 100_000;

type PetitionsPanelProps = {
  petitions: Petition[];
  livePetitions: PetitionLive[];
  signedIn?: boolean;
  onRequireAccount?: () => void;
};

function percent(value: number, total: number) {
  return total ? Math.round((value / total) * 100) : 0;
}

function stateLabel(state: string) {
  return state.replace(/[_-]/g, " ");
}

function moderationLabel(state: BackendDebatePost["moderation_state"]) {
  if (state === "clean") return ["Clean", <BadgeCheck size={15} key="i" />] as const;
  if (state === "heated-legitimate")
    return ["Heated but legitimate", <AlertTriangle size={15} key="i" />] as const;
  if (state === "needs-review") return ["Review queued", <AlertTriangle size={15} key="i" />] as const;
  return ["Restricted", <Ban size={15} key="i" />] as const;
}

export function PetitionsPanel({
  petitions: samplePetitions,
  livePetitions,
  signedIn = false,
  onRequireAccount
}: PetitionsPanelProps) {
  const [backendPetitions, setBackendPetitions] = useState<BackendPetition[] | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<PetitionDetailPayload | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    let mounted = true;
    fetchPetitions()
      .then((payload) => {
        if (!mounted) return;
        setBackendPetitions(payload.petitions);
        if (payload.petitions.length > 0) setSelectedId(payload.petitions[0].id);
      })
      .catch(() => mounted && setBackendPetitions(null));
    return () => {
      mounted = false;
    };
  }, []);

  const loadDetail = useCallback(async (petitionId: number) => {
    setLoadingDetail(true);
    try {
      setDetail(await fetchPetitionDetail(petitionId));
    } catch {
      setDetail(null);
    }
    setLoadingDetail(false);
  }, []);

  useEffect(() => {
    if (selectedId != null) loadDetail(selectedId);
  }, [selectedId, loadDetail]);

  // Backend unavailable: keep the page alive with the bundled sample petition
  // list (read-only) and the client-side live feed.
  if (backendPetitions == null || backendPetitions.length === 0) {
    return (
      <section className="workspace-section">
        <div className="section-heading">
          <ScrollText size={20} />
          <div>
            <h2>Petitions</h2>
            <p>Live petition data is unavailable right now — showing the bundled samples.</p>
          </div>
        </div>
        <div className="bills-grid">
          {[...samplePetitions.map((p) => ({ key: p.id, title: p.title, meta: `${p.signatures.toLocaleString()} signatures` })),
            ...livePetitions.map((p) => ({ key: p.id, title: p.title, meta: `${p.signatures.toLocaleString()} signatures` }))].map((row) => (
            <article className="bill-row" key={row.key}>
              <div>
                <strong>{row.title}</strong>
                <span>{row.meta}</span>
              </div>
            </article>
          ))}
        </div>
      </section>
    );
  }

  return (
    <>
      <section className="workspace-section">
        <div className="section-heading">
          <ScrollText size={20} />
          <div>
            <h2>Petitions</h2>
            <p>
              Every open petition from petition.parliament.uk — debate it, cast a civic vote (for or
              against, not just support), and sign the official petition.
            </p>
          </div>
        </div>
        <div className="bills-grid petition-list-scroll">
          {backendPetitions.map((petition) => (
            <article
              className={petition.id === selectedId ? "bill-row selected" : "bill-row"}
              key={petition.id}
            >
              <div>
                <strong>{petition.action}</strong>
                <span>
                  {petition.signature_count.toLocaleString()} signatures ·{" "}
                  {petition.for_count + petition.against_count + petition.abstain_count} civic votes ·{" "}
                  {petition.debate_count} debate posts
                </span>
              </div>
              <button onClick={() => setSelectedId(petition.id)}>
                {petition.id === selectedId ? "Open" : "Select"}
              </button>
            </article>
          ))}
        </div>
      </section>

      {loadingDetail && (
        <section className="workspace-section mp-loading">
          <Loader2 size={18} className="spin" /> Loading petition…
        </section>
      )}

      {detail && !loadingDetail && (
        <PetitionDetail
          detail={detail}
          signedIn={signedIn}
          onRequireAccount={onRequireAccount}
          onChanged={() => loadDetail(detail.petition.id)}
        />
      )}
    </>
  );
}

function PetitionDetail({
  detail,
  signedIn,
  onRequireAccount,
  onChanged
}: {
  detail: PetitionDetailPayload;
  signedIn: boolean;
  onRequireAccount?: () => void;
  onChanged: () => void;
}) {
  const { petition, analyses, votes, myVote, posts } = detail;
  const [voting, setVoting] = useState(false);
  const [draft, setDraft] = useState("");
  const [stance, setStance] = useState<VoteChoice | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const signatureProgress = Math.min(100, Math.round((petition.signatureCount / DEBATE_THRESHOLD) * 100));
  const responseMarker = Math.round((RESPONSE_THRESHOLD / DEBATE_THRESHOLD) * 100);
  const compassPoint = analyses.compass?.x != null
    ? {
        x: (analyses.compass.x ?? 0) / 10,
        y: (analyses.compass.y ?? 0) / 10,
        label: analyses.compass.label ?? "unclassified",
        confidence: analyses.compass.confidence ?? 0,
        rationale: analyses.compass.rationale ?? ""
      }
    : null;

  async function handleVote(choice: VoteChoice) {
    if (!signedIn) {
      onRequireAccount?.();
      return;
    }
    setVoting(true);
    try {
      await votePetition(petition.id, choice);
      onChanged();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "vote failed");
    }
    setVoting(false);
  }

  async function handlePost() {
    if (draft.trim().length === 0) return;
    setSubmitting(true);
    setFeedback(null);
    try {
      const result = await submitPetitionDebatePost(petition.id, draft.trim(), stance);
      if (result.status === "banned") {
        setFeedback(
          `You are temporarily banned (ban #${result.banNumber}) until ${new Date(result.endsAt).toLocaleString()}.`
        );
      } else {
        setDraft("");
        onChanged();
      }
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "post failed");
    }
    setSubmitting(false);
  }

  return (
    <>
      <section className="hero-workspace">
        <div className="bill-copy">
          <div className="status-row">
            <span>Petition</span>
            <span>{stateLabel(petition.state)}</span>
            {petition.openedAt && <span>Opened {new Date(petition.openedAt).toLocaleDateString()}</span>}
          </div>
          <h1>{petition.action}</h1>
          {analyses.summary?.summary ? (
            <p>{analyses.summary.summary}</p>
          ) : (
            petition.background && <p>{petition.background}</p>
          )}
          {petition.additionalDetails && <p className="muted">{petition.additionalDetails}</p>}
          <div className="citation-row">
            <a href={petition.officialUrl} target="_blank" rel="noreferrer">
              Official petition page
            </a>
          </div>
        </div>

        <section className="panel vote-panel">
          <div className="panel-title">
            <PenLine size={18} />
            <div>
              <h3>Your position</h3>
              <p>
                {signedIn
                  ? "One vote per account — unlike signatures, opposition counts too."
                  : "Create an account to vote on this petition."}
              </p>
            </div>
          </div>
          <div className="vote-actions">
            {(["for", "against", "abstain"] as VoteChoice[]).map((choice) => (
              <button
                key={choice}
                disabled={voting}
                className={myVote === choice ? `vote-button ${choice} active` : `vote-button ${choice}`}
                onClick={() => handleVote(choice)}
              >
                {myVote === choice && <Check size={16} />}
                {choice}
              </button>
            ))}
          </div>
          <div className="metric-stack">
            <div>
              <span>For</span>
              <strong>{percent(votes.for, votes.total)}%</strong>
            </div>
            <div>
              <span>Against</span>
              <strong>{percent(votes.against, votes.total)}%</strong>
            </div>
            <div>
              <span>Votes</span>
              <strong>{votes.total.toLocaleString()}</strong>
            </div>
          </div>
          <a className="sign-button" href={petition.officialUrl} target="_blank" rel="noreferrer">
            <ExternalLink size={15} /> Sign the official petition
          </a>
          {feedback && <p className="form-error">{feedback}</p>}
        </section>
      </section>

      <div className="petition-grid">
        <section className="panel">
          <div className="panel-title">
            <Users size={18} />
            <div>
              <h3>Signature thresholds</h3>
              <p>
                {petition.signatureCount.toLocaleString()} official signatures · 10,000 for a
                government response · 100,000 for a parliamentary debate.
              </p>
            </div>
          </div>
          <div className="petition-progress">
            <div className="petition-progress-track">
              <div className="petition-progress-fill" style={{ width: `${signatureProgress}%` }} />
              <span className="threshold-marker" style={{ left: `${responseMarker}%` }} />
            </div>
            <div className="petition-progress-labels">
              <span>Response: {petition.signatureCount >= RESPONSE_THRESHOLD ? "reached" : "pending"}</span>
              <span>Debate: {petition.signatureCount >= DEBATE_THRESHOLD ? "reached" : "pending"}</span>
            </div>
          </div>
        </section>

        {compassPoint && (
          <section className="panel">
            <h3>Political direction</h3>
            <Compass point={compassPoint} />
            <p className="muted">
              {compassPoint.rationale}
              {analyses.compass?.model ? ` (model: ${analyses.compass.model})` : ""}
            </p>
          </section>
        )}
      </div>

      <section className="workspace-section">
        <div className="section-heading">
          <MessageSquare size={20} />
          <div>
            <h2>Debate this petition</h2>
            <p>Legitimate political concerns are protected. Personal attacks escalate temporary bans.</p>
          </div>
        </div>

        {signedIn ? (
          <div className="debate-composer panel">
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Make your argument for or against this petition."
              rows={3}
              maxLength={4000}
            />
            <div className="composer-row">
              <div className="segmented">
                {(["for", "against", "abstain"] as VoteChoice[]).map((choice) => (
                  <button
                    key={choice}
                    className={stance === choice ? "selected" : ""}
                    onClick={() => setStance(stance === choice ? null : choice)}
                  >
                    {choice}
                  </button>
                ))}
              </div>
              <button
                className="composer-submit"
                disabled={submitting || draft.trim().length === 0}
                onClick={handlePost}
              >
                <Send size={15} /> {submitting ? "Moderating..." : "Post"}
              </button>
            </div>
          </div>
        ) : (
          <div className="debate-composer panel">
            <p className="muted">Join the debate — create an account to post your argument.</p>
            <button className="composer-submit" onClick={() => onRequireAccount?.()}>
              Create account
            </button>
          </div>
        )}

        <div className="debate-list">
          {posts.map((post) => {
            const [label, icon] = moderationLabel(post.moderation_state);
            return (
              <article className="debate-post" key={post.id}>
                <header>
                  <div>
                    <strong>{post.author}</strong>
                    <span>{post.public_ban_count} public temporary bans</span>
                  </div>
                  <div className={`moderation ${post.moderation_state}`}>
                    {icon}
                    {label}
                  </div>
                </header>
                <p>{post.body ?? "Content withheld by moderation."}</p>
                <footer>
                  <span>{post.stance ?? "no stance"}</span>
                  <span>{new Date(post.created_at).toLocaleString()}</span>
                </footer>
              </article>
            );
          })}
          {posts.length === 0 && <p className="muted">No arguments yet — make the first one.</p>}
        </div>
      </section>
    </>
  );
}
