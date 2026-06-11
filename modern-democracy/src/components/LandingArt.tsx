import { useEffect, useRef, useState } from "react";
import { cleanLegacySvg } from "./ConstituencyMap";
import { WelshDragon } from "./NationFlags";

/**
 * Decorative artwork for the landing page: a woven ribbon of the four
 * nations' flags, and the real constituency cartography re-tinted as a hero
 * piece. Pure SVG so it stays crisp, themeable, and asset-free.
 */

const RED = "#C8102E";
const SALTIRE_BLUE = "#005EB8";
const WELSH_GREEN = "#00B140";

/**
 * Four angled flag panels flowing into each other like bunting fabric —
 * England, Scotland, Wales, Northern Ireland — with the motifs drawn large
 * and cropped so it reads as artwork rather than four rectangles.
 */
export function FlagRibbon() {
  return (
    <svg
      viewBox="0 0 1200 120"
      className="flag-ribbon"
      role="img"
      aria-label="The flags of England, Scotland, Wales, and Northern Ireland"
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <clipPath id="ribbon-clip">
          <rect x="0" y="0" width="1200" height="120" rx="16" />
        </clipPath>
        <linearGradient id="ribbon-sheen" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.18" />
          <stop offset="0.5" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="1" stopColor="#0c1a20" stopOpacity="0.14" />
        </linearGradient>
      </defs>
      <g clipPath="url(#ribbon-clip)">
        {/* England — St George's cross, off-centre and oversized */}
        <g>
          <rect x="-40" y="0" width="380" height="120" fill="#f6f8f9" />
          <path d="M150,-20 V140 M-40,62 H340" stroke={RED} strokeWidth="34" />
        </g>
        {/* Scotland — saltire running through the panel */}
        <g>
          <polygon points="340,0 660,0 620,120 300,120" fill={SALTIRE_BLUE} />
          <path d="M310,-15 L640,135 M650,-15 L320,135" stroke="#ffffff" strokeWidth="30" />
        </g>
        {/* Wales — green field rising into white, dragon striding */}
        <g>
          <polygon points="660,0 940,0 900,120 620,120" fill="#f6f8f9" />
          <polygon points="640,60 950,60 900,120 620,120" fill={WELSH_GREEN} />
          <WelshDragon transform="translate(708,25) scale(1.45)" />
        </g>
        {/* Northern Ireland — red cross with the six-pointed star */}
        <g>
          <polygon points="940,0 1240,0 1240,120 900,120" fill="#f6f8f9" />
          <path d="M1070,-20 V140 M900,62 H1240" stroke={RED} strokeWidth="30" />
          <path
            d="M1070,28 l9.5,16.5 h19 l-9.5,16.5 l9.5,16.5 h-19 l-9.5,16.5 l-9.5,-16.5 h-19 l9.5,-16.5 l-9.5,-16.5 h19 z"
            fill="#ffffff"
            stroke={RED}
            strokeWidth="3"
          />
          <path d="M1064,50.5 h12 v14 q0,6.5 -6,6.5 q-6,0 -6,-6.5 z" fill={RED} />
        </g>
        {/* gold seams between the panels, like stitching */}
        <path d="M340,0 L300,120 M660,0 L620,120 M940,0 L900,120" stroke="#c9922c" strokeWidth="5" />
        <rect x="0" y="0" width="1200" height="120" fill="url(#ribbon-sheen)" />
      </g>
    </svg>
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
