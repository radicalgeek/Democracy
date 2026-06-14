import { useMemo } from "react";
import type { AccountUser, BackendBillDetail, Constituency, MapBindings } from "../lib/api";

function partyColour(colour: string | null | undefined) {
  return colour ? `#${colour.replace(/^#/, "")}` : "var(--muted)";
}

function percent(value: number, total: number) {
  return total ? Math.round((value / total) * 100) : 0;
}

/**
 * The bill-scoped seat inspector: how a chosen area voted, who its MP is, and
 * how that MP voted. Defaults to the signed-in user's constituency, but any seat
 * — or the whole nation — can be selected, and it stays in sync with the map.
 */
export function ConstituencyInspector({
  billDetail,
  mapBindings,
  constituencies,
  selectedSvgId,
  onSelectSvgId,
  nationalView,
  onSetNationalView,
  user
}: {
  billDetail: BackendBillDetail | null;
  mapBindings: MapBindings | null;
  constituencies: Constituency[];
  selectedSvgId: string;
  onSelectSvgId: (svgId: string) => void;
  nationalView: boolean;
  onSetNationalView: (value: boolean) => void;
  user: AccountUser | null;
}) {
  // svg id ⇄ constituency id, so the dropdown (ids) and the map (svg ids) agree.
  const svgByConstituencyId = useMemo(() => {
    const map = new Map<number, string>();
    if (mapBindings) {
      for (const [svgId, binding] of Object.entries(mapBindings.bySvgId)) {
        if (binding.constituency_id != null && !map.has(binding.constituency_id)) {
          map.set(binding.constituency_id, svgId);
        }
      }
    }
    return map;
  }, [mapBindings]);

  const selectedConstituencyId = nationalView
    ? null
    : mapBindings?.bySvgId[selectedSvgId]?.constituency_id ?? null;

  const selectConstituency = (id: number) => {
    onSetNationalView(false);
    const svgId = svgByConstituencyId.get(id);
    if (svgId) onSelectSvgId(svgId);
  };

  const aggregates = billDetail?.aggregates;
  const mpVotes = billDetail?.mpVotes ?? [];

  // The vote slice for the current scope.
  const slice =
    !nationalView && selectedConstituencyId != null
      ? aggregates?.constituencies.find((c) => c.constituencyId === selectedConstituencyId) ?? null
      : null;
  const totals = nationalView
    ? aggregates
      ? { for: aggregates.totals.for, against: aggregates.totals.against, abstain: aggregates.totals.abstain, turnout: aggregates.ballots }
      : null
    : slice
      ? { for: slice.for, against: slice.against, abstain: slice.abstain, turnout: slice.total }
      : null;

  const constituency =
    selectedConstituencyId != null
      ? constituencies.find((c) => c.id === selectedConstituencyId)
      : undefined;
  const binding = mapBindings?.bySvgId[selectedSvgId];
  const title = nationalView
    ? "National"
    : constituency?.name ?? slice?.name ?? binding?.constituency_name ?? binding?.legacy_name ?? "Constituency";

  const mpVote = selectedConstituencyId != null
    ? mpVotes.find((v) => v.constituency_id === selectedConstituencyId) ?? null
    : null;
  const mpName = constituency?.mp_name ?? binding?.mp_name ?? null;
  const mpParty = constituency?.party_name ?? binding?.party_name ?? null;

  const nationalTally = nationalView
    ? {
        aye: mpVotes.filter((v) => v.vote === "aye").length,
        no: mpVotes.filter((v) => v.vote === "no").length
      }
    : null;

  const showYourSeat =
    user?.constituencyId != null &&
    (nationalView || selectedConstituencyId !== user.constituencyId) &&
    svgByConstituencyId.has(user.constituencyId);

  return (
    <section className="panel inspector-scope">
      <div className="scope-head">
        <h3>{title}</h3>
        {showYourSeat && (
          <button className="scope-yours" onClick={() => selectConstituency(user!.constituencyId!)}>
            Your constituency
          </button>
        )}
      </div>

      <select
        className="scope-select"
        value={nationalView ? "national" : selectedConstituencyId != null ? String(selectedConstituencyId) : "national"}
        onChange={(event) => {
          const value = event.target.value;
          if (value === "national") onSetNationalView(true);
          else selectConstituency(Number(value));
        }}
      >
        <option value="national">National (all constituencies)</option>
        {constituencies.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>

      {totals && totals.turnout > 0 ? (
        <div className="metric-stack">
          <div>
            <span>For</span>
            <strong>{percent(totals.for, totals.turnout)}%</strong>
          </div>
          <div>
            <span>Against</span>
            <strong>{percent(totals.against, totals.turnout)}%</strong>
          </div>
          <div>
            <span>Abstain</span>
            <strong>{percent(totals.abstain, totals.turnout)}%</strong>
          </div>
          <div>
            <span>{nationalView ? "Ballots" : "Turnout"}</span>
            <strong>{totals.turnout.toLocaleString()}</strong>
          </div>
        </div>
      ) : (
        <p className="scope-empty">No published civic ballots here yet.</p>
      )}

      <div className="scope-mp">
        {nationalView ? (
          nationalTally && nationalTally.aye + nationalTally.no > 0 ? (
            <p>
              <span className="scope-mp-label">Commons division</span>
              <strong>
                {nationalTally.aye} Aye · {nationalTally.no} No
              </strong>
            </p>
          ) : (
            <p className="scope-empty">No Commons division recorded for this bill yet.</p>
          )
        ) : mpName ? (
          <>
            <p className="scope-mp-name">
              <span className="scope-mp-label">MP</span>
              {mpName}
              {mpParty && (
                <span
                  className="party-chip"
                  style={{ background: partyColour(mpVote?.party_colour ?? binding?.party_colour) }}
                >
                  {mpParty}
                </span>
              )}
            </p>
            <p className="scope-mp-vote">
              {mpVote ? (
                <>
                  Voted <strong>{mpVote.vote === "aye" ? "For (Aye)" : "Against (No)"}</strong> on this bill
                </>
              ) : (
                "No recorded Commons vote on this bill yet."
              )}
            </p>
          </>
        ) : (
          <p className="scope-empty">No MP on record for this seat.</p>
        )}
      </div>
    </section>
  );
}
