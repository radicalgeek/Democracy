import { useEffect, useState } from "react";
import { ExternalLink, Newspaper } from "lucide-react";
import { MediaInfluence } from "./MediaInfluence";
import { MediaMetrics } from "./MediaMetrics";
import { MiniCompass } from "./MiniCompass";
import { compassQuadrant } from "../lib/compassLabel";
import { fetchMediaArticles, type MediaArticle } from "../lib/api";

const PAGE = 12;

const decode = (t: string) =>
  t
    .replace(/&#(\d+);/g, (_, c) => String.fromCharCode(Number(c)))
    .replace(/&#x([0-9a-f]+);/gi, (_, c) => String.fromCharCode(parseInt(c, 16)))
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'");

const LABEL: Record<string, { text: string; tone: string }> = {
  "well-corroborated": { text: "well corroborated", tone: "good" },
  contested: { text: "contested", tone: "watch" },
  "single-source": { text: "single source", tone: "watch" },
  opinion: { text: "opinion", tone: "muted" }
};

/**
 * The Media page: the full media-influence view (metrics + per-outlet cards +
 * flagged coverage + narratives) plus a paginated feed of individually-scored
 * articles, each row showing its compass position and reliability signals.
 */
export function MediaPanel() {
  const [articles, setArticles] = useState<MediaArticle[] | null>(null);
  const [visible, setVisible] = useState(PAGE);

  useEffect(() => {
    let mounted = true;
    fetchMediaArticles(120)
      .then((payload) => mounted && setArticles(payload.articles))
      .catch(() => mounted && setArticles([]));
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <>
      <section className="workspace-section">
        <div className="section-heading">
          <Newspaper size={20} />
          <div>
            <h2>Media influence on our democracy</h2>
            <p>
              Each outlet on its own compass with its ownership and factual track record, the
              stories worth scrutiny, and the narratives shaping the conversation — corroboration-led.
            </p>
          </div>
        </div>
        <div className="panel">
          <MediaMetrics />
        </div>
        <div className="panel">
          <MediaInfluence detailed />
        </div>
      </section>

      <section className="workspace-section">
        <div className="section-heading">
          <Newspaper size={20} />
          <div>
            <h2>Latest scored coverage</h2>
            <p>Every article placed on the compass by its framing, with its factual-reliability signals.</p>
          </div>
        </div>
        <div className="scored-feed">
          {(articles ?? []).slice(0, visible).map((article) => {
            const label = article.factualLabel ? LABEL[article.factualLabel] : null;
            return (
              <a
                key={article.id}
                className="scored-row"
                href={article.url}
                target="_blank"
                rel="noreferrer"
              >
                <div className="scored-compass">
                  <MiniCompass
                    markers={[{ x: article.compass.x, y: article.compass.y, label: article.title, color: "#8a4f9e", shape: "diamond" }]}
                    label={`Compass position for ${article.title}`}
                  />
                </div>
                <div className="scored-copy">
                  <strong>{decode(article.title)}</strong>
                  <span className="muted scored-meta">
                    {article.source}
                    {article.publishedAt &&
                      ` · ${new Date(article.publishedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`}
                    {" · "}
                    {compassQuadrant(article.compass.x, article.compass.y)}
                  </span>
                  <div className="scored-pills">
                    {label && <span className={`fact-pill ${label.tone}`}>{label.text}</span>}
                    {article.corroboratingOutlets > 0 && (
                      <span className="scored-tag">{article.corroboratingOutlets} outlet{article.corroboratingOutlets === 1 ? "" : "s"} corroborating</span>
                    )}
                    {article.framing === "allegation" && <span className="scored-tag warn">allegation framing</span>}
                    {article.sensational != null && article.sensational >= 0.4 && (
                      <span className="scored-tag warn">sensational</span>
                    )}
                    {article.factualScore != null && (
                      <span className="scored-tag">{Math.round(article.factualScore)}/100 reliability</span>
                    )}
                  </div>
                </div>
                <ExternalLink size={14} className="scored-ext" />
              </a>
            );
          })}
          {articles != null && articles.length === 0 && (
            <p className="muted">No scored articles yet — coverage is scored as it is ingested.</p>
          )}
          {articles == null && <p className="muted">Loading scored coverage…</p>}
        </div>
        {articles && visible < articles.length && (
          <button className="ghost load-more" onClick={() => setVisible((v) => v + PAGE)}>
            Show more ({visible} of {articles.length})
          </button>
        )}
      </section>
    </>
  );
}
