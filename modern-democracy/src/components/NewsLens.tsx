import { Newspaper } from "lucide-react";
import type { NewsItem } from "../data/types";
import { Compass } from "./Compass";

type NewsLensProps = {
  items: NewsItem[];
};

export function NewsLens({ items }: NewsLensProps) {
  return (
    <section className="workspace-section">
      <div className="section-heading">
        <Newspaper size={20} />
        <div>
          <h2>Democracy.News lens</h2>
          <p>Related coverage scored by article framing, not just outlet reputation.</p>
        </div>
      </div>
      <div className="news-grid">
        <div className="news-compass">
          {items.map((item) => (
            <div
              key={item.id}
              className="news-dot"
              style={{
                left: `${50 + item.compass.x * 42}%`,
                top: `${50 - item.compass.y * 42}%`
              }}
              title={`${item.source}: ${item.compass.label}`}
            >
              {item.source.slice(0, 2)}
            </div>
          ))}
          <span className="axis top">Authoritarian</span>
          <span className="axis bottom">Libertarian</span>
          <span className="axis left">Left</span>
          <span className="axis right">Right</span>
        </div>
        <div className="news-list">
          {items.map((item) => (
            <article key={item.id} className="news-item">
              <header>
                <strong>{item.source}</strong>
                <span>{item.type}</span>
              </header>
              <h3>
                {item.url ? (
                  <a href={item.url} target="_blank" rel="noreferrer">
                    {item.title}
                  </a>
                ) : (
                  item.title
                )}
              </h3>
              <p>{item.summary}</p>
              <Compass point={item.compass} compact />
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
