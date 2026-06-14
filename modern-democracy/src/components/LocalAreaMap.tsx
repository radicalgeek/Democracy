import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import { cleanLegacySvg, seatCoreBBox } from "./ConstituencyMap";
import type { ConstituencyLean, MapBindings, SeatBinding } from "../lib/api";

type LocalMode = "party" | "lean" | "turnout";

type LocalAreaMapProps = {
  bindings: MapBindings | null;
  leans: Record<number, ConstituencyLean> | null;
  homeConstituencyId: number | null;
  homeConstituencyName: string | null;
  onOpenFullMap: () => void;
};

// Same quadrant palette as the national map's compass layer.
function leanColor(lean: { x: number; y: number } | null | undefined) {
  if (!lean) return "#dfe3e9";
  if (lean.x < 0 && lean.y < 0) return "#167c80";
  if (lean.x >= 0 && lean.y < 0) return "#3e7fbc";
  if (lean.x < 0 && lean.y >= 0) return "#b38b2f";
  return "#ad514b";
}

export function leanLabel(lean: { x: number; y: number } | null | undefined) {
  if (!lean) return "no published lean yet";
  const econ = lean.x < 0 ? "left" : "right";
  const social = lean.y < 0 ? "libertarian" : "authoritarian";
  return `${econ}-${social}`;
}

function turnoutColor(ballots: number, maxBallots: number) {
  if (!ballots) return "#eef0f3";
  const intensity = 0.2 + 0.65 * Math.sqrt(ballots / Math.max(1, maxBallots));
  return `rgba(20, 123, 142, ${Math.min(0.9, intensity)})`;
}

function seatFill(
  binding: SeatBinding | undefined,
  mode: LocalMode,
  leans: Record<number, ConstituencyLean> | null,
  maxBallots: number
) {
  if (!binding?.constituency_id) return "#eef0f3";
  if (mode === "party") {
    return binding.party_colour ? `#${binding.party_colour}` : "#c9ced6";
  }
  const lean = leans?.[binding.constituency_id];
  if (mode === "lean") return leanColor(lean?.lean);
  return turnoutColor(lean?.ballots ?? 0, maxBallots);
}

/**
 * A zoomed-in slice of the national constituency SVG centred on the user's
 * own seat, so neighbours are readable: who represents the area around you,
 * how it leans on civic votes, and where participation is concentrated.
 */
export function LocalAreaMap({
  bindings,
  leans,
  homeConstituencyId,
  homeConstituencyName,
  onOpenFullMap
}: LocalAreaMapProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [svgMarkup, setSvgMarkup] = useState("");
  const [mode, setMode] = useState<LocalMode>("lean");
  const [inspected, setInspected] = useState<SeatBinding | null>(null);
  const [homeSeatFound, setHomeSeatFound] = useState(true);

  const homeSvgId = useMemo(() => {
    if (!bindings || !homeConstituencyId) return null;
    for (const binding of Object.values(bindings.bySvgId)) {
      if (binding.constituency_id === homeConstituencyId) return binding.svg_id;
    }
    return null;
  }, [bindings, homeConstituencyId]);

  const maxBallots = useMemo(
    () => Math.max(1, ...Object.values(leans ?? {}).map((entry) => entry.ballots)),
    [leans]
  );

  useEffect(() => {
    let mounted = true;
    fetch("/uk-constituency-map.svg")
      .then((response) => response.text())
      .then((svg) => mounted && setSvgMarkup(cleanLegacySvg(svg)))
      .catch(() => mounted && setSvgMarkup(""));
    return () => {
      mounted = false;
    };
  }, []);

  // The SVG is injected and mutated imperatively in one place: React never
  // manages these children, so a parent re-render can't silently re-inject
  // pristine markup and wipe the zoom and seat styling.
  useEffect(() => {
    const host = hostRef.current;
    if (!host || !svgMarkup || !homeSvgId) return;
    host.innerHTML = svgMarkup;
    const svg = host.querySelector<SVGSVGElement>("svg");
    if (!svg) return;

    const home = svg.querySelector<SVGPathElement>(`path.seat[id="${CSS.escape(homeSvgId)}"]`);
    if (!home) {
      setHomeSeatFound(false);
      return;
    }
    setHomeSeatFound(true);

    // Zoom the original cartography to a window around the home seat. The
    // window is square and several seat-widths across so neighbours show.
    const box = seatCoreBBox(svg, home);
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    const half = Math.min(720, Math.max(150, Math.max(box.width, box.height) * 7));
    svg.setAttribute("viewBox", `${cx - half} ${cy - half} ${half * 2} ${half * 2}`);
    svg.setAttribute("preserveAspectRatio", "xMidYMid slice");

    // Stroke widths are in map units, so scale them with the zoom window or
    // hairline borders render arms-thick when the window is a city block.
    const hairline = Math.max(0.05, half * 0.004);
    const homeStroke = Math.max(0.3, half * 0.014);

    const seats = Array.from(svg.querySelectorAll<SVGPathElement>("path.seat"));
    const cleanup: Array<() => void> = [];
    for (const seat of seats) {
      const id = seat.id || seat.getAttribute("name") || "";
      const binding = bindings?.bySvgId[id];
      seat.style.fill = seatFill(binding, mode, leans, maxBallots);
      const isHome = id === homeSvgId;
      seat.style.stroke = isHome ? "#bf443e" : "#1a1a1a";
      seat.style.strokeWidth = String(isHome ? homeStroke : hairline);
      seat.style.cursor = binding ? "pointer" : "default";
      if (!binding) continue;
      const inspect = () => setInspected(binding);
      seat.addEventListener("click", inspect);
      cleanup.push(() => seat.removeEventListener("click", inspect));
    }
    return () => cleanup.forEach((dispose) => dispose());
  }, [bindings, homeSvgId, leans, maxBallots, mode, svgMarkup]);

  if (!homeConstituencyId) return null;

  if (!homeSvgId || !homeSeatFound) {
    return (
      <p className="muted">
        Your constituency ({homeConstituencyName ?? "unknown"}) is a 2024 boundary the legacy
        cartography can't place yet — use the national map instead.{" "}
        <button className="ghost" onClick={onOpenFullMap}>
          Open national map <ArrowRight size={14} />
        </button>
      </p>
    );
  }

  const inspectedLean =
    inspected?.constituency_id != null ? leans?.[inspected.constituency_id] : null;

  return (
    <div className="local-area-map">
      <div className="local-area-controls">
        <div className="segmented">
          {(["party", "lean", "turnout"] as LocalMode[]).map((option) => (
            <button
              key={option}
              className={mode === option ? "selected" : ""}
              onClick={() => setMode(option)}
            >
              {option === "party" ? "MPs" : option === "lean" ? "Civic lean" : "Turnout"}
            </button>
          ))}
        </div>
        <button className="ghost" onClick={onOpenFullMap}>
          National map <ArrowRight size={14} />
        </button>
      </div>
      <div
        ref={hostRef}
        className="local-area-svg"
        aria-label={`Constituencies around ${homeConstituencyName ?? "your area"}`}
      />
      {!svgMarkup && <p className="muted">Loading cartography…</p>}
      <div className="local-area-footer">
        {inspected ? (
          <p>
            <strong>{inspected.constituency_name ?? inspected.legacy_name}</strong>
            {inspected.mp_name && ` · ${inspected.mp_name} (${inspected.party_name ?? "—"})`}
            {inspectedLean &&
              ` · ${inspectedLean.ballots.toLocaleString()} civic ballots · leans ${leanLabel(inspectedLean.lean)}`}
          </p>
        ) : (
          <p className="muted">
            Your seat is outlined in red. Click any neighbouring constituency to inspect it.
          </p>
        )}
        {mode === "lean" && (
          <p className="muted">
            Civic lean = revealed preference from anonymous ballot majorities on compass-scored
            bills. Grey seats haven't published enough ballots yet.
          </p>
        )}
        {mode === "turnout" && (
          <p className="muted">Darker teal = more anonymous civic ballots cast.</p>
        )}
      </div>
    </div>
  );
}
