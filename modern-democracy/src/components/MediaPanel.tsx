import { useEffect, useState } from "react";
import { ExternalLink, Newspaper } from "lucide-react";
import { MediaInfluence } from "./MediaInfluence";
import { MiniCompass } from "./MiniCompass";
import { fetchMediaArticles, type MediaArticle } from "../lib/api";

/**
 * The Media page: the full media-influence view (per-outlet cards with their own
 * compass, ownership and reliability; flagged coverage; narratives) plus the
 * latest individually-scored articles.
 */
export function MediaPanel() {
  const [articles, setArticles] = useState<MediaArticle[] | null>(null);

  useEffect(() => {
    let mounted = true;
    fetchMediaArticles(48)
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
          <MediaInfluence detailed />
        </div>
      </section>

      <section className="workspace-section">
        <div className="section-heading">
          <Newspaper size={20} />
          <div>
            <h2>Latest scored coverage</h2>
            <p>Each article with the position its framing expresses.</p>
          </div>
        </div>
        <div className="media-article-list">
          {(articles ?? []).map((article) => (
            <a
              key={article.id}
              className="media-article-row"
              href={article.url}
              target="_blank"
              rel="noreferrer"
            >
              <div>
                <strong>{article.title}</strong>
                <span>
                  {article.source}
                  {article.publishedAt &&
                    ` · ${new Date(article.publishedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`}
                </span>
              </div>
              <div className="article-compass">
                <MiniCompass
                  markers={[{ x: article.compass.x, y: article.compass.y, label: article.title, color: "#8a4f9e", shape: "diamond" }]}
                  label={`Compass position for ${article.title}`}
                />
              </div>
              <ExternalLink size={14} />
            </a>
          ))}
          {articles != null && articles.length === 0 && (
            <p className="muted">No scored articles yet — coverage is scored as it is ingested.</p>
          )}
          {articles == null && <p className="muted">Loading scored coverage…</p>}
        </div>
      </section>
    </>
  );
}
