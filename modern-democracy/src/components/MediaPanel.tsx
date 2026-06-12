import { useEffect, useState } from "react";
import { ExternalLink, Newspaper } from "lucide-react";
import { MediaLandscape } from "./MediaLandscape";
import { storedMyCompass } from "./Onboarding";
import { formatCompassPoint } from "../lib/compassLabel";
import {
  fetchMediaArticles,
  fetchMediaCompass,
  fetchNationalCompass,
  type MediaArticle,
  type MediaCompassPayload,
  type NationalCompassPayload
} from "../lib/api";

/**
 * Media influence: where every tracked outlet's coverage sits on the compass,
 * how far the average pull of the media is from the public will, and the
 * latest scored articles with their individual positions.
 */
export function MediaPanel() {
  const [media, setMedia] = useState<MediaCompassPayload | null>(null);
  const [articles, setArticles] = useState<MediaArticle[] | null>(null);
  const [national, setNational] = useState<NationalCompassPayload | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let mounted = true;
    fetchMediaCompass()
      .then((payload) => mounted && setMedia(payload))
      .catch(() => mounted && setFailed(true));
    fetchMediaArticles(40)
      .then((payload) => mounted && setArticles(payload.articles))
      .catch(() => mounted && setArticles([]));
    fetchNationalCompass()
      .then((payload) => mounted && setNational(payload))
      .catch(() => mounted && setNational(null));
    return () => {
      mounted = false;
    };
  }, []);

  const myCompass = storedMyCompass();
  const you = myCompass ? { x: myCompass.x, y: myCompass.y } : null;

  const overall = media?.overall ?? null;
  const civicWill = national?.civicWill ?? null;
  const mediaVsWill =
    overall && civicWill
      ? Math.round(Math.hypot(overall.x - civicWill.x, overall.y - civicWill.y) * 10) / 10
      : null;

  if (failed) {
    return (
      <section className="workspace-section">
        <p className="muted">Media insights need the backend — start the API to see this page.</p>
      </section>
    );
  }

  return (
    <>
      <section className="workspace-section local-hero">
        <div className="section-heading">
          <Newspaper size={20} />
          <div>
            <h2>Media influence</h2>
            <p>
              Every ingested article is compass-scored on its framing. This is the pull the media
              exerts on the national conversation — and how far it sits from the public will.
            </p>
          </div>
        </div>
        <div className="local-score-strip">
          <div>
            <span>Average influence</span>
            <strong>{overall ? formatCompassPoint(overall.x, overall.y) : "—"}</strong>
          </div>
          <div>
            <span>Outlets tracked</span>
            <strong>{media?.outlets.length ?? "—"}</strong>
          </div>
          <div>
            <span>Scored articles</span>
            <strong>{overall?.sample ?? "—"}</strong>
          </div>
          <div>
            <span>Distance from public will</span>
            <strong>{mediaVsWill != null ? `${mediaVsWill} compass units` : "—"}</strong>
          </div>
        </div>
        {overall && civicWill && (
          <p className="muted media-vs-will">
            The public will sits at {formatCompassPoint(civicWill.x, civicWill.y)}; average media
            coverage sits at {formatCompassPoint(overall.x, overall.y)}. The gap is the influence
            story.
          </p>
        )}
      </section>

      <section className="workspace-section">
        <div className="section-heading">
          <Newspaper size={20} />
          <div>
            <h2>The outlet landscape</h2>
            <p>Coverage lean per outlet — framing of recent politics coverage, not a verdict on the outlet.</p>
          </div>
        </div>
        <div className="panel">
          {media ? (
            <MediaLandscape media={media} you={you} />
          ) : (
            <p className="muted">Loading the outlet landscape…</p>
          )}
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
              <em className="post-compass">{formatCompassPoint(article.compass.x, article.compass.y)}</em>
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
