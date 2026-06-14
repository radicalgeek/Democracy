import { Newspaper } from "lucide-react";
import type { CoverageTone } from "../lib/api";

const VS: Record<string, { text: string; tone: string }> = {
  above: { text: "above average", tone: "warn" },
  about: { text: "about average", tone: "muted" },
  below: { text: "below average", tone: "good" }
};

/**
 * "How the press covers them" — coverage volume and the share of it that is
 * flagged (sensational / contested / single-source), read against the average
 * for peers. A prompt to scrutinise disproportionate framing — never a claim
 * that the coverage is false, and never an input to any integrity score.
 */
export function CoverageToneBlock({ tone, subject }: { tone: CoverageTone; subject: string }) {
  if (!tone || tone.articles === 0) {
    return (
      <div className="coverage-tone">
        <div className="coverage-tone-head"><Newspaper size={15} /> How the press covers {subject}</div>
        <p className="muted">No recent coverage linked yet.</p>
      </div>
    );
  }
  const vs = tone.vsAverage ? VS[tone.vsAverage] : null;
  return (
    <div className="coverage-tone">
      <div className="coverage-tone-head">
        <Newspaper size={15} /> How the press covers {subject}
      </div>
      <div className="coverage-tone-stats">
        <div className="ct-stat">
          <strong>{tone.articles}</strong>
          <em>stories</em>
        </div>
        <div className="ct-stat">
          <strong className={vs?.tone === "warn" ? "warn" : ""}>{tone.hostileRate}%</strong>
          <em>flagged framing {vs && <span className={`fact-pill ${vs.tone === "warn" ? "watch" : vs.tone}`}>{vs.text}</span>}</em>
        </div>
        <div className="ct-stat">
          <strong>{tone.reliability != null ? Math.round(tone.reliability) : "—"}</strong>
          <em>avg reliability /100</em>
        </div>
        <div className="ct-stat">
          <strong>{tone.sensational != null ? `${Math.round(tone.sensational * 100)}%` : "—"}</strong>
          <em>sensational language</em>
        </div>
      </div>
      <p className="muted coverage-tone-note">
        Flagged framing is coverage that is sensational, contested or single-source. Compared with the
        average for peers ({tone.peerMeanHostile}%). A prompt to read critically — not a verdict on the
        coverage, and never part of {subject}'s accountability score.
      </p>
    </div>
  );
}
