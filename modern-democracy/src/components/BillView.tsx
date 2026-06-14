import { ArrowLeft, ExternalLink, HelpCircle, Landmark, ThumbsDown, ThumbsUp } from "lucide-react";
import type { Bill, VoteChoice } from "../data/types";
import {
  mapBackendNews,
  type AccountUser,
  type BackendBillDetail,
  type Constituency,
  type MapBindings
} from "../lib/api";
import { BillProgress } from "./BillProgress";
import { Compass } from "./Compass";
import { ConstituencyInspector } from "./ConstituencyInspector";
import { DebateSpeakers } from "./DebateSpeakers";
import { ConstituencyMap, MAP_MODE_META } from "./ConstituencyMap";
import { DebatePanel } from "./DebatePanel";
import { HelpTrigger } from "./HelpTrigger";
import { NewsLens } from "./NewsLens";
import { VotePanel } from "./VotePanel";

type MapMode = "vote" | "alignment" | "compass" | "debate";

type BillViewProps = {
  bill: Bill;
  billDetail: BackendBillDetail | null;
  liveBillId: number | null;
  selectedVote: VoteChoice | null;
  onVote: (vote: VoteChoice) => void;
  mapMode: MapMode;
  setMapMode: (mode: MapMode) => void;
  selectedConstituency: string;
  setSelectedConstituency: (id: string) => void;
  mapBindings: MapBindings | null;
  billAggregatesBySeat: Record<
    number,
    { for: number; against: number; abstain: number; total: number }
  > | null;
  constituencies: Constituency[];
  nationalView: boolean;
  onSetNationalView: (value: boolean) => void;
  user: AccountUser | null;
  signedIn: boolean;
  onRequireAccount: () => void;
  onBack: () => void;
};

/**
 * One bill as a page: everything bill-scoped lives here — summary and vote,
 * the constituency map for this bill, its debate thread, and its news.
 */
export function BillView({
  bill,
  billDetail,
  liveBillId,
  selectedVote,
  onVote,
  mapMode,
  setMapMode,
  selectedConstituency,
  setSelectedConstituency,
  mapBindings,
  billAggregatesBySeat,
  constituencies,
  nationalView,
  onSetNationalView,
  user,
  signedIn,
  onRequireAccount,
  onBack
}: BillViewProps) {
  const selectedSeatConstituencyId =
    mapBindings?.bySvgId[selectedConstituency]?.constituency_id ?? null;
  // Clicking a seat on the map also pins the inspector to that seat.
  const selectSeatFromMap = (svgId: string) => {
    onSetNationalView(false);
    setSelectedConstituency(svgId);
  };
  return (
    <>
      <button className="ghost back-link" onClick={onBack}>
        <ArrowLeft size={15} /> All bills
      </button>

      <section className="hero-workspace">
        <div className="bill-copy">
          <div className="status-row">
            <span>
              <HelpTrigger topicId="bill-process" inline label="">
                <HelpCircle size={14} style={{ marginRight: "4px", marginTop: "-2px" }} />
              </HelpTrigger>
              {bill.house}
            </span>
            <span>{bill.stage}</span>
            <span>{bill.status}</span>
          </div>
          <h1>{bill.title}</h1>
          <p>{bill.summary}</p>
          <BillProgress
            title={bill.title}
            house={bill.house}
            stage={bill.stage}
            events={billDetail?.events ?? []}
          />
          <div className="citation-row">
            {bill.citations.map((citation) => (
              <a key={citation.url} href={citation.url} target="_blank" rel="noreferrer">
                {citation.label}
              </a>
            ))}
          </div>
        </div>
        <VotePanel
          integrity={bill.integrity}
          selectedVote={selectedVote}
          onVote={onVote}
          liveBillId={liveBillId}
          constituencyId={selectedSeatConstituencyId}
          signedIn={signedIn}
          onRequireAccount={onRequireAccount}
        />
      </section>

      <div className="workspace-grid">
        <section className="panel map-panel">
          <div className="map-controls">
            <div>
              <h2>Public will map</h2>
              <p>How constituencies are voting on this bill.</p>
            </div>
            <div className="segmented">
              {(["vote", "alignment", "compass", "debate"] as MapMode[]).map((mode) => (
                <button
                  key={mode}
                  className={mapMode === mode ? "selected" : ""}
                  onClick={() => setMapMode(mode)}
                >
                  {MAP_MODE_META[mode].label}
                </button>
              ))}
            </div>
          </div>
          <ConstituencyMap
            constituencies={bill.constituencies}
            mode={mapMode}
            selectedId={selectedConstituency}
            onSelect={selectSeatFromMap}
            bindings={mapBindings}
            aggregates={billAggregatesBySeat}
          />
        </section>

        <aside className="inspector">
          <ConstituencyInspector
            billDetail={billDetail}
            mapBindings={mapBindings}
            constituencies={constituencies}
            selectedSvgId={selectedConstituency}
            onSelectSvgId={setSelectedConstituency}
            nationalView={nationalView}
            onSetNationalView={onSetNationalView}
            user={user}
          />

          <section className="panel">
            <h3>
              Political direction
              <HelpTrigger topicId="compass" inline>
                <HelpCircle size={16} />
              </HelpTrigger>
            </h3>
            <Compass point={bill.compass} />
            <p className="muted">{bill.compass.rationale}</p>
          </section>
        </aside>
      </div>

      <HansardSection billDetail={billDetail} />

      <DebatePanel
        posts={bill.debate}
        liveBillId={liveBillId}
        constituencyId={selectedSeatConstituencyId}
        signedIn={signedIn}
        onRequireAccount={onRequireAccount}
      />

      {billDetail && <NewsLens items={billDetail.news.map(mapBackendNews)} />}
    </>
  );
}

/**
 * What was said in Parliament: the AI summary of the Hansard debates on this
 * bill — main points and the strongest arguments each way — with links to the
 * official transcripts it was built from.
 */
function HansardSection({ billDetail }: { billDetail: BackendBillDetail | null }) {
  const analysis = billDetail?.analyses.find((item) => item.kind === "debate-summary");
  const debates = billDetail?.debates ?? [];
  if (!analysis && debates.length === 0) return null;

  const output = (analysis?.output ?? {}) as {
    summary?: string;
    mainPoints?: string[];
    forArguments?: string[];
    againstArguments?: string[];
  };

  return (
    <section className="workspace-section hansard-section">
      <div className="section-heading">
        <Landmark size={20} />
        <div>
          <h2>What was said in Parliament</h2>
          <p>
            AI summary of the official Hansard debate record
            {analysis ? ` (model: ${analysis.model})` : ""} — check the transcripts below.
          </p>
        </div>
      </div>

      {output.summary && <p className="hansard-summary">{output.summary}</p>}

      {(output.mainPoints?.length ?? 0) > 0 && (
        <div className="panel hansard-points">
          <h3>Main points argued</h3>
          <ul>
            {output.mainPoints!.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        </div>
      )}

      {((output.forArguments?.length ?? 0) > 0 || (output.againstArguments?.length ?? 0) > 0) && (
        <div className="hansard-arguments">
          {(output.forArguments?.length ?? 0) > 0 && (
            <div className="panel argument-card for">
              <h3>
                <ThumbsUp size={16} /> Argued in favour
              </h3>
              <ul>
                {output.forArguments!.map((argument) => (
                  <li key={argument}>{argument}</li>
                ))}
              </ul>
            </div>
          )}
          {(output.againstArguments?.length ?? 0) > 0 && (
            <div className="panel argument-card against">
              <h3>
                <ThumbsDown size={16} /> Argued against
              </h3>
              <ul>
                {output.againstArguments!.map((argument) => (
                  <li key={argument}>{argument}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {debates.length > 0 && (
        <div className="hansard-debate-list">
          {debates.map((debate) => (
            <div key={debate.ext_id} className="hansard-debate-item">
              <a
                className="hansard-debate-row"
                href={debate.source_url}
                target="_blank"
                rel="noreferrer"
              >
                <div>
                  <strong>
                    {debate.house} · {debate.sitting_date ? new Date(debate.sitting_date).toLocaleDateString("en-GB") : "date unknown"}
                  </strong>
                  <span>
                    {debate.contributions} contributions from {debate.speakers} speakers
                  </span>
                </div>
                <ExternalLink size={15} />
              </a>
              <DebateSpeakers speakers={debate.speakers_detail} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
