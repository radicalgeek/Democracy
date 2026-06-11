import { useEffect, useMemo, useRef, useState } from "react";
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

function cleanLegacySvg(svg: string) {
  return svg
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/\son[a-z]+="[^"]*"/gi, "")
    .replace(/style="position:absolute; width: 100%;  height: 1px; overflow:visible"/i, "")
    .replace(/<\/style>/i, `${LEGACY_PAGE_STYLES}</style>`);
}

function formatSeatName(id: string) {
  return id.replace(/_/g, " ");
}

function modeCaption(
  mode: MapMode,
  bindings: MapBindings | null | undefined,
  hasAggregates: boolean
) {
  if (!bindings) return "Demo shading — backend offline, colours are illustrative only.";
  if (mode === "vote") {
    return hasAggregates
      ? `Real anonymous ballot aggregates (privacy-thresholded). Pale seats have no published data yet. ${bindings.summary.exact + bindings.summary.normalized} of 650 legacy seats bound to current constituencies.`
      : "No published vote aggregates for this bill yet — matched seats shown pale.";
  }
  if (mode === "alignment") {
    return "Current MP party colour per bound seat (live Members API import). Divergence shading arrives with division-vote import.";
  }
  return "Demo shading — this layer's real aggregates are not built yet.";
}

export function ConstituencyMap({
  constituencies,
  mode,
  selectedId,
  onSelect,
  bindings,
  aggregates
}: ConstituencyMapProps) {
  const selected = constituencies.find((item) => item.id === selectedId) ?? constituencies[0];
  const mapRef = useRef<HTMLDivElement>(null);
  const [svgMarkup, setSvgMarkup] = useState("");
  const [legacySeat, setLegacySeat] = useState("South_East_Cornwall");

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

  useEffect(() => {
    const root = mapRef.current;
    if (!root || !svgMarkup) return;

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
      seat.style.strokeWidth = isSelected ? "2" : "0.5";
      seat.style.cursor = "pointer";
      seat.setAttribute("tabindex", "0");
      seat.setAttribute("role", "button");
      seat.setAttribute(
        "aria-label",
        binding?.constituency_name ?? formatSeatName(id)
      );

      const selectSeat = () => {
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
  }, [aggregates, bindings, legacySeat, mode, onSelect, svgMarkup]);

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
              {selectedBinding.match_status === "unmatched"
                ? "legacy seat"
                : `${selectedBinding.match_status} match`}
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
        <div
          ref={mapRef}
          className="legacy-map-svg"
          aria-label={`UK constituency map colored by ${mode}`}
          dangerouslySetInnerHTML={{ __html: svgMarkup }}
        />
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
      <div className="legend-row">
        <span>
          <i className="swatch for" /> For
        </span>
        <span>
          <i className="swatch against" /> Against
        </span>
        <span>
          <i className="swatch alert" /> MP divergence
        </span>
        <span>
          <i className="swatch debate" /> Debate intensity
        </span>
      </div>
    </div>
  );
}
