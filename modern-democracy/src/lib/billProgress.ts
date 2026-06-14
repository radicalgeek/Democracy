/**
 * Maps a bill's current house + stage onto the canonical journey a UK bill takes
 * through Parliament, so the UI can draw where it is: through the first House, the
 * second House, then Royal Assent.
 *
 * The data we get is messy (free-text stage names, occasionally a null house), so
 * everything here is best-effort and defensive — the goal is a recognisable shape,
 * not a legally exact record.
 */

export type ProgressState = "done" | "current" | "upcoming";

export type ProgressStage = {
  key: string;
  label: string;
  state: ProgressState;
  date?: string | null;
};

export type ProgressPhase = {
  key: string;
  label: string;
  state: ProgressState;
  stages: ProgressStage[];
  /** Royal Assent is a single milestone rather than a House with sub-stages. */
  milestone?: boolean;
  date?: string | null;
};

export type BillJourney = {
  phases: ProgressPhase[];
  /** Human label for where the bill is right now, e.g. "Lords · Committee stage". */
  currentLabel: string;
  /** 0–100 across the whole journey. */
  percent: number;
};

type BillEvent = { stage: string | null; house: string | null; happened_on: string | null };

type House = "Commons" | "Lords";

const HOUSE_STAGES = [
  { key: "1st", label: "1st reading" },
  { key: "2nd", label: "2nd reading" },
  { key: "committee", label: "Committee" },
  { key: "report", label: "Report" },
  { key: "3rd", label: "3rd reading" }
] as const;

/** Position within a House (0–4), or a journey-level milestone. */
type StageClass = number | "amendments" | "royalassent";

function classifyStage(raw: string | null | undefined): StageClass {
  const s = (raw ?? "").toLowerCase();
  if (s.includes("royal assent") || s.includes("enacted") || s.includes("act of parliament")) {
    return "royalassent";
  }
  if (s.includes("consideration of") || s.includes("amend") || s.includes("ping")) {
    return "amendments";
  }
  if (s.includes("3rd") || s.includes("third reading")) return 4;
  if (s.includes("report")) return 3;
  if (s.includes("committee")) return 2;
  if (s.includes("2nd") || s.includes("second reading")) return 1;
  return 0; // 1st reading / introduction / presentation / unknown-but-early
}

function normaliseHouse(raw: string | null | undefined): House | null {
  const s = (raw ?? "").toLowerCase();
  if (s.includes("lords")) return "Lords";
  if (s.includes("commons")) return "Commons";
  return null;
}

/**
 * Which House the bill started in. The "[HL]" suffix is the reliable signal that a
 * bill originated in the Lords; otherwise we assume it began in the Commons.
 */
function originHouse(title: string): House {
  return /\[hl\]/i.test(title) ? "Lords" : "Commons";
}

function stateFor(index: number, currentIndex: number): ProgressState {
  if (index < currentIndex) return "done";
  if (index === currentIndex) return "current";
  return "upcoming";
}

export function buildBillJourney(
  title: string,
  currentHouse: string | null,
  currentStage: string | null,
  events: BillEvent[] = []
): BillJourney {
  const first = originHouse(title);
  const second: House = first === "Commons" ? "Lords" : "Commons";
  const houseOrder: House[] = [first, second];

  const currentClass = classifyStage(currentStage);
  const here = normaliseHouse(currentHouse) ?? first;

  // Collapse the journey to a single 0–11 index: 0–4 first House, 5–9 second House,
  // 10 consideration of amendments ("ping-pong" between the Houses), 11 Royal Assent.
  let currentIndex: number;
  if (currentClass === "royalassent") {
    currentIndex = 11;
  } else if (currentClass === "amendments") {
    currentIndex = 10;
  } else {
    const base = here === second ? 5 : 0;
    currentIndex = base + currentClass;
  }

  // Latest known date per (house, stage-class) and for Royal Assent, from history.
  const dates = new Map<string, string>();
  for (const event of events) {
    const house = normaliseHouse(event.house);
    const cls = classifyStage(event.stage);
    const key =
      cls === "royalassent"
        ? "royalassent"
        : cls === "amendments"
          ? "amendments"
          : `${house ?? ""}:${cls}`;
    if (event.happened_on) dates.set(key, event.happened_on);
  }

  const phases: ProgressPhase[] = houseOrder.map((house, houseIndex) => {
    const offset = houseIndex * 5;
    const stages: ProgressStage[] = HOUSE_STAGES.map((stage, stageIndex) => {
      const index = offset + stageIndex;
      return {
        key: `${house}-${stage.key}`,
        label: stage.label,
        state: stateFor(index, currentIndex),
        date: dates.get(`${house}:${stageIndex}`) ?? null
      };
    });
    const allDone = stages.every((stage) => stage.state === "done");
    const allUpcoming = stages.every((stage) => stage.state === "upcoming");
    return {
      key: house,
      label: house,
      stages,
      state: allDone ? "done" : allUpcoming ? "upcoming" : "current"
    };
  });

  phases.push({
    key: "amendments",
    label: "Amendments",
    milestone: true,
    stages: [],
    date: dates.get("amendments") ?? null,
    state: stateFor(10, currentIndex)
  });

  phases.push({
    key: "royal-assent",
    label: "Royal Assent",
    milestone: true,
    stages: [],
    date: dates.get("royalassent") ?? null,
    state: stateFor(11, currentIndex)
  });

  const houseLabel = normaliseHouse(currentHouse) ?? here;
  const currentLabel = currentStage ? `${houseLabel} · ${currentStage}` : `${houseLabel}`;

  return {
    phases,
    currentLabel,
    percent: Math.round((Math.min(currentIndex, 11) / 11) * 100)
  };
}
