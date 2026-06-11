import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Crosshair, Minus, Plus, RotateCcw } from "lucide-react";
import type { MapBindings, SeatBinding } from "../lib/api";
import type { ConstituencyMetric } from "../data/types";

type MapMode = "vote" | "alignment" | "compass" | "debate";

type SeatAggregate = { for: number; against: number; abstain: number; total: number };

type ConstituencyMapProps = {
  constituencies: ConstituencyMetric[];
  mode: MapMode;
  selectedId: string;
  onSelect: (id: string) => void;
  bindings?: MapBindings | null;
  aggregates?: Record<number, SeatAggregate> | null;
  /** Zoom to the selected seat once cartography + bindings are ready (map page). */
  autoFocus?: boolean;
};

/** Display labels and plain-English explanations for each map layer. */
export const MAP_MODE_META: Record<MapMode, { label: string; description: string }> = {
  vote: {
    label: "Civic vote",
    description:
      "How people on this platform are voting, seat by seat: green seats lean for the bill, red lean against, grey are too close to call or have no published ballots yet."
  },
  alignment: {
    label: "MP party",
    description:
      "The party that holds each seat, shown in its official colour from live Parliament data."
  },
  compass: {
    label: "Compass",
    description:
      "The political-compass quadrant each area leans towards (demo shading until real aggregates exist)."
  },
  debate: {
    label: "Debate",
    description: "How active discussion is in each area — darker teal means a busier debate (demo shading)."
  }
};

function voteMarginColor(metric: ConstituencyMetric) {
  const total = metric.publicVote.for + metric.publicVote.against + metric.publicVote.abstain;
  const margin = total ? (metric.publicVote.for - metric.publicVote.against) / total : 0;
  if (Math.abs(margin) < 0.04) return "#c9ced6";
  return margin > 0 ? `rgba(22, 138, 90, ${0.42 + Math.abs(margin)})` : `rgba(191, 68, 62, ${0.42 + Math.abs(margin)})`;
}

function colorFor(metric: ConstituencyMetric, mode: MapMode) {
  if (mode === "vote") return voteMarginColor(metric);
  if (mode === "debate") return `rgba(20, 123, 142, ${0.25 + metric.debateIntensity / 130})`;
  if (mode === "alignment") {
    const localFor = metric.publicVote.for >= metric.publicVote.against;
    const aligned =
      (localFor && metric.mpVote === "for") || (!localFor && metric.mpVote === "against");
    return aligned ? "#247b63" : "#d29d31";
  }

  if (metric.compass.x < 0 && metric.compass.y < 0) return "#167c80";
  if (metric.compass.x >= 0 && metric.compass.y < 0) return "#3e7fbc";
  if (metric.compass.x < 0 && metric.compass.y >= 0) return "#b38b2f";
  return "#ad514b";
}

function hashString(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

function colorForLegacySeat(id: string, mode: MapMode) {
  const hash = hashString(id);
  const bucket = hash % 100;

  if (mode === "vote") {
    if (bucket > 54) return `rgba(22, 138, 90, ${0.44 + (bucket - 54) / 110})`;
    if (bucket < 46) return `rgba(191, 68, 62, ${0.44 + (46 - bucket) / 110})`;
    return "#c9ced6";
  }

  if (mode === "alignment") return bucket % 4 === 0 ? "#d29d31" : "#247b63";
  if (mode === "debate") return `rgba(20, 123, 142, ${0.28 + bucket / 140})`;

  const compassBucket = hash % 4;
  if (compassBucket === 0) return "#167c80";
  if (compassBucket === 1) return "#3e7fbc";
  if (compassBucket === 2) return "#b38b2f";
  return "#ad514b";
}

function realVoteColor(aggregate: SeatAggregate) {
  const margin = aggregate.total ? (aggregate.for - aggregate.against) / aggregate.total : 0;
  if (Math.abs(margin) < 0.04) return "#c9ced6";
  return margin > 0
    ? `rgba(22, 138, 90, ${0.45 + Math.min(0.5, Math.abs(margin))})`
    : `rgba(191, 68, 62, ${0.45 + Math.min(0.5, Math.abs(margin))})`;
}

function partyColor(binding: SeatBinding) {
  return binding.party_colour ? `#${binding.party_colour}` : "#c9ced6";
}

const NO_DATA_MATCHED = "#dfe3e9";
const NO_DATA_UNMATCHED = "#eef0f3";

function seatColor(
  id: string,
  mode: MapMode,
  binding: SeatBinding | undefined,
  aggregates: Record<number, SeatAggregate> | null | undefined
) {
  if (!binding) return colorForLegacySeat(id, mode);

  if (mode === "vote") {
    const aggregate = binding.constituency_id ? aggregates?.[binding.constituency_id] : undefined;
    if (aggregate) return realVoteColor(aggregate);
    return binding.match_status === "unmatched" ? NO_DATA_UNMATCHED : NO_DATA_MATCHED;
  }

  if (mode === "alignment") {
    // Real MP party colour for bound seats — divergence shading comes once
    // representative division votes are imported.
    return binding.constituency_id ? partyColor(binding) : NO_DATA_UNMATCHED;
  }

  // compass/debate layers stay demo-shaded until their real aggregates exist
  return colorForLegacySeat(id, mode);
}

// Styles the legacy app applied from its Razor page CSS (_map.cshtml /
// Statistics.cshtml). Without them, unfilled shapes — the inset frames and
// dashed source boxes — render with SVG's default black fill. Values are the
// original 2015 ones; the legacy in-SVG tooltip is hidden because its inline
// scripts are stripped.
const LEGACY_PAGE_STYLES = `
  .seat { stroke: black; stroke-width: 0.5; }
  .labour, .tory, .libdem, .snp, .pc, .sf, .sdlp, .uup, .dup,
  .alliance, .respect, .green, .ind, .undeclared { fill: #c0c0c0; }
  .countyboundary { stroke: black; stroke-width: 1; fill: none; }
  .insetbox { fill: none; stroke: black; stroke-width: 3; }
  .dashedbox { fill: none; stroke: black; stroke-width: 1.5; stroke-dasharray: 3,7; }
  .tooltip, .tooltip_bg { display: none; }
  text { font-size: 18px; fill: black; stroke: none; }
  tspan { font-size: 14px; }
`;

export function cleanLegacySvg(svg: string) {
  return svg
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/\son[a-z]+="[^"]*"/gi, "")
    .replace(/style="position:absolute; width: 100%;  height: 1px; overflow:visible"/i, "")
    // "slice" crops the artwork to fill the container — the source of the
    // hyper-zoomed flash on load. "meet" letterboxes instead.
    .replace(/preserveAspectRatio="[^"]*"/i, 'preserveAspectRatio="xMidYMid meet"')
    .replace(/<\/style>/i, `${LEGACY_PAGE_STYLES}</style>`);
}

/**
 * Bounding box of a seat's actual shape. Legacy seat paths can carry extra
 * subpaths (label leaders far from the seat), so a raw getBBox can span half
 * the map. The seat outline is always the densest subpath.
 */
export function seatCoreBBox(svg: SVGSVGElement, seat: SVGPathElement) {
  const d = seat.getAttribute("d") ?? "";
  const subpaths = d.split(/(?=[Mm])/).filter((part) => part.trim());
  if (subpaths.length <= 1) return seat.getBBox();
  const densest = subpaths.reduce((best, part) =>
    (part.match(/[-\d.]+/g) ?? []).length > (best.match(/[-\d.]+/g) ?? []).length ? part : best
  );
  const probe = document.createElementNS("http://www.w3.org/2000/svg", "path");
  probe.setAttribute("d", densest);
  probe.setAttribute("fill", "none");
  svg.appendChild(probe);
  const box = probe.getBBox();
  svg.removeChild(probe);
  return box;
}

function formatSeatName(id: string) {
  return id.replace(/_/g, " ");
}

/** How the 2010-era cartography seat relates to today's constituency. */
function matchStatusCopy(status: SeatBinding["match_status"]) {
  if (status === "exact") return "same constituency exists today";
  if (status === "normalized") return "matched to today's constituency by name";
  return "2010 boundary — no current equivalent";
}

function modeCaption(
  mode: MapMode,
  bindings: MapBindings | null | undefined,
  hasAggregates: boolean
) {
  const base = MAP_MODE_META[mode].description;
  if (!bindings) return `${base} Backend offline — colours are illustrative only.`;
  if (mode === "vote") {
    return hasAggregates
      ? `${base} Aggregates are privacy-thresholded; ${bindings.summary.exact + bindings.summary.normalized} of 650 legacy seats are bound to current constituencies.`
      : `${base} No published vote aggregates for this bill yet — matched seats shown pale.`;
  }
  if (mode === "alignment") {
    return `${base} MP-vs-constituency divergence shading arrives with division-vote import.`;
  }
  return base;
}

type ViewBox = { x: number; y: number; w: number; h: number };

const MIN_VIEW_WIDTH = 36;

/** Top parties by bound seats, for the MP-party legend keys. */
function topParties(bindings: MapBindings | null | undefined, limit = 6) {
  if (!bindings) return [];
  const byParty = new Map<string, { name: string; colour: string; seats: number }>();
  for (const binding of Object.values(bindings.bySvgId)) {
    if (!binding.constituency_id || !binding.party_name) continue;
    const key = binding.party_name;
    const entry = byParty.get(key) ?? {
      name: binding.party_name,
      colour: partyColor(binding),
      seats: 0
    };
    entry.seats += 1;
    byParty.set(key, entry);
  }
  return [...byParty.values()].sort((a, b) => b.seats - a.seats).slice(0, limit);
}

function MapLegend({
  mode,
  bindings
}: {
  mode: MapMode;
  bindings: MapBindings | null | undefined;
}) {
  if (mode === "vote") {
    return (
      <div className="legend-row">
        <span>
          <i className="swatch" style={{ background: "rgba(22, 138, 90, 0.75)" }} /> Leaning for
        </span>
        <span>
          <i className="swatch" style={{ background: "rgba(191, 68, 62, 0.75)" }} /> Leaning against
        </span>
        <span>
          <i className="swatch" style={{ background: "#c9ced6" }} /> Too close to call
        </span>
        <span>
          <i className="swatch" style={{ background: NO_DATA_MATCHED }} /> No published ballots
        </span>
      </div>
    );
  }

  if (mode === "alignment") {
    const parties = topParties(bindings);
    if (parties.length === 0) {
      return (
        <div className="legend-row">
          <span>
            <i className="swatch" style={{ background: "#247b63" }} /> MP aligned with local vote
          </span>
          <span>
            <i className="swatch" style={{ background: "#d29d31" }} /> MP diverges from local vote
          </span>
        </div>
      );
    }
    return (
      <div className="legend-row">
        {parties.map((party) => (
          <span key={party.name}>
            <i className="swatch" style={{ background: party.colour }} /> {party.name}
          </span>
        ))}
        <span>
          <i className="swatch" style={{ background: NO_DATA_UNMATCHED }} /> Unbound seat
        </span>
      </div>
    );
  }

  if (mode === "compass") {
    return (
      <div className="legend-row">
        <span>
          <i className="swatch" style={{ background: "#167c80" }} /> Left-libertarian
        </span>
        <span>
          <i className="swatch" style={{ background: "#3e7fbc" }} /> Right-libertarian
        </span>
        <span>
          <i className="swatch" style={{ background: "#b38b2f" }} /> Left-authoritarian
        </span>
        <span>
          <i className="swatch" style={{ background: "#ad514b" }} /> Right-authoritarian
        </span>
      </div>
    );
  }

  return (
    <div className="legend-row">
      <span>
        <i className="swatch" style={{ background: "rgba(20, 123, 142, 0.3)" }} /> Quiet debate
      </span>
      <span>
        <i className="swatch" style={{ background: "rgba(20, 123, 142, 0.95)" }} /> Heated debate
      </span>
    </div>
  );
}

export function ConstituencyMap({
  constituencies,
  mode,
  selectedId,
  onSelect,
  bindings,
  aggregates,
  autoFocus = false
}: ConstituencyMapProps) {
  const selected = constituencies.find((item) => item.id === selectedId) ?? constituencies[0];
  const mapRef = useRef<HTMLDivElement>(null);
  const [svgMarkup, setSvgMarkup] = useState("");
  const [legacySeat, setLegacySeat] = useState("South_East_Cornwall");
  const fullView = useRef<ViewBox>({ x: 0, y: 0, w: 1020, h: 996 });
  const [view, setView] = useState<ViewBox | null>(null);
  const autoFocused = useRef(false);
  const dragging = useRef<{ pointerId: number; startX: number; startY: number; view: ViewBox; moved: boolean } | null>(null);
  const suppressClick = useRef(false);

  const selectedBinding = bindings?.bySvgId[legacySeat] ?? null;
  const selectedAggregate =
    selectedBinding?.constituency_id != null
      ? aggregates?.[selectedBinding.constituency_id] ?? null
      : null;

  const selectedName = useMemo(() => {
    if (selectedBinding?.constituency_name) return selectedBinding.constituency_name;
    if (constituencies.some((item) => item.id === selectedId)) return selected.name;
    return formatSeatName(legacySeat);
  }, [constituencies, legacySeat, selected.name, selectedBinding, selectedId]);

  useEffect(() => {
    let mounted = true;
    fetch("/uk-constituency-map.svg")
      .then((response) => response.text())
      .then((svg) => {
        if (mounted) setSvgMarkup(cleanLegacySvg(svg));
      })
      .catch(() => {
        if (mounted) setSvgMarkup("");
      });

    return () => {
      mounted = false;
    };
  }, []);

  // Sync the legacy-SVG selection when the app sets a seat id from outside
  // (e.g. defaulting the map to the signed-in user's own constituency).
  useEffect(() => {
    if (bindings?.bySvgId[selectedId]) setLegacySeat(selectedId);
  }, [bindings, selectedId]);

  const getSvg = useCallback(
    () => mapRef.current?.querySelector<SVGSVGElement>("svg") ?? null,
    []
  );

  // Inject the SVG imperatively, like LocalAreaMap: if React managed these
  // children, any prop update on the host div would re-set innerHTML and wipe
  // the zoom viewBox and seat styling. Also reads the artwork's real viewBox.
  useEffect(() => {
    const host = mapRef.current;
    if (!host || !svgMarkup) return;
    host.innerHTML = svgMarkup;
    const svg = getSvg();
    if (!svg) return;
    const box = svg.viewBox.baseVal;
    if (box && box.width > 0) {
      fullView.current = { x: box.x, y: box.y, w: box.width, h: box.height };
    }
  }, [getSvg, svgMarkup]);

  const applyView = useCallback(
    (next: ViewBox | null) => {
      setView(next);
      const svg = getSvg();
      if (!svg) return;
      const target = next ?? fullView.current;
      svg.setAttribute("viewBox", `${target.x} ${target.y} ${target.w} ${target.h}`);
    },
    [getSvg]
  );

  const clampView = useCallback((next: ViewBox): ViewBox => {
    const full = fullView.current;
    const w = Math.min(full.w, Math.max(MIN_VIEW_WIDTH, next.w));
    const h = w * (full.h / full.w);
    const x = Math.min(full.x + full.w - w, Math.max(full.x, next.x));
    const y = Math.min(full.y + full.h - h, Math.max(full.y, next.y));
    return { x, y, w, h };
  }, []);

  const zoomBy = useCallback(
    (factor: number, center?: { x: number; y: number }) => {
      const current = view ?? fullView.current;
      const w = current.w * factor;
      const cx = center?.x ?? current.x + current.w / 2;
      const cy = center?.y ?? current.y + current.h / 2;
      const next = clampView({
        x: cx - (cx - current.x) * factor,
        y: cy - (cy - current.y) * factor,
        w,
        h: current.h * factor
      });
      applyView(next.w >= fullView.current.w ? null : next);
    },
    [applyView, clampView, view]
  );

  const focusSeat = useCallback(
    (seatId: string) => {
      const svg = getSvg();
      if (!svg) return false;
      const seat = svg.querySelector<SVGPathElement>(`path.seat[id="${CSS.escape(seatId)}"]`);
      if (!seat) return false;
      const box = seatCoreBBox(svg, seat);
      const half = Math.min(300, Math.max(30, Math.max(box.width, box.height) * 3));
      applyView(
        clampView({
          x: box.x + box.width / 2 - half,
          y: box.y + box.height / 2 - half,
          w: half * 2,
          h: half * 2
        })
      );
      return true;
    },
    [applyView, clampView, getSvg]
  );

  // Map page: zoom in on the user's own constituency once everything is
  // ready. Gated on the app-selected seat id (not the local default) so it
  // never fires before the user's home seat has been applied from outside.
  useEffect(() => {
    if (!autoFocus || autoFocused.current || !svgMarkup) return;
    if (!bindings?.bySvgId[selectedId]) return;
    if (focusSeat(selectedId)) autoFocused.current = true;
  }, [autoFocus, bindings, focusSeat, selectedId, svgMarkup]);

  // Wheel zoom and drag-to-pan, attached natively so wheel can preventDefault.
  useEffect(() => {
    const root = mapRef.current;
    const svg = getSvg();
    if (!root || !svg || !svgMarkup) return;

    const toMapPoint = (event: { clientX: number; clientY: number }) => {
      const rect = svg.getBoundingClientRect();
      const current = svg.viewBox.baseVal;
      return {
        x: current.x + ((event.clientX - rect.left) / rect.width) * current.width,
        y: current.y + ((event.clientY - rect.top) / rect.height) * current.height
      };
    };

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      zoomBy(event.deltaY > 0 ? 1.2 : 1 / 1.2, toMapPoint(event));
    };

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      const current = svg.viewBox.baseVal;
      dragging.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        view: { x: current.x, y: current.y, w: current.width, h: current.height },
        moved: false
      };
    };

    const onPointerMove = (event: PointerEvent) => {
      const drag = dragging.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      const dx = event.clientX - drag.startX;
      const dy = event.clientY - drag.startY;
      if (!drag.moved && Math.hypot(dx, dy) < 4) return;
      drag.moved = true;
      const rect = svg.getBoundingClientRect();
      applyView(
        clampView({
          x: drag.view.x - dx * (drag.view.w / rect.width),
          y: drag.view.y - dy * (drag.view.h / rect.height),
          w: drag.view.w,
          h: drag.view.h
        })
      );
    };

    const onPointerUp = (event: PointerEvent) => {
      const drag = dragging.current;
      if (drag && drag.pointerId === event.pointerId) {
        // A real drag should not also select the seat under the pointer.
        if (drag.moved) suppressClick.current = true;
        dragging.current = null;
      }
    };

    root.addEventListener("wheel", onWheel, { passive: false });
    root.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      root.removeEventListener("wheel", onWheel);
      root.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [applyView, clampView, getSvg, svgMarkup, zoomBy]);

  useEffect(() => {
    const root = mapRef.current;
    if (!root || !svgMarkup) return;

    // Keep hairlines hairline when zoomed in: stroke widths are in map units.
    const zoomScale = (view?.w ?? fullView.current.w) / fullView.current.w;

    const seats = Array.from(root.querySelectorAll<SVGPathElement>("path.seat"));
    const cleanup: Array<() => void> = [];

    seats.forEach((seat) => {
      const id = seat.id || seat.getAttribute("name") || "Unknown";
      const binding = bindings?.bySvgId[id];
      seat.style.fill = seatColor(id, mode, binding, aggregates);
      // original 2015 cartography: black hairline seat borders; the selected
      // seat gets a heavier teal outline so the selection is visible.
      const isSelected = id === legacySeat;
      seat.style.stroke = isSelected ? "#147b8e" : "#1a1a1a";
      seat.style.strokeWidth = String((isSelected ? 2 : 0.5) * zoomScale);
      seat.style.cursor = "pointer";
      seat.setAttribute("tabindex", "0");
      seat.setAttribute("role", "button");
      seat.setAttribute(
        "aria-label",
        binding?.constituency_name ?? formatSeatName(id)
      );

      const selectSeat = () => {
        if (suppressClick.current) {
          suppressClick.current = false;
          return;
        }
        setLegacySeat(id);
        onSelect(id);
      };
      const keySelect = (event: KeyboardEvent) => {
        if (event.key === "Enter" || event.key === " ") selectSeat();
      };

      seat.addEventListener("click", selectSeat);
      seat.addEventListener("keydown", keySelect);
      cleanup.push(() => {
        seat.removeEventListener("click", selectSeat);
        seat.removeEventListener("keydown", keySelect);
      });
    });

    return () => cleanup.forEach((dispose) => dispose());
  }, [aggregates, bindings, legacySeat, mode, onSelect, svgMarkup, view]);

  return (
    <div className="map-frame">
      <div className="map-header">
        <div>
          <span className="eyeless-label">Accurate legacy UK constituency SVG</span>
          <h2>{selectedName}</h2>
          {selectedBinding && (
            <p className="map-seat-meta">
              {selectedBinding.mp_name
                ? `MP: ${selectedBinding.mp_name} (${selectedBinding.party_name ?? "—"})`
                : "No current same-name constituency — 2010 boundary"}
              {" · "}
              {matchStatusCopy(selectedBinding.match_status)}
            </p>
          )}
        </div>
        <div className="map-stat">
          {selectedAggregate ? (
            <>
              <strong>
                {selectedAggregate.for}–{selectedAggregate.against}
              </strong>
              <span>for–against · {selectedAggregate.total} ballots</span>
            </>
          ) : (
            <>
              <strong>—</strong>
              <span>no published ballots</span>
            </>
          )}
        </div>
      </div>
      {svgMarkup ? (
        <div className="legacy-map-stage">
          <div className="map-zoom-controls" role="group" aria-label="Map zoom controls">
            <button type="button" onClick={() => zoomBy(1 / 1.4)} aria-label="Zoom in" title="Zoom in">
              <Plus size={15} />
            </button>
            <button type="button" onClick={() => zoomBy(1.4)} aria-label="Zoom out" title="Zoom out">
              <Minus size={15} />
            </button>
            <button
              type="button"
              onClick={() => focusSeat(legacySeat)}
              aria-label="Zoom to selected constituency"
              title="Zoom to selected constituency"
            >
              <Crosshair size={15} />
            </button>
            <button type="button" onClick={() => applyView(null)} aria-label="Reset zoom" title="Reset zoom">
              <RotateCcw size={15} />
            </button>
          </div>
          <div
            ref={mapRef}
            className={view ? "legacy-map-svg zoomed" : "legacy-map-svg"}
            aria-label={`UK constituency map colored by ${MAP_MODE_META[mode].label}`}
          />
          <p className="map-zoom-hint">Scroll to zoom · drag to pan · click a seat to inspect it</p>
        </div>
      ) : (
        <svg viewBox="40 20 530 430" className="constituency-map" role="img">
          <title>Fallback constituency map colored by {mode}</title>
          {constituencies.map((metric) => (
            <path
              key={metric.id}
              d={metric.path}
              fill={colorFor(metric, mode)}
              className={metric.id === selectedId ? "selected" : ""}
              tabIndex={0}
              onClick={() => onSelect(metric.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") onSelect(metric.id);
              }}
            />
          ))}
        </svg>
      )}
      <p className="map-caption">{modeCaption(mode, bindings, Boolean(aggregates && Object.keys(aggregates).length > 0))}</p>
      <MapLegend mode={mode} bindings={bindings} />
    </div>
  );
}
