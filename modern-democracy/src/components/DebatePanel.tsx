import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, BadgeCheck, Ban, HelpCircle, MessageSquare, Send } from "lucide-react";
import {
  fetchDebate,
  submitDebatePost,
  type BackendDebatePost
} from "../lib/api";
import { HelpTrigger } from "./HelpTrigger";
import { formatCompassPoint } from "../lib/compassLabel";
import type { DebatePost, VoteChoice } from "../data/types";

type DebatePanelProps = {
  posts: DebatePost[];
  liveBillId?: number | null;
  constituencyId?: number | null;
  signedIn?: boolean;
  onRequireAccount?: () => void;
};

type ModerationKey = DebatePost["moderation"] | BackendDebatePost["moderation_state"];

function moderationLabel(moderation: ModerationKey) {
  if (moderation === "clean") return ["Clean", <BadgeCheck size={15} key="icon" />] as const;
  if (moderation === "heated-legitimate")
    return ["Heated but legitimate", <AlertTriangle size={15} key="icon" />] as const;
  if (moderation === "needs-review")
    return ["Review queued", <AlertTriangle size={15} key="icon" />] as const;
  return ["Restricted", <Ban size={15} key="icon" />] as const;
}

export function DebatePanel({
  posts,
  liveBillId,
  constituencyId,
  signedIn = true,
  onRequireAccount
}: DebatePanelProps) {
  const [livePosts, setLivePosts] = useState<BackendDebatePost[] | null>(null);
  const [draft, setDraft] = useState("");
  const [stance, setStance] = useState<VoteChoice | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const loadPosts = useCallback(async () => {
    if (!liveBillId) return;
    try {
      const payload = await fetchDebate(liveBillId);
      setLivePosts(payload.posts);
    } catch {
      setLivePosts(null);
    }
  }, [liveBillId]);

  useEffect(() => {
    setLivePosts(null);
    loadPosts();
  }, [loadPosts]);

  async function handleSubmit() {
    if (!liveBillId || draft.trim().length === 0) return;
    setSubmitting(true);
    setFeedback(null);
    try {
      const result = await submitDebatePost(liveBillId, draft.trim(), stance);
      if (result.status === "banned") {
        setFeedback(
          `You are temporarily banned (ban #${result.banNumber}) until ${new Date(result.endsAt).toLocaleString()}. Bans escalate exponentially.`
        );
      } else {
        const stateNote =
          result.moderationState === "clean" || result.moderationState === "heated-legitimate"
            ? "published"
            : result.moderationState === "needs-review"
              ? "published, queued for review"
              : "restricted";
        setFeedback(`Post ${stateNote} — ${result.reason}.${result.ban ? ` Temporary ban #${result.ban.banNumber} issued.` : ""}`);
        setDraft("");
        await loadPosts();
      }
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "post failed");
    }
    setSubmitting(false);
  }

  const showLive = liveBillId != null && livePosts != null;

  return (
    <section className="workspace-section">
      <div className="section-heading">
        <MessageSquare size={20} />
        <div>
          <h2>
            AI moderated debate
            <HelpTrigger topicId="moderation" inline>
              <HelpCircle size={16} />
            </HelpTrigger>
          </h2>
          <p>Legitimate political concerns are protected. Personal attacks escalate temporary bans.</p>
        </div>
      </div>

      {liveBillId != null && !signedIn && (
        <div className="debate-composer panel">
          <p className="muted">Join the debate — create an account to post your argument.</p>
          <button className="composer-submit" onClick={() => onRequireAccount?.()}>
            Create account
          </button>
        </div>
      )}

      {liveBillId != null && signedIn && (
        <div className="debate-composer panel">
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Make your argument. Blunt political criticism is allowed; attacks on people are not."
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
              onClick={handleSubmit}
            >
              <Send size={15} /> {submitting ? "Moderating..." : "Post"}
            </button>
          </div>
          {feedback && <p className="composer-feedback">{feedback}</p>}
        </div>
      )}

      <div className="debate-list">
        {showLive
          ? livePosts.map((post) => {
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
                    {post.compass_x != null && post.compass_y != null && (
                      <span className="post-compass">
                        {formatCompassPoint(post.compass_x, post.compass_y)}
                      </span>
                    )}
                    <span>{new Date(post.created_at).toLocaleString()}</span>
                  </footer>
                </article>
              );
            })
          : posts.map((post) => {
              const [label, icon] = moderationLabel(post.moderation);
              return (
                <article className="debate-post" key={post.id}>
                  <header>
                    <div>
                      <strong>{post.author}</strong>
                      <span>
                        {post.reputation.replace("-", " ")} · {post.publicBanCount} public temporary bans
                      </span>
                    </div>
                    <div className={`moderation ${post.moderation}`}>
                      {icon}
                      {label}
                    </div>
                  </header>
                  <p>{post.body}</p>
                  <footer>
                    <span>{post.stance}</span>
                    <span>{post.compass.label}</span>
                    <span>{post.postedAt}</span>
                  </footer>
                </article>
              );
            })}
        {showLive && livePosts.length === 0 && (
          <p className="muted">No debate posts yet — make the first argument.</p>
        )}
      </div>
    </section>
  );
}
