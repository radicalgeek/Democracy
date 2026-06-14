import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Compass as CompassIcon,
  FileText,
  Flame,
  HelpCircle,
  MapPinned,
  Newspaper,
  ScrollText,
  ShieldCheck,
  Trophy,
  Vote
} from "lucide-react";
import { Compass } from "./Compass";
import { LocalAreaMap } from "./LocalAreaMap";
import { MediaLandscape } from "./MediaLandscape";
import { DemocracyHealth } from "./DemocracyHealth";
import { PollingSnapshot } from "./PollingSnapshot";
import { storedMyCompass } from "./Onboarding";
import { HelpTrigger } from "./HelpTrigger";
import { getHelpViewedCountGlobal, markHelpViewedGlobal } from "../lib/useHelpTracking";
import {
  fetchConstituencyLeans,
  fetchConstituencyProfile,
  fetchMediaCompass,
  fetchPetitions,
  storedChoice,
  type AccountUser,
  type BackendBill,
  type BackendPetition,
  type CompassComparison,
  type ConstituencyLean,
  type ConstituencyProfile,
  type MapBindings,
  type MediaCompassPayload
} from "../lib/api";

type DashboardProps = {
  user: AccountUser | null;
  backendBills: BackendBill[];
  mapBindings: MapBindings | null;
  onOpenBill: (billId: number) => void;
  onOpenPetition: (petitionId: number) => void;
  onGoToTab: (tab: string) => void;
  onRequireAccount: () => void;
  onVerify: () => void;
  onStartTour: () => void;
};

export function Dashboard({
  user,
  backendBills,
  mapBindings,
  onOpenBill,
  onOpenPetition,
  onGoToTab,
  onRequireAccount,
  onVerify,
  onStartTour
}: DashboardProps) {
  const [profile, setProfile] = useState<
    (ConstituencyProfile & { compass: CompassComparison }) | null
  >(null);
  const [petitions, setPetitions] = useState<BackendPetition[]>([]);
  const [media, setMedia] = useState<MediaCompassPayload | null>(null);
  const [leans, setLeans] = useState<Record<number, ConstituencyLean> | null>(null);
  const [helpViewedCount, setHelpViewedCount] = useState(() => getHelpViewedCountGlobal());

  useEffect(() => {
    let mounted = true;
    if (user?.constituencyId) {
      fetchConstituencyProfile(user.constituencyId)
        .then((payload) => mounted && setProfile(payload))
        .catch(() => mounted && setProfile(null));
    }
    fetchPetitions()
      .then((payload) => mounted && setPetitions(payload.petitions.slice(0, 4)))
      .catch(() => mounted && setPetitions([]));
    if (user) {
      fetchMediaCompass()
        .then((payload) => mounted && setMedia(payload))
        .catch(() => mounted && setMedia(null));
      fetchConstituencyLeans()
        .then((payload) => {
          if (!mounted) return;
          const byId: Record<number, ConstituencyLean> = {};
          for (const lean of payload.leans) byId[lean.constituencyId] = lean;
          setLeans(byId);
        })
        .catch(() => mounted && setLeans(null));
    }
    return () => {
      mounted = false;
    };
  }, [user, user?.constituencyId]);

  const myCompass = storedMyCompass();

  const myVotes = useMemo(
    () => backendBills.filter((bill) => storedChoice(bill.id) != null),
    [backendBills]
  );

  const votableBills = backendBills
    .filter((bill) => storedChoice(bill.id) == null)
    .slice(0, 4);

  if (!user) {
    return (
      <section className="workspace-section dashboard-welcome">
        <h1>The dashboard of democracy</h1>
        <p className="muted">
          You're exploring without an account. Create one with your postcode to put your MP, your
          constituency, local problems, public money, your compass position, and your voting record
          into one civic dashboard.
        </p>
        <button className="primary" onClick={onRequireAccount}>
          Create account <ArrowRight size={16} />
        </button>
      </section>
    );
  }

  const mp = profile?.mp ?? null;

  return (
    <>
      <section className="dashboard-header">
        <div>
          <h1>
            {greeting()}, {user.displayName.split(" ")[0]}
          </h1>
          <p className="muted">
            {user.constituencyName ?? "No constituency"} ·{" "}
            {user.verificationTier === 2 ? "verified voter" : "registered"}
            {profile && ` · ${profile.participation.ballots.toLocaleString()} civic ballots cast in your constituency`}
          </p>
        </div>
        {user.verificationTier < 2 && (
          <button className="primary" onClick={onVerify}>
            <ShieldCheck size={16} /> Verify identity
          </button>
        )}
      </section>

      <DemocracyHealth
        you={myCompass ? { x: myCompass.x, y: myCompass.y } : null}
        onStartTour={onStartTour}
      />

      <div className="dashboard-grid two">
        <section className="panel dashboard-card">
          <div className="panel-title">
            <CompassIcon size={18} />
            <div>
              <h3>Your position</h3>
              <HelpTrigger topicId="compass" inline>
                <HelpCircle size={16} />
              </HelpTrigger>
            </div>
          </div>
          {myCompass ? (
            <Compass
              point={{
                x: myCompass.x / 10,
                y: myCompass.y / 10,
                label: "You",
                confidence: 1,
                rationale: ""
              }}
            />
          ) : (
            <>
              <p className="muted">
                Answer six quick questions to place yourself on the political compass.
              </p>
              <button className="primary" onClick={onStartTour}>
                Take the tour
              </button>
            </>
          )}
        </section>

        <section className="panel dashboard-card">
          <div className="panel-title">
            <BadgeCheck size={18} />
            <div>
              <h3>Your participation</h3>
            </div>
          </div>
          <div className="metric-stack">
            <div>
              <span>Bills voted</span>
              <strong>{myVotes.length}</strong>
            </div>
            <div>
              <span>Learning</span>
              <strong>{helpViewedCount} topics read</strong>
            </div>
            <div>
              <span>Status</span>
              <strong>{user.verificationTier === 2 ? "Verified" : "Tier 1"}</strong>
            </div>
          </div>
          <p className="muted">
            Ballots are anonymous — your choices live only on this device, receipts prove inclusion.
          </p>
        </section>
      </div>

      <section className="workspace-section">
        <div className="section-heading">
          <MapPinned size={20} />
          <div>
            <h2>Your local area</h2>
            <p>
              The seats around {user.constituencyName ?? "you"} — who holds them, how they lean on
              civic votes, and where participation is strongest.
            </p>
          </div>
        </div>
        <LocalAreaMap
          bindings={mapBindings}
          leans={leans}
          homeConstituencyId={user.constituencyId}
          homeConstituencyName={user.constituencyName}
          onOpenFullMap={() => onGoToTab("map")}
        />
      </section>

      <section className="workspace-section">
        <div className="section-heading">
          <BarChart3 size={20} />
          <div>
            <h2>What the country is telling pollsters</h2>
            <p>
              National voting intention from free, openly-licensed polling — a snapshot of public
              mood to set beside your community's actual civic votes below. A poll is a sample, not a
              vote.
            </p>
          </div>
        </div>
        <div className="panel">
          <PollingSnapshot />
        </div>
      </section>

      {media && media.outlets.length > 0 && (
        <section className="workspace-section">
          <div className="section-heading">
            <Newspaper size={20} />
            <div>
              <h2>Media influence</h2>
              <p>
                Every ingested article is compass-scored — this is where each outlet's recent
                politics coverage sits.
              </p>
            </div>
          </div>
          <div className="panel">
            <MediaLandscape media={media} />
          </div>
        </section>
      )}

      <section className="workspace-section">
        <div className="section-heading">
          <FileText size={20} />
          <div>
            <h2>Vote on what Parliament is debating</h2>
            <p>Current bills you haven't voted on yet.</p>
          </div>
        </div>
        <div className="bills-grid">
          {votableBills.map((bill) => (
            <article
              className="bill-row clickable"
              key={bill.id}
              role="button"
              tabIndex={0}
              onClick={() => onOpenBill(bill.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") onOpenBill(bill.id);
              }}
            >
              <div>
                <strong>{bill.short_title}</strong>
                <span>
                  {bill.current_house ?? "—"} · {bill.current_stage ?? "—"}
                  {bill.ballots > 0 && ` · ${bill.ballots.toLocaleString()} ballots so far`}
                </span>
              </div>
              <Vote size={16} />
            </article>
          ))}
          {votableBills.length === 0 && (
            <p className="muted">You're up to date — you've voted on every imported bill.</p>
          )}
        </div>
        <button className="ghost" onClick={() => onGoToTab("bills")}>
          All bills <ArrowRight size={14} />
        </button>
      </section>

      <section className="workspace-section">
        <div className="section-heading">
          <ScrollText size={20} />
          <div>
            <h2>Most-signed petitions right now</h2>
            <p>Live from petition.parliament.uk — vote for or against, then sign the official one.</p>
          </div>
        </div>
        <div className="bills-grid">
          {petitions.map((petition) => (
            <article
              className="bill-row clickable"
              key={petition.id}
              role="button"
              tabIndex={0}
              onClick={() => onOpenPetition(petition.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") onOpenPetition(petition.id);
              }}
            >
              <div>
                <strong>{petition.action}</strong>
                <span>{petition.signature_count.toLocaleString()} signatures</span>
              </div>
            </article>
          ))}
        </div>
        <button className="ghost" onClick={() => onGoToTab("petitions")}>
          All petitions <ArrowRight size={14} />
        </button>
      </section>
    </>
  );
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}
