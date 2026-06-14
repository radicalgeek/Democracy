import { ArrowLeftRight, Check, Crown } from "lucide-react";
import { buildBillJourney, type ProgressPhase } from "../lib/billProgress";

/**
 * Shows where a bill sits on its journey through Parliament — through the first
 * House, the second House, then Royal Assent. Two layouts share one data model:
 * `compact` for the bill list (a thin segmented bar) and the full labelled
 * stepper for the bill page.
 */
export function BillProgress({
  title,
  house,
  stage,
  events = [],
  compact = false
}: {
  title: string;
  house: string | null;
  stage: string | null;
  events?: Array<{ stage: string | null; house: string | null; happened_on: string | null }>;
  compact?: boolean;
}) {
  const journey = buildBillJourney(title, house, stage, events);

  if (compact) {
    const segments = journey.phases.flatMap((phase) =>
      phase.milestone ? [phase.state] : phase.stages.map((s) => s.state)
    );
    return (
      <div
        className="bill-progress-mini"
        role="img"
        aria-label={`Progress: ${journey.currentLabel} (${journey.percent}% through Parliament)`}
      >
        {segments.map((state, index) => (
          <span key={index} className={`bpm-seg bpm-${state}`} />
        ))}
      </div>
    );
  }

  const fmtDate = (date?: string | null) =>
    date ? new Date(date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : null;

  return (
    <div className="bill-progress">
      <div className="bill-progress-head">
        <span className="bill-progress-label">Journey through Parliament</span>
        <span className="bill-progress-now">{journey.currentLabel}</span>
      </div>
      <div className="bill-progress-track">
        {journey.phases.map((phase) => (
          <PhaseBlock key={phase.key} phase={phase} fmtDate={fmtDate} />
        ))}
      </div>
    </div>
  );
}

function PhaseBlock({
  phase,
  fmtDate
}: {
  phase: ProgressPhase;
  fmtDate: (date?: string | null) => string | null;
}) {
  if (phase.milestone) {
    const Icon = phase.key === "royal-assent" ? Crown : ArrowLeftRight;
    const title =
      phase.key === "amendments"
        ? "Consideration of amendments — the Houses send the bill back and forth (ping-pong) until they agree the final text"
        : undefined;
    return (
      <div className={`bp-phase milestone bp-${phase.state}`}>
        <span className="bp-phase-name">{phase.label}</span>
        <div className="bp-stages">
          <div className={`bp-stage bp-${phase.state}`} title={title}>
            <span className="bp-node">
              {phase.state === "done" ? <Check size={11} /> : <Icon size={11} />}
            </span>
            <span className="bp-stage-label">{phase.label}</span>
            {phase.date && phase.state !== "upcoming" && (
              <span className="bp-stage-date">{fmtDate(phase.date)}</span>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bp-phase bp-${phase.state}`}>
      <span className="bp-phase-name">{phase.label}</span>
      <div className="bp-stages">
        {phase.stages.map((stage) => (
          <div key={stage.key} className={`bp-stage bp-${stage.state}`}>
            <span className="bp-node">{stage.state === "done" ? <Check size={11} /> : null}</span>
            <span className="bp-stage-label">{stage.label}</span>
            {stage.date && stage.state !== "upcoming" && (
              <span className="bp-stage-date">{fmtDate(stage.date)}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
