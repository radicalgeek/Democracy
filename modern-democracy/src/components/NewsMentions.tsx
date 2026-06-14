import { ExternalLink } from "lucide-react";
import type { NewsMention } from "../lib/api";

const LABEL: Record<string, { text: string; tone: string }> = {
  "well-corroborated": { text: "corroborated", tone: "good" },
  contested: { text: "contested", tone: "watch" },
  "single-source": { text: "single source", tone: "watch" },
  opinion: { text: "opinion", tone: "muted" }
};

/**
 * Recent coverage mentioning an MP or party, each tagged with how factually
 * reliable it is (corroboration-led). Reliability flags help readers weigh
 * hostile or single-source stories — this list never feeds an integrity score.
 */
export function NewsMentions({ items, emptyText }: { items: NewsMention[]; emptyText?: string }) {
  if (!items.length) {
    return <p className="muted">{emptyText ?? "No recent coverage linked yet."}</p>;
  }
  return (
    <div className="news-mentions">
      {items.map((n) => {
        const label = n.factualLabel ? LABEL[n.factualLabel] : null;
        return (
          <a className="news-mention" href={n.url} target="_blank" rel="noreferrer" key={n.id}>
            <div className="news-mention-copy">
              <strong>{n.title}</strong>
              <span className="muted">
                {n.source}
                {n.publishedAt && ` · ${new Date(n.publishedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`}
                {n.corroboratingOutlets > 0 && ` · ${n.corroboratingOutlets} outlet${n.corroboratingOutlets === 1 ? "" : "s"} corroborating`}
              </span>
            </div>
            {label && <span className={`fact-pill ${label.tone}`}>{label.text}</span>}
            <ExternalLink size={13} className="news-mention-ext" />
          </a>
        );
      })}
    </div>
  );
}
