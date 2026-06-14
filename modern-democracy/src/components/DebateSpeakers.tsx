import { useState } from "react";
import { ExternalLink, Scale } from "lucide-react";
import type { DebateSpeaker } from "../lib/api";
import { MiniCompass } from "./MiniCompass";

function partyColour(colour: string | null | undefined) {
  return colour ? `#${colour.replace(/^#/, "")}` : "var(--muted)";
}

const TOP_N = 8;

/**
 * Who actually spoke in a debate and how much of the floor they took. Word share
 * stands in for time (Hansard publishes no timecodes) and exposes the
 * talk-out-the-clock tactic. Each speaker carries the compass and registered
 * interests we already compute elsewhere, so you can see who was steering it.
 */
export function DebateSpeakers({ speakers }: { speakers: DebateSpeaker[] }) {
  const [showAll, setShowAll] = useState(false);
  if (!speakers || speakers.length === 0) return null;

  const ranked = [...speakers].sort((a, b) => b.words - a.words);
  const totalWords = ranked.reduce((sum, s) => sum + s.words, 0) || 1;
  const top3Share = Math.round(
    (ranked.slice(0, 3).reduce((sum, s) => sum + s.words, 0) / totalWords) * 100
  );
  const visible = showAll ? ranked : ranked.slice(0, TOP_N);

  return (
    <div className="debate-speakers">
      <div className="debate-speakers-head">
        <h4>Who spoke</h4>
        <p>
          {ranked.length} {ranked.length === 1 ? "member" : "members"} contributed.{" "}
          {ranked.length >= 3 && (
            <>
              The top three took <strong>{top3Share}%</strong> of the floor, by words spoken.
            </>
          )}
        </p>
      </div>

      <div className="speaker-grid">
        {visible.map((speaker, index) => {
          const share = Math.round((speaker.words / totalWords) * 100);
          const place = ranked.indexOf(speaker) + 1;
          return (
            <article className="speaker-card" key={speaker.memberId} data-rank={index === 0 ? "top" : undefined}>
              <div className="speaker-card-head">
                <span className="speaker-rank">{place}</span>
                <div className="speaker-id">
                  <strong>{speaker.name || `Member ${speaker.memberId}`}</strong>
                  <span className="speaker-meta">
                    {speaker.party && (
                      <span
                        className="party-chip"
                        style={{ background: partyColour(speaker.partyColour) }}
                      >
                        {speaker.partyAbbreviation ?? speaker.party}
                      </span>
                    )}
                    <span className="speaker-seat">
                      {speaker.constituency ?? speaker.house ?? ""}
                    </span>
                  </span>
                </div>
              </div>

              <div className="speaker-share">
                <div className="speaker-share-bar">
                  <span style={{ width: `${Math.max(share, 2)}%` }} />
                </div>
                <span className="speaker-share-label">
                  <strong>{share}%</strong> of debate · {speaker.contributions} turn
                  {speaker.contributions === 1 ? "" : "s"} · {speaker.words.toLocaleString()} words
                </span>
              </div>

              <div className="speaker-extra">
                {speaker.compass ? (
                  <div className="speaker-compass">
                    <MiniCompass
                      label={`${speaker.name} political compass`}
                      markers={[
                        {
                          x: speaker.compass.x,
                          y: speaker.compass.y,
                          label: speaker.name,
                          color: speaker.compassFromParty ? "#8a4f9e" : "#147b8e",
                          shape: speaker.compassFromParty ? "circle" : "diamond"
                        }
                      ]}
                    />
                    {speaker.compassFromParty && (
                      <span className="speaker-compass-note">Party position</span>
                    )}
                  </div>
                ) : (
                  <span className="speaker-nocompass">
                    No compass — needs division-vote history
                  </span>
                )}
                <a
                  className={
                    speaker.interestsTotal && speaker.interestsTotal > 0
                      ? "speaker-interests has-interests"
                      : "speaker-interests"
                  }
                  href={speaker.registerUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Scale size={13} />
                  {speaker.interestsTotal == null
                    ? "Registered interests"
                    : speaker.interestsTotal === 0
                      ? "No registered interests"
                      : `${speaker.interestsTotal} registered interest${speaker.interestsTotal === 1 ? "" : "s"}`}
                  <ExternalLink size={11} />
                </a>
              </div>
            </article>
          );
        })}
      </div>

      {ranked.length > TOP_N && (
        <button className="ghost speaker-toggle" onClick={() => setShowAll((value) => !value)}>
          {showAll ? "Show fewer" : `Show all ${ranked.length} speakers`}
        </button>
      )}
    </div>
  );
}
