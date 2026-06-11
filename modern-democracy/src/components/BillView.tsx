import { ArrowLeft } from "lucide-react";
import type { Bill, VoteChoice } from "../data/types";
import { mapBackendNews, type BackendBillDetail, type MapBindings } from "../lib/api";
import { Compass } from "./Compass";
import { ConstituencyMap } from "./ConstituencyMap";
import { DebatePanel } from "./DebatePanel";
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
  signedIn: boolean;
  onRequireAccount: () => void;
  onBack: () => void;
};

function percent(value: number, total: number) {
  return total ? Math.round((value / total) * 100) : 0;
}

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
  signedIn,
  onRequireAccount,
  onBack
}: BillViewProps) {
  const selectedSeatConstituencyId =
    mapBindings?.bySvgId[selectedConstituency]?.constituency_id ?? null;
  const selectedMetric =
    bill.constituencies.find((constituency) => constituency.id === selectedConstituency) ??
    bill.constituencies[0];
  const representative = bill.representatives.find(
    (mp) => mp.constituencyId === selectedMetric.id
  );

  return (
    <>
      <button className="ghost back-link" onClick={onBack}>
        <ArrowLeft size={15} /> All bills
      </button>

      <section className="hero-workspace">
        <div className="bill-copy">
          <div className="status-row">
            <span>{bill.house}</span>
            <span>{bill.stage}</span>
            <span>{bill.status}</span>
          </div>
          <h1>{bill.title}</h1>
          <p>{bill.summary}</p>
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
                  {mode}
                </button>
              ))}
            </div>
          </div>
          <ConstituencyMap
            constituencies={bill.constituencies}
            mode={mapMode}
            selectedId={selectedConstituency}
            onSelect={setSelectedConstituency}
            bindings={mapBindings}
            aggregates={billAggregatesBySeat}
          />
        </section>

        <aside className="inspector">
          <section className="panel">
            <h3>{selectedMetric.name}</h3>
            <div className="metric-stack">
              <div>
                <span>For</span>
                <strong>
                  {percent(selectedMetric.publicVote.for, selectedMetric.publicVote.turnout)}%
                </strong>
              </div>
              <div>
                <span>Against</span>
                <strong>
                  {percent(selectedMetric.publicVote.against, selectedMetric.publicVote.turnout)}%
                </strong>
              </div>
              <div>
                <span>MP voted</span>
                <strong>{representative?.recentVote ?? selectedMetric.mpVote}</strong>
              </div>
            </div>
          </section>

          <section className="panel">
            <h3>Political direction</h3>
            <Compass point={bill.compass} />
            <p className="muted">{bill.compass.rationale}</p>
          </section>
        </aside>
      </div>

      <DebatePanel
        posts={bill.debate}
        liveBillId={liveBillId}
        constituencyId={selectedSeatConstituencyId}
        signedIn={signedIn}
        onRequireAccount={onRequireAccount}
      />

      {(billDetail?.news?.length ?? 0) > 0 && (
        <NewsLens items={billDetail!.news.map(mapBackendNews)} />
      )}
    </>
  );
}
