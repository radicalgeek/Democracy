import { useEffect, useState } from "react";
import { ExternalLink, Newspaper } from "lucide-react";
import { MediaLandscape } from "./MediaLandscape";
import { MiniCompass } from "./MiniCompass";
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

  const overall = media?.overall ?? null;
  const civicWill = national?.civicWill ?? null;
  const mediaMarker = overall
    ? [{ x: overall.x, y: overall.y, label: "Average media influence", color: "#147b8e", shape: "diamond" as const }]
    : [];
  const willAndMediaMarkers =
    overall && civicWill
      ? [
          { x: civicWill.x, y: civicWill.y, label: "Public will", color: "#bf443e" },
          { x: overall.x, y: overall.y, label: "Average media influence", color: "#147b8e", shape: "diamond" as const }
        ]
      : [];

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
          <div className="media-compass-card">
            <span>Average influence</span>
            {overall ? (
              <MiniCompass markers={mediaMarker} label="Average media influence on the political compass" />
            ) : (
              <strong>—</strong>
            )}
          </div>
          <div>
            <span>Outlets tracked</span>
            <strong>{media?.outlets.length ?? "—"}</strong>
          </div>
          <div>
            <span>Scored articles</span>
            <strong>{overall?.sample ?? "—"}</strong>
          </div>
          <div className="media-compass-card">
            <span>Distance from public will</span>
            {willAndMediaMarkers.length > 0 ? (
              <MiniCompass
                markers={willAndMediaMarkers}
                connect
                label="Distance between public will and average media influence on the political compass"
              />
            ) : (
              <strong>—</strong>
            )}
          </div>
        </div>
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
            <MediaLandscape media={media} />
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
