import type { MediaCompassPayload } from "../lib/api";
import { MiniCompass } from "./MiniCompass";

type MediaLandscapeProps = {
  media: MediaCompassPayload;
};

const OUTLET_COLORS = ["#356caa", "#bf8a2e", "#168a5a", "#8a4f9e", "#b3552f", "#147b8e", "#7a7f4b"];

/**
 * Where the outlets we ingest sit on the compass, judged from the framing of
 * their recent politics coverage.
 */
export function MediaLandscape({ media }: MediaLandscapeProps) {
  if (media.outlets.length === 0) {
    return <p className="muted">No compass-scored coverage yet — articles are scored as they are ingested.</p>;
  }

  const scoredOutlets = media.outlets.filter(
    (outlet): outlet is typeof outlet & { x: number; y: number } =>
      outlet.x != null && outlet.y != null
  );
  const unscoredOutlets = media.outlets.filter((outlet) => outlet.x == null || outlet.y == null);
  const ranked = scoredOutlets.sort((a, b) => b.sample - a.sample);
  const rows = [...ranked, ...unscoredOutlets];

  return (
    <div className="outlet-row-list">
      {rows.map((outlet) => {
        const index = media.outlets.indexOf(outlet);
        const color = OUTLET_COLORS[index % OUTLET_COLORS.length];
        const scored = outlet.x != null && outlet.y != null;
        const point = scored ? { x: outlet.x as number, y: outlet.y as number } : null;
        return (
          <article key={outlet.name} className={scored ? "outlet-row" : "outlet-row awaiting"}>
            <MiniCompass
              markers={
                scored
                  ? [
                      { x: point!.x, y: point!.y, label: outlet.name, color, shape: "diamond" as const }
                    ]
                  : []
              }
              label={`${outlet.name} coverage framing on the political compass`}
            />
            <div className="outlet-row-copy">
              <strong>{outlet.name}</strong>
              <span>{point ? "scored coverage framing" : "awaiting scored coverage"}</span>
              <em>
                {outlet.sample > 0
                  ? `${outlet.sample} scored article${outlet.sample === 1 ? "" : "s"}`
                  : "tracked source"}
              </em>
            </div>
          </article>
        );
      })}
      <p className="muted">
        Each row is the mean compass position of that outlet's recent politics coverage as framed in
        headlines and summaries. It is a coverage lens, not a verdict on the outlet.
      </p>
    </div>
  );
}
