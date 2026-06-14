import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BadgeCheck,
  Compass as CompassIcon,
  FileText,
  Flame,
  HelpCircle,
  Landmark,
  MapPinned,
  Newspaper,
  ScrollText,
  Scale,
  ShieldCheck,
  Trophy,
  UserRound,
  Vote
} from "lucide-react";
import { Compass } from "./Compass";
import { CompassCompare } from "./CompassCompare";
import { LocalAreaMap } from "./LocalAreaMap";
import { MediaLandscape } from "./MediaLandscape";
import { NationalCompass } from "./NationalCompass";
import { storedMyCompass } from "./Onboarding";
import { HelpTrigger } from "./HelpTrigger";
import { getHelpViewedCountGlobal, markHelpViewedGlobal } from "../lib/useHelpTracking";
import {
  fetchBallotMajorities,
  fetchConstituencyLeans,
  fetchConstituencyProfile,
  fetchMediaCompass,
  fetchPetitions,
  storedChoice,
  type AccountUser,
  type BackendBill,
  type BackendPetition,
  type BallotMajority,
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
  const [majorities, setMajorities] = useState<BallotMajority[]>([]);
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
      fetchBallotMajorities(user.constituencyId)
        .then((payload) => mounted && setMajorities(payload.majorities))
        .catch(() => mounted && setMajorities([]));
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

  const personalMp = useMemo(() => {
    if (!profile) return null;
    let compared = 0;
    let matched = 0;
    for (const record of profile.votingRecord) {
      if (!record.billId) continue;
      const mine = storedChoice(record.billId);
      if (!mine || mine === "abstain") continue;
      compared += 1;
      if ((record.vote === "aye" ? "for" : "against") === mine) matched += 1;
    }
    return { compared, matched };
  }, [profile]);

  const votableBills = backendBills
    .filter((bill) => storedChoice(bill.id) == null)
    .slice(0, 4);

  // Your stored choices (device-only) against the published civic majorities,
  // constituency and national, bill by bill.
  const youVs = useMemo(() => {
    type Row = {
      billId: number;
      billTitle: string;
      mine: "for" | "against";
      localMajority: "for" | "against" | null;
      nationalMajority: "for" | "against" | null;
    };
    const rows: Row[] = [];
    const tally = {
      local: { compared: 0, matched: 0 },
      national: { compared: 0, matched: 0 }
    };
    for (const majority of majorities) {
      const mine = storedChoice(majority.billId);
      if (mine !== "for" && mine !== "against") continue;
      const callMajority = (slice: { for: number; against: number } | null) =>
        slice && slice.for !== slice.against ? (slice.for > slice.against ? "for" : "against") : null;
      const localMajority = callMajority(majority.constituency);
      const nationalMajority = callMajority(majority.national);
      if (localMajority) {
        tally.local.compared += 1;
        if (localMajority === mine) tally.local.matched += 1;
      }
      if (nationalMajority) {
        tally.national.compared += 1;
        if (nationalMajority === mine) tally.national.matched += 1;
      }
      if (localMajority || nationalMajority) {
        rows.push({ billId: majority.billId, billTitle: majority.billTitle, mine, localMajority, nationalMajority });
      }
    }
    const percent = (t: { compared: number; matched: number }) =>
      t.compared ? Math.round((t.matched / t.compared) * 100) : null;
    return {
      rows,
      localPercent: percent(tally.local),
      localCompared: tally.local.compared,
      nationalPercent: percent(tally.national),
      nationalCompared: tally.national.compared,
      disagreements: rows.filter(
        (row) =>
          (row.localMajority ?? row.nationalMajority) != null &&
          (row.localMajority ?? row.nationalMajority) !== row.mine
      )
    };
  }, [majorities]);

  const mediaExtras =
    media?.overall != null
      ? [
          {
            key: "media",
            label: "Media coverage (avg)",
            color: "#8a4f9e",
            point: media.overall
          }
        ]
      : [];

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

      <div className="dashboard-grid">
        <section
          className="panel dashboard-card clickable"
          role="button"
          tabIndex={0}
          onClick={() => onGoToTab("mymp")}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") onGoToTab("mymp");
          }}
        >
          <div className="panel-title">
            <Landmark size={18} />
            <div>
              <h3>Your MP</h3>
            </div>
          </div>
          {mp ? (
            <div className="dashboard-mp">
              {mp.thumbnailUrl ? (
                <img src={mp.thumbnailUrl} alt={mp.name} className="rep-photo" />
              ) : (
                <div className="rep-photo placeholder">
                  <UserRound size={22} />
                </div>
              )}
              <div>
                <strong>{mp.name}</strong>
                <span
                  className="party-chip"
                  style={{ background: mp.partyColour ? `#${mp.partyColour}` : "var(--muted)" }}
                >
                  {mp.party ?? "Independent"}
                </span>
                <p className="muted">
                  {personalMp && personalMp.compared > 0
                    ? `Voted like you on ${personalMp.matched} of ${personalMp.compared} bills`
                    : profile?.alignment.percent != null
                      ? `Votes with your constituency ${profile.alignment.percent}% of the time`
                      : "Vote on bills to compare your positions"}
                </p>
              </div>
            </div>
          ) : (
            <p className="muted">Loading your constituency…</p>
          )}
          <span className="dashboard-link">
            Full report <ArrowRight size={14} />
          </span>
        </section>

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
              compact
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
          <Scale size={20} />
          <div>
            <h2>How well are you represented?</h2>
            <p>
              Your questionnaire position against your MP, their party, your constituency, the
              country, and the media — plus how often you vote with each majority.
            </p>
          </div>
        </div>
        <div className="dashboard-split">
          <div className="panel">
            {profile?.compass ? (
              <CompassCompare
                compass={profile.compass}
                mpName={mp?.name ?? null}
                constituencyName={user.constituencyName ?? "Your constituency"}
                you={myCompass ? { x: myCompass.x, y: myCompass.y } : null}
                extras={mediaExtras}
              />
            ) : (
              <p className="muted">Compass comparison loads once your constituency profile is in.</p>
            )}
          </div>
          <div className="panel agreement-panel">
            <h3>You vs the majorities</h3>
            {personalMp && personalMp.compared > 0 && (
              <div className="proximity-bar">
                <span>You ↔ your MP</span>
                <div className="bar">
                  <div
                    className="fill"
                    style={{ width: `${Math.round((personalMp.matched / personalMp.compared) * 100)}%` }}
                  />
                </div>
                <strong>
                  {Math.round((personalMp.matched / personalMp.compared) * 100)}%
                  <em className="muted"> · {personalMp.compared} bills</em>
                </strong>
              </div>
            )}
            {youVs.localPercent != null && (
              <div className="proximity-bar">
                <span>You ↔ {user.constituencyName ?? "constituency"} majority</span>
                <div className="bar">
                  <div className="fill" style={{ width: `${youVs.localPercent}%` }} />
                </div>
                <strong>
                  {youVs.localPercent}%<em className="muted"> · {youVs.localCompared} bills</em>
                </strong>
              </div>
            )}
            {youVs.nationalPercent != null && (
              <div className="proximity-bar">
                <span>You ↔ country majority</span>
                <div className="bar">
                  <div className="fill" style={{ width: `${youVs.nationalPercent}%` }} />
                </div>
                <strong>
                  {youVs.nationalPercent}%<em className="muted"> · {youVs.nationalCompared} bills</em>
                </strong>
              </div>
            )}
            {youVs.localPercent == null && youVs.nationalPercent == null && (
              <p className="muted">
                Vote on a few bills and these comparisons fill in — your choices never leave this
                device, the maths happens in your browser against published aggregates.
              </p>
            )}
            {youVs.disagreements.length > 0 && (
              <>
                <h4>Where you split from the majority</h4>
                <div className="disagreement-list">
                  {youVs.disagreements.slice(0, 4).map((row) => (
                    <button
                      key={row.billId}
                      className="disagreement-row"
                      onClick={() => onOpenBill(row.billId)}
                    >
                      <strong>{row.billTitle}</strong>
                      <span>
                        You voted {row.mine},{" "}
                        {row.localMajority
                          ? `your constituency went ${row.localMajority}`
                          : `the country went ${row.nationalMajority}`}
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </section>

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
          <CompassIcon size={20} />
          <div>
            <h2>The direction of the country</h2>
            <p>
              Everything the platform measures on one compass: the public will from civic votes,
              the pull of discussion, average media influence, every major party, and the
              government with the direction its current legislation is heading.
            </p>
          </div>
        </div>
        <div className="panel">
          <NationalCompass you={myCompass ? { x: myCompass.x, y: myCompass.y } : null} />
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
