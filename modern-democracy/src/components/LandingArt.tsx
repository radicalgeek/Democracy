import { useEffect, useRef, useState } from "react";
import { cleanLegacySvg } from "./ConstituencyMap";
import { nationFlagAssets } from "./NationFlags";

/**
 * Decorative artwork for the landing page: real flag assets woven into a
 * background field, plus the constituency cartography re-tinted as a hero
 * piece.
 */

export function FlagBackdrop() {
  const flags = [
    nationFlagAssets[0],
    ...nationFlagAssets.slice(1)
  ];

  return (
    <div className="flag-backdrop" aria-hidden="true">
      {flags.map((flag, index) => (
        <div key={flag.id} className={`flag-backdrop-card panel-${index + 1}`}>
          <span className="flag-backdrop-pole" />
          <span className="flag-backdrop-cloth">
            <img
              src={flag.src}
              alt=""
              loading="eager"
            />
          </span>
          <span className="flag-backdrop-label">{flag.name}</span>
        </div>
      ))}
      <div className="flag-backdrop-small">
        {flags.slice(1).map((flag, index) => (
          <span
            key={flag.id}
            className={`flag-backdrop-token token-${index + 1}`}
          >
            <img src={flag.src} alt="" loading="eager" />
          </span>
        ))}
      </div>
    </div>
  );
}

/** Union palette the map seats are tinted with, weighted toward calm blues. */
function seatTint(id: string) {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) {
    hash = (hash << 5) - hash + id.charCodeAt(index);
    hash |= 0;
  }
  const bucket = Math.abs(hash) % 100;
  const soften = 0.55 + (Math.abs(hash >> 7) % 40) / 100;
  if (bucket < 38) return `rgba(20, 123, 142, ${soften})`; // teal
  if (bucket < 64) return `rgba(53, 108, 170, ${soften})`; // slate blue
  if (bucket < 78) return `rgba(200, 16, 46, ${soften * 0.8})`; // flag red
  if (bucket < 89) return `rgba(201, 146, 44, ${soften * 0.85})`; // gold
  return `rgba(0, 177, 64, ${soften * 0.75})`; // dragon green
}

/**
 * The real 650-seat cartography as hero art: seats tinted with the union
 * palette, technical furniture (inset boxes, labels, the seats inside the
 * inset frames) stripped, viewBox cropped to the remaining landmass.
 */
export function MapArt() {
  const hostRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    fetch("/uk-constituency-map.svg")
      .then((response) => response.text())
      .then((markup) => {
        const host = hostRef.current;
        if (!mounted || !host) return;
        // Imperative injection — React 19 re-sets dangerouslySetInnerHTML on
        // any prop update, which would wipe the mutations below.
        host.innerHTML = cleanLegacySvg(markup);
        const svg = host.querySelector<SVGSVGElement>("svg");
        if (!svg) return;

        // Strip the cartographic furniture: labels, marker dots, inset frames,
        // county boundaries. The duplicated city blow-ups (framed insets plus
        // the free-floating West Midlands / Greater London clusters) are
        // subpaths of the seat paths themselves, so they can't be hidden per
        // element — instead crop the viewBox to the real geography, which all
        // sits left of x≈670 in this 1020×996 artwork.
        svg.querySelectorAll<SVGGraphicsElement>("text, circle, rect, .countyboundary").forEach(
          (node) => {
            node.style.display = "none";
          }
        );
        svg.querySelectorAll<SVGPathElement>("path.seat").forEach((seat) => {
          seat.style.fill = seatTint(seat.id || "seat");
          seat.style.stroke = "rgba(244, 248, 250, 0.85)";
          seat.style.strokeWidth = "0.6";
        });

        // The duplicated city blow-ups interleave with the mainland in x
        // (East Anglia and Kent reach x≈660 while the floating slabs start at
        // x≈575, but only above y≈440), so clip to an L-shaped region: full
        // height to x=570, and only the lower band from there to x=670.
        const NS = "http://www.w3.org/2000/svg";
        const clip = document.createElementNS(NS, "clipPath");
        clip.setAttribute("id", "map-art-clip");
        const clipShape = document.createElementNS(NS, "polygon");
        clipShape.setAttribute(
          "points",
          "10,10 530,10 530,520 670,520 670,990 10,990"
        );
        clip.appendChild(clipShape);
        const defs = document.createElementNS(NS, "defs");
        defs.appendChild(clip);
        const group = document.createElementNS(NS, "g");
        group.setAttribute("clip-path", "url(#map-art-clip)");
        for (const child of Array.from(svg.childNodes)) group.appendChild(child);
        svg.appendChild(defs);
        svg.appendChild(group);

        svg.setAttribute("viewBox", "10 10 660 980");
        svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
        setReady(true);
      })
      .catch(() => {
        if (mounted) setReady(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className={ready ? "map-art ready" : "map-art"} aria-hidden="true">
      <div ref={hostRef} className="map-art-svg" />
      <span className="map-art-caption">650 constituencies · four nations · one count</span>
    </div>
  );
}
