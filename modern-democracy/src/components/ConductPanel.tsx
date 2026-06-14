import { ShieldCheck } from "lucide-react";
import type { ConductScore } from "../lib/api";

function tone(score: number) {
  if (score >= 70) return "good";
  if (score >= 45) return "watch";
  return "low";
}

/**
 * Accountability/"integrity" panel. The score is built ONLY from verifiable
 * public conduct (voting participation + register transparency) and every
 * component is shown — it never uses news, sentiment or AI judgement of a
 * person, so hostile coverage cannot move it. The methodology is stated plainly.
 */
export function ConductPanel({ conduct, subject }: { conduct: ConductScore; subject: string }) {
  return (
    <div className="conduct-panel">
      <div className="conduct-head">
        <ShieldCheck size={16} />
        <span>Accountability &amp; transparency</span>
      </div>
      <div className="conduct-body">
        <div className={`conduct-score ${tone(conduct.score)}`}>
          <strong>{conduct.score}</strong>
          <em>/ 100</em>
        </div>
        <div className="conduct-components">
          {conduct.components.map((c) => (
            <div className="conduct-component" key={c.label}>
              <span className="conduct-component-label">
                {c.label} <em className="muted">{c.note}</em>
              </span>
              <div className="bar">
                <div className="fill" style={{ width: `${Math.max(0, Math.min(100, c.value))}%` }} />
              </div>
              <strong>{c.value}</strong>
            </div>
          ))}
        </div>
      </div>
      <p className="conduct-method muted">{conduct.method}</p>
    </div>
  );
}
