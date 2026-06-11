import { useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart3,
  CheckCircle2,
  FileText,
  Fingerprint,
  Gavel,
  Landmark,
  Map,
  MessageSquare,
  Newspaper,
  ScrollText,
  Search,
  Shield,
  UserRoundCheck,
  Vote
} from "lucide-react";
import { AuthScreen, type AuthMode } from "./components/AuthScreen";
import { Compass } from "./components/Compass";
import { ConstituencyMap } from "./components/ConstituencyMap";
import { DebatePanel } from "./components/DebatePanel";
import { Landing } from "./components/Landing";
import { MyMP } from "./components/MyMP";
import { IntegrationBanner } from "./components/IntegrationBanner";
import { NewsLens } from "./components/NewsLens";
import { ONBOARDED_KEY, Onboarding } from "./components/Onboarding";
import { PetitionsPanel } from "./components/PetitionsPanel";
import { VotePanel } from "./components/VotePanel";
import { sampleBill, samplePetitions } from "./data/sampleData";
import type {
  IntegrationStatus,
  ParliamentLiveBill,
  PetitionLive,
  VoteChoice
} from "./data/types";
import { checkMembersApi, fetchLiveBills, liveBillToDemoTitle } from "./lib/parliament";
import { fetchLivePetitions } from "./lib/petitions";
import {
  checkBackend,
  clearSession,
  currentUser,
  mapBackendNews,
  fetchBackendBills,
  fetchBillDetail,
  fetchMapBindings,
  type AccountUser,
  type BackendBill,
  type BackendBillDetail,
  type MapBindings
} from "./lib/api";

type Tab =
  | "bills"
  | "workspace"
  | "mymp"
  | "petitions"
  | "debate"
  | "news"
  | "map"
  | "representatives"
  | "voice"
  | "transparency";
type MapMode = "vote" | "alignment" | "compass" | "debate";

const navItems: Array<[string, Tab, typeof FileText]> = [
  ["Bills", "bills", FileText],
  ["Vote", "workspace", Vote],
  ["My MP", "mymp", Landmark],
  ["Petitions", "petitions", ScrollText],
  ["Debate", "debate", MessageSquare],
  ["News Lens", "news", Newspaper],
  ["Map", "map", Map],
  ["Representatives", "representatives", Landmark],
  ["My Voice", "voice", Fingerprint],
  ["Transparency", "transparency", Shield]
] as const;

function percent(value: number, total: number) {
  return total ? Math.round((value / total) * 100) : 0;
}

export function App() {
  const [user, setUser] = useState<AccountUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode | null>(null);
  const [exploring, setExploring] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [selectedTab, setSelectedTab] = useState<Tab>("workspace");
  const [mapMode, setMapMode] = useState<MapMode>("vote");
  const [selectedConstituency, setSelectedConstituency] = useState(sampleBill.constituencies[0].id);
  const [selectedVote, setSelectedVote] = useState<VoteChoice | null>(null);
  const [liveBills, setLiveBills] = useState<ParliamentLiveBill[]>([]);
  const [livePetitions, setLivePetitions] = useState<PetitionLive[]>([]);
  const [backendStatus, setBackendStatus] = useState<IntegrationStatus>({
    source: "Democracy backend",
    status: "idle",
    message: "Not checked yet."
  });
  const [backendBills, setBackendBills] = useState<BackendBill[]>([]);
  const [billDetail, setBillDetail] = useState<BackendBillDetail | null>(null);
  const [mapBindings, setMapBindings] = useState<MapBindings | null>(null);
  const [statuses, setStatuses] = useState<IntegrationStatus[]>([
    {
      source: "UK Parliament Bills API",
      status: "idle",
      message: "Not checked yet."
    },
    {
      source: "UK Parliament Members API",
      status: "idle",
      message: "Not checked yet."
    },
    {
      source: "UK Parliament Petitions API",
      status: "idle",
      message: "Not checked yet."
    }
  ]);

  useEffect(() => {
    let mounted = true;
    currentUser().then((account) => {
      if (!mounted) return;
      setUser(account);
      setAuthChecked(true);
    });
    return () => {
      mounted = false;
    };
  }, []);

  function handleAuthed(account: AccountUser) {
    const cameFromSignup = authMode === "signup";
    setUser(account);
    setAuthMode(cameFromSignup ? "verify" : authMode === "verify" ? "verify" : null);
  }

  function handleSignOut() {
    clearSession();
    setUser(null);
    setExploring(false);
    setAuthMode(null);
  }

  useEffect(() => {
    let mounted = true;

    async function loadLiveData() {
      setStatuses((current) =>
        current.map((status) => ({ ...status, status: "loading", message: "Checking live API..." }))
      );
      const [billsResult, membersStatus, petitionsResult] = await Promise.all([
        fetchLiveBills(8),
        checkMembersApi(),
        fetchLivePetitions(8)
      ]);
      if (!mounted) return;
      setLiveBills(billsResult.bills);
      setLivePetitions(petitionsResult.petitions);
      setStatuses([billsResult.status, membersStatus, petitionsResult.status]);
    }

    loadLiveData();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    async function loadBackend() {
      const status = await checkBackend();
      if (!mounted) return;
      setBackendStatus(status);
      if (status.status !== "live") return;

      try {
        const [billsPayload, bindings] = await Promise.all([
          fetchBackendBills(20),
          fetchMapBindings()
        ]);
        if (!mounted) return;
        setBackendBills(billsPayload.bills);
        setMapBindings(bindings);

        // Open the most data-rich bill: prefer real ballots, then real text.
        const first =
          billsPayload.bills.find((item) => item.ballots > 0 && item.has_text) ??
          billsPayload.bills.find((item) => item.ballots > 0) ??
          billsPayload.bills.find((item) => item.has_text) ??
          billsPayload.bills[0];
        if (first) {
          const detail = await fetchBillDetail(first.id);
          if (mounted) setBillDetail(detail);
        }
      } catch {
        // backend went away mid-load; sample data remains
      }
    }

    loadBackend();
    return () => {
      mounted = false;
    };
  }, []);

  // Default the map selection to the signed-in user's own constituency once
  // the seat bindings are loaded. Applied once so manual selection sticks.
  const homeSeatApplied = useRef(false);
  useEffect(() => {
    if (homeSeatApplied.current || !user?.constituencyId || !mapBindings) return;
    const entry = Object.entries(mapBindings.bySvgId).find(
      ([, binding]) => binding.constituency_id === user.constituencyId
    );
    if (entry) {
      setSelectedConstituency(entry[0]);
      homeSeatApplied.current = true;
    }
  }, [user, mapBindings]);

  // First sign-in: launch the intro tour once the user lands in the app.
  useEffect(() => {
    if (user && !authMode && !localStorage.getItem(ONBOARDED_KEY)) {
      setShowOnboarding(true);
    }
  }, [user, authMode]);

  async function openBackendBill(billId: number) {
    try {
      setBillDetail(await fetchBillDetail(billId));
      setSelectedTab("workspace");
    } catch {
      // keep current bill if the detail fetch fails
    }
  }

  const bill = useMemo(() => {
    if (!billDetail) {
      return {
        ...sampleBill,
        title: liveBillToDemoTitle(liveBills, sampleBill.title)
      };
    }

    const summaryAnalysis = billDetail.analyses.find((item) => item.kind === "summary");
    const compassAnalysis = billDetail.analyses.find((item) => item.kind === "compass");
    const compassOutput = (compassAnalysis?.output ?? {}) as {
      x?: number;
      y?: number;
      label?: string;
      rationale?: string;
    };
    const summaryOutput = (summaryAnalysis?.output ?? {}) as { summary?: string };

    return {
      ...sampleBill,
      parliamentId: billDetail.bill.id,
      title: billDetail.bill.short_title,
      stage: billDetail.bill.current_stage ?? "Stage unknown",
      house: billDetail.bill.current_house ?? "House unknown",
      status: billDetail.bill.bill_type ?? "Bill",
      summary:
        summaryOutput.summary ??
        billDetail.bill.long_title ??
        sampleBill.summary,
      citations:
        summaryAnalysis?.citations?.length
          ? summaryAnalysis.citations
          : [{ label: "Bill page", url: billDetail.bill.source_url }],
      updatedAt: billDetail.bill.last_updated ?? sampleBill.updatedAt,
      publicVote: {
        for: billDetail.aggregates.totals.for,
        against: billDetail.aggregates.totals.against,
        abstain: billDetail.aggregates.totals.abstain,
        turnout: billDetail.aggregates.ballots
      },
      compass: {
        x: (compassOutput.x ?? 0) / 10,
        y: (compassOutput.y ?? 0) / 10,
        label: compassOutput.label ?? "unclassified",
        confidence: compassAnalysis?.confidence ?? 0,
        rationale:
          (compassOutput.rationale ?? "No compass analysis yet.") +
          (compassAnalysis ? ` (model: ${compassAnalysis.model})` : "")
      },
      integrity: billDetail.checkpoint
        ? {
            id: billDetail.checkpoint.checkpoint_hash.slice(0, 12),
            publishedAt: billDetail.checkpoint.created_at,
            merkleRoot: billDetail.checkpoint.merkle_root,
            ballots: billDetail.checkpoint.ballot_count,
            receiptVerified: true
          }
        : sampleBill.integrity
    };
  }, [billDetail, liveBills]);

  const liveBillId = billDetail?.bill.id ?? null;

  const billAggregatesBySeat = useMemo(() => {
    if (!billDetail) return null;
    const bySeat: Record<number, { for: number; against: number; abstain: number; total: number }> = {};
    for (const slice of billDetail.aggregates.constituencies) {
      bySeat[slice.constituencyId] = {
        for: slice.for,
        against: slice.against,
        abstain: slice.abstain,
        total: slice.total
      };
    }
    return bySeat;
  }, [billDetail]);

  const selectedSeatConstituencyId =
    mapBindings?.bySvgId[selectedConstituency]?.constituency_id ?? null;

  const totalPublic = bill.publicVote.for + bill.publicVote.against + bill.publicVote.abstain;
  const selectedMetric =
    bill.constituencies.find((constituency) => constituency.id === selectedConstituency) ??
    bill.constituencies[0];
  const representative = bill.representatives.find(
    (mp) => mp.constituencyId === selectedMetric.id
  );

  if (!authChecked) {
    return <div className="auth-loading">Loading…</div>;
  }

  if (authMode) {
    return (
      <AuthScreen
        mode={authMode}
        user={user}
        onAuthed={handleAuthed}
        onSwitchMode={setAuthMode}
        onBack={() => setAuthMode(null)}
      />
    );
  }

  if (!user && !exploring) {
    return (
      <Landing
        onCreateAccount={() => setAuthMode("signup")}
        onSignIn={() => setAuthMode("login")}
        onExplore={() => setExploring(true)}
      />
    );
  }

  return (
    <div className="app-shell">
      {showOnboarding && user && (
        <Onboarding
          user={user}
          onClose={() => setShowOnboarding(false)}
          onGoToMyMP={() => setSelectedTab("mymp")}
        />
      )}
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">D</div>
          <div>
            <strong>Democracy</strong>
            <span>Represent yourself</span>
          </div>
        </div>
        <nav>
          {navItems.map(([label, tab, Icon]) => (
            <button
              key={label}
              className={selectedTab === tab ? "active" : ""}
              onClick={() => setSelectedTab(tab)}
            >
              <Icon size={18} />
              {label}
            </button>
          ))}
        </nav>
        <div className="trust-card">
          <Shield size={18} />
          <strong>Anonymous vote mode</strong>
          <span>Receipt ready · checkpoint hash published</span>
        </div>
      </aside>

      <main>
        <header className="topbar">
          <div className="searchbox">
            <Search size={18} />
            <input aria-label="Search bills, topics, and representatives" placeholder="Search bills, topics, representatives" />
          </div>
          <div className="topbar-status">
            <span>Live civic data</span>
            <strong>{new Date().toLocaleDateString()}</strong>
          </div>
          {user ? (
            <div className="account-area">
              <button className="profile-button" onClick={() => setSelectedTab("voice")}>
                <UserRoundCheck size={18} />
                <span className="account-name">
                  {user.displayName}
                  {user.verificationTier === 2 && <em className="verified-chip">Verified</em>}
                </span>
                <span className="account-constituency">{user.constituencyName ?? "No constituency"}</span>
              </button>
              <button className="signout-button" onClick={handleSignOut}>
                Sign out
              </button>
            </div>
          ) : (
            <button className="profile-button" onClick={() => setAuthMode("signup")}>
              <UserRoundCheck size={18} />
              Create account
            </button>
          )}
        </header>

        <IntegrationBanner statuses={[...statuses, backendStatus]} liveBills={liveBills} />

        {selectedTab !== "petitions" && (
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
              onVote={setSelectedVote}
              liveBillId={liveBillId}
              constituencyId={selectedSeatConstituencyId}
              signedIn={user != null}
              onRequireAccount={() => setAuthMode("signup")}
            />
          </section>
        )}

        <div className="tab-row">
          {[
            ["bills", "Bills"],
            ["workspace", "Bill workspace"],
            ["mymp", "My MP"],
            ["petitions", "Petitions"],
            ["debate", "Debate"],
            ["news", "News Lens"],
            ["map", "Map"],
            ["representatives", "Representatives"],
            ["voice", "My Voice"],
            ["transparency", "Transparency"]
          ].map(([key, label]) => (
            <button
              key={key}
              className={selectedTab === key ? "selected" : ""}
              onClick={() => setSelectedTab(key as Tab)}
            >
              {label}
            </button>
          ))}
        </div>

        {selectedTab === "bills" && (
          <section className="workspace-section">
            <div className="section-heading">
              <FileText size={20} />
              <div>
                <h2>Active bills</h2>
                <p>Live Parliament data where available, enriched by civic voting and AI analysis.</p>
              </div>
            </div>
            <div className="bills-grid">
              <article
                className="bill-row clickable selected"
                role="button"
                tabIndex={0}
                onClick={() => setSelectedTab("workspace")}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") setSelectedTab("workspace");
                }}
              >
                <div>
                  <strong>{bill.title}</strong>
                  <span>
                    {bill.house} · {bill.stage} · {totalPublic.toLocaleString()} public votes
                  </span>
                </div>
              </article>
              {backendBills
                .filter((item) => item.id !== liveBillId)
                .slice(0, 12)
                .map((item) => (
                  <article
                    className="bill-row clickable"
                    key={item.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => openBackendBill(item.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") openBackendBill(item.id);
                    }}
                  >
                    <div>
                      <strong>{item.short_title}</strong>
                      <span>
                        {item.current_house ?? "—"} · {item.current_stage ?? "—"} ·{" "}
                        {item.ballots > 0
                          ? `${item.ballots.toLocaleString()} anonymous ballots`
                          : item.has_text
                            ? "source text imported"
                            : "imported"}
                      </span>
                    </div>
                  </article>
                ))}
              {backendBills.length === 0 && liveBills.slice(1, 8).map((liveBill) => (
                <article className="bill-row" key={liveBill.id}>
                  <div>
                    <strong>{liveBill.title}</strong>
                    <span>
                      {liveBill.house} · {liveBill.stage}
                    </span>
                  </div>
                  <a href={liveBill.sourceUrl} target="_blank" rel="noreferrer">
                    Source
                  </a>
                </article>
              ))}
              {liveBills.length === 0 &&
                ["Planning and Infrastructure Bill", "Data Use and Access Bill", "Border Security Bill"].map(
                  (title) => (
                    <article className="bill-row" key={title}>
                      <div>
                        <strong>{title}</strong>
                        <span>Sample pending live import · AI summary queued</span>
                      </div>
                      <button onClick={() => setSelectedTab("workspace")}>Preview</button>
                    </article>
                  )
                )}
            </div>
          </section>
        )}

        {selectedTab === "workspace" && (
          <div className="workspace-grid">
            <section className="panel map-panel">
              <div className="map-controls">
                <div>
                  <h2>Public will map</h2>
                  <p>SVG constituency layer coloured by live civic vote sample.</p>
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

              <section className="panel">
                <h3>Representative gap</h3>
                <div className="alignment-meter">
                  <div style={{ width: `${representative?.alignment ?? 44}%` }} />
                </div>
                <p>
                  {representative?.name ?? "Local MP"} alignment:{" "}
                  <strong>{representative?.alignment ?? 44}%</strong>
                </p>
              </section>
            </aside>
          </div>
        )}

        {selectedTab === "mymp" && (
          <MyMP user={user} onRequireAccount={() => setAuthMode("signup")} />
        )}
        {selectedTab === "petitions" && (
          <PetitionsPanel
            petitions={samplePetitions}
            livePetitions={livePetitions}
            signedIn={user != null}
            onRequireAccount={() => setAuthMode("signup")}
          />
        )}
        {selectedTab === "debate" && (
          <DebatePanel
            posts={bill.debate}
            liveBillId={liveBillId}
            constituencyId={selectedSeatConstituencyId}
            signedIn={user != null}
            onRequireAccount={() => setAuthMode("signup")}
          />
        )}
        {selectedTab === "news" && (
          <NewsLens
            items={
              billDetail?.news?.length ? billDetail.news.map(mapBackendNews) : bill.news
            }
          />
        )}
        {selectedTab === "map" && (
          <section className="panel full-map-mode">
            <div className="map-controls">
              <div>
                <h2>Full map analysis</h2>
                <p>Switch layers to compare vote, compass, debate intensity, and MP divergence.</p>
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
        )}
        {selectedTab === "representatives" && (
          <section className="workspace-section">
            <div className="section-heading">
              <Landmark size={20} />
              <div>
                <h2>Representative alignment</h2>
                <p>Compare MP votes with the public vote in each constituency.</p>
              </div>
            </div>
            <div className="representative-grid">
              {bill.representatives.map((mp) => {
                const constituency = bill.constituencies.find((item) => item.id === mp.constituencyId);
                return (
                  <article className="representative-card" key={mp.id}>
                    <header>
                      <div className="avatar">{mp.name.slice(0, 1)}</div>
                      <div>
                        <strong>{mp.name}</strong>
                        <span>
                          {mp.party} · {constituency?.name}
                        </span>
                      </div>
                    </header>
                    <div className="alignment-meter">
                      <div style={{ width: `${mp.alignment}%` }} />
                    </div>
                    <p>
                      Voted <strong>{mp.recentVote}</strong>; public alignment{" "}
                      <strong>{mp.alignment}%</strong>
                    </p>
                  </article>
                );
              })}
            </div>
          </section>
        )}
        {selectedTab === "voice" && (
          <section className="workspace-section">
            <div className="section-heading">
              <Fingerprint size={20} />
              <div>
                <h2>My Voice</h2>
                <p>Your private participation record, receipts, reputation, and moderation status.</p>
              </div>
            </div>
            <div className="voice-grid">
              <div className="panel">
                <h3>Your account</h3>
                {user ? (
                  <>
                    <p>
                      <strong>{user.displayName}</strong>
                      {user.verificationTier === 2 && <em className="verified-chip">Verified</em>}
                    </p>
                    <p className="muted">{user.email}</p>
                    <p>
                      Constituency: <strong>{user.constituencyName ?? "not set"}</strong>
                    </p>
                    {user.verificationTier < 2 && (
                      <>
                        <p className="muted">
                          Verify your identity to give your votes full weight in the count.
                        </p>
                        <button className="primary" onClick={() => setAuthMode("verify")}>
                          Verify identity
                        </button>
                      </>
                    )}
                    <button className="ghost" onClick={() => setShowOnboarding(true)}>
                      Retake the intro tour
                    </button>
                  </>
                ) : (
                  <>
                    <p className="muted">You're exploring without an account.</p>
                    <button className="primary" onClick={() => setAuthMode("signup")}>
                      Create account
                    </button>
                  </>
                )}
              </div>
              <div className="panel">
                <h3>Private vote receipt</h3>
                <p className="hash">{bill.integrity.merkleRoot}</p>
                <p>Receipt proves inclusion without proving your vote choice to another person.</p>
              </div>
              <div className="panel">
                <h3>Privacy controls</h3>
                <p>Vote history is private. Constituency appears only in aggregate public results.</p>
              </div>
            </div>
          </section>
        )}
        {selectedTab === "transparency" && (
          <section className="workspace-section transparency">
            <div className="section-heading">
              <Gavel size={20} />
              <div>
                <h2>Transparency and integrity</h2>
                <p>Every result needs provenance, method, and a verifiable checkpoint.</p>
              </div>
            </div>
            <div className="transparency-grid">
              <div className="panel">
                <CheckCircle2 size={20} />
                <h3>Anonymous receipt</h3>
                <p>
                  Your private receipt proves inclusion without exposing your vote choice to another
                  person.
                </p>
              </div>
              <div className="panel">
                <BarChart3 size={20} />
                <h3>Aggregate snapshot</h3>
                <p>{bill.integrity.merkleRoot}</p>
              </div>
              <div className="panel">
                <Shield size={20} />
                <h3>Moderation rule</h3>
                <p>
                  Heated legitimate debate is allowed. Personal attacks and trolling trigger
                  exponential temporary bans.
                </p>
              </div>
              <div className="panel">
                <Gavel size={20} />
                <h3>Moderation queue</h3>
                <p>
                  1 heated-but-legitimate post visible, 1 review queued, 0 personal attacks
                  published.
                </p>
              </div>
              <div className="panel">
                <DatabaseStatus statuses={statuses} />
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

function DatabaseStatus({ statuses }: { statuses: IntegrationStatus[] }) {
  return (
    <>
      <DatabaseIcon />
      <h3>Live integrations</h3>
      {statuses.map((status) => (
        <p key={status.source}>
          <strong>{status.source}</strong>: {status.message}
        </p>
      ))}
    </>
  );
}

function DatabaseIcon() {
  return <BarChart3 size={20} />;
}
