import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BadgeCheck,
  Compass as CompassIcon,
  FileText,
  Landmark,
  ScrollText,
  ShieldCheck,
  UserRound,
  Vote
} from "lucide-react";
import { Compass } from "./Compass";
import { storedMyCompass } from "./Onboarding";
import {
  fetchConstituencyProfile,
  fetchPetitions,
  storedChoice,
  type AccountUser,
  type BackendBill,
  type BackendPetition,
  type ConstituencyProfile
} from "../lib/api";

type DashboardProps = {
  user: AccountUser | null;
  backendBills: BackendBill[];
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
  onOpenBill,
  onOpenPetition,
  onGoToTab,
  onRequireAccount,
  onVerify,
  onStartTour
}: DashboardProps) {
  const [profile, setProfile] = useState<ConstituencyProfile | null>(null);
  const [petitions, setPetitions] = useState<BackendPetition[]>([]);

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
    return () => {
      mounted = false;
    };
  }, [user?.constituencyId]);

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

  if (!user) {
    return (
      <section className="workspace-section dashboard-welcome">
        <h1>Welcome to Democracy</h1>
        <p className="muted">
          You're exploring without an account. Create one with your postcode to get a personal
          dashboard: your MP, your constituency, your compass position, and your voting record.
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
