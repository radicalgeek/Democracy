import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Check, Compass as CompassIcon, Landmark, Loader2, Vote, X } from "lucide-react";
import type { VoteChoice } from "../data/types";
import { Compass } from "./Compass";
import {
  castVote,
  fetchBackendBills,
  fetchBillDetail,
  fetchConstituencyProfile,
  storedChoice,
  type AccountUser,
  type BackendBillDetail
} from "../lib/api";

export const MY_COMPASS_KEY = "democracy.myCompass";
export const ONBOARDED_KEY = "democracy.onboarded";

export function storedMyCompass(): { x: number; y: number } | null {
  try {
    const raw = localStorage.getItem(MY_COMPASS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { x?: number; y?: number };
    return typeof parsed.x === "number" && typeof parsed.y === "number"
      ? { x: parsed.x, y: parsed.y }
      : null;
  } catch {
    return null;
  }
}

/**
 * Six-statement questionnaire. Each statement loads on one axis:
 * econ x (-left/+right) or social y (-libertarian/+authoritarian).
 */
const STATEMENTS: Array<{ text: string; axis: "x" | "y"; direction: 1 | -1 }> = [
  {
    text: "Government should redistribute wealth from the richest to the poorest.",
    axis: "x",
    direction: -1
  },
  {
    text: "Private companies generally run services better than the state.",
    axis: "x",
    direction: 1
  },
  {
    text: "The state should be able to monitor online communications to keep people safe.",
    axis: "y",
    direction: 1
  },
  {
    text: "Adults should be free to make risky choices about their own lives without state interference.",
    axis: "y",
    direction: -1
  },
  {
    text: "Higher taxes on large businesses are good for society overall.",
    axis: "x",
    direction: -1
  },
  {
    text: "Respect for authority is something every child should learn.",
    axis: "y",
    direction: 1
  }
];

const SCALE: Array<{ label: string; short: string; value: number }> = [
  { label: "Strongly disagree", short: "−−", value: -2 },
  { label: "Disagree", short: "−", value: -1 },
  { label: "Neutral", short: "0", value: 0 },
  { label: "Agree", short: "+", value: 1 },
  { label: "Strongly agree", short: "++", value: 2 }
];

type Step = "intro" | "vote" | "quiz" | "result";

type OnboardingProps = {
  user: AccountUser;
  onClose: () => void;
  onGoToMyMP: () => void;
};

export function Onboarding({ user, onClose, onGoToMyMP }: OnboardingProps) {
  const [step, setStep] = useState<Step>("intro");
  const [bills, setBills] = useState<BackendBillDetail[]>([]);
  const [loadingBills, setLoadingBills] = useState(false);
  const [votes, setVotes] = useState<Record<number, VoteChoice>>({});
  const [casting, setCasting] = useState<number | null>(null);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [mpResult, setMpResult] = useState<{ compared: number; matched: number; mpName: string | null } | null>(null);

  useEffect(() => {
    if (step !== "vote" || bills.length > 0) return;
    let mounted = true;
    setLoadingBills(true);
    (async () => {
      try {
        const list = await fetchBackendBills(20);
        const interesting = [
          ...list.bills.filter((b) => b.ballots > 0),
          ...list.bills.filter((b) => b.ballots === 0 && b.has_text)
        ].slice(0, 3);
        const details: BackendBillDetail[] = [];
        for (const bill of interesting) {
          try {
            details.push(await fetchBillDetail(bill.id));
          } catch {
            // skip bills whose detail fails
          }
        }
        if (mounted) setBills(details);
      } finally {
        if (mounted) setLoadingBills(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [step, bills.length]);

  const myCompass = useMemo(() => {
    if (Object.keys(answers).length < STATEMENTS.length) return null;
    let x = 0;
    let y = 0;
    let xWeight = 0;
    let yWeight = 0;
    STATEMENTS.forEach((statement, index) => {
      const value = (answers[index] ?? 0) * statement.direction;
      if (statement.axis === "x") {
        x += value;
        xWeight += 2;
      } else {
        y += value;
        yWeight += 2;
      }
    });
    return {
      x: Math.round((x / xWeight) * 100) / 10,
      y: Math.round((y / yWeight) * 100) / 10
    };
  }, [answers]);

  async function handleBillVote(billId: number, choice: VoteChoice) {
    setCasting(billId);
    const result = await castVote(billId, choice, user.constituencyId);
    if (result.ok || result.reason.includes("already")) {
      setVotes((current) => ({ ...current, [billId]: choice }));
    }
    setCasting(null);
  }

  async function finishQuiz() {
    if (myCompass) {
      localStorage.setItem(MY_COMPASS_KEY, JSON.stringify({ ...myCompass, answeredAt: new Date().toISOString() }));
    }
    setStep("result");
    if (user.constituencyId) {
      try {
        const profile = await fetchConstituencyProfile(user.constituencyId);
        let compared = 0;
        let matched = 0;
        for (const record of profile.votingRecord) {
          if (!record.billId) continue;
          const mine = storedChoice(record.billId);
          if (!mine || mine === "abstain") continue;
          compared += 1;
          if ((record.vote === "aye" ? "for" : "against") === mine) matched += 1;
        }
        setMpResult({ compared, matched, mpName: profile.mp?.name ?? null });
      } catch {
        setMpResult(null);
      }
    }
  }

  function close() {
    localStorage.setItem(ONBOARDED_KEY, "1");
    onClose();
  }

  return (
    <div className="onboarding-overlay" role="dialog" aria-modal="true">
      <div className="onboarding-modal panel">
        <button className="onboarding-close" onClick={close} aria-label="Close">
          <X size={18} />
        </button>

        {step === "intro" && (
          <div className="onboarding-step">
            <CompassIcon size={32} />
            <h2>Find your place on the map</h2>
            <p>
              Two minutes, three parts: cast real votes on a few current bills, answer six quick
              questions to place yourself on the political compass, and see how your MP measures up
              against you.
            </p>
            <p className="muted">
              Your compass position is stored only on this device. Your bill votes are cast as
              anonymous ballots — like any other vote on the platform.
            </p>
            <div className="onboarding-actions">
              <button className="primary" onClick={() => setStep("vote")}>
                Start <ArrowRight size={16} />
              </button>
              <button className="ghost" onClick={close}>
                Maybe later
              </button>
            </div>
          </div>
        )}

        {step === "vote" && (
          <div className="onboarding-step">
            <Vote size={28} />
            <h2>Vote on what Parliament is voting on</h2>
            {loadingBills && (
              <p className="muted">
                <Loader2 size={14} className="spin" /> Fetching current bills…
              </p>
            )}
            <div className="onboarding-bills">
              {bills.map((detail) => {
                const summary = detail.analyses.find((a) => a.kind === "summary")?.output as
                  | { summary?: string }
                  | undefined;
                return (
                  <article key={detail.bill.id} className="onboarding-bill">
                    <strong>{detail.bill.short_title}</strong>
                    <p>{summary?.summary ?? detail.bill.long_title ?? ""}</p>
                    <div className="vote-actions">
                      {(["for", "against", "abstain"] as VoteChoice[]).map((choice) => (
                        <button
                          key={choice}
                          disabled={casting === detail.bill.id || votes[detail.bill.id] != null}
                          className={
                            votes[detail.bill.id] === choice
                              ? `vote-button ${choice} active`
                              : `vote-button ${choice}`
                          }
                          onClick={() => handleBillVote(detail.bill.id, choice)}
                        >
                          {votes[detail.bill.id] === choice && <Check size={14} />}
                          {choice}
                        </button>
                      ))}
                    </div>
                  </article>
                );
              })}
            </div>
            <div className="onboarding-actions">
              <button className="primary" onClick={() => setStep("quiz")}>
                {Object.keys(votes).length > 0 ? "Next: the compass" : "Skip voting for now"}{" "}
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {step === "quiz" && (
          <div className="onboarding-step">
            <CompassIcon size={28} />
            <h2>Where do you stand?</h2>
            <p className="muted">Six statements — how strongly do you agree?</p>
            <div className="quiz-list">
              {STATEMENTS.map((statement, index) => (
                <div key={statement.text} className="quiz-item">
                  <p>{statement.text}</p>
                  <div className="quiz-scale">
                    {SCALE.map((option) => (
                      <button
                        key={option.value}
                        className={answers[index] === option.value ? "selected" : ""}
                        title={option.label}
                        aria-label={option.label}
                        onClick={() =>
                          setAnswers((current) => ({ ...current, [index]: option.value }))
                        }
                      >
                        {option.short}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="onboarding-actions">
              <button
                className="primary"
                disabled={Object.keys(answers).length < STATEMENTS.length}
                onClick={finishQuiz}
              >
                See my results <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {step === "result" && (
          <div className="onboarding-step">
            <Landmark size={28} />
            <h2>Your political position</h2>
            {myCompass && (
              <Compass
                point={{
                  x: myCompass.x / 10,
                  y: myCompass.y / 10,
                  label: "You",
                  confidence: 1,
                  rationale: ""
                }}
              />
            )}
            {mpResult && mpResult.compared > 0 ? (
              <p>
                {mpResult.mpName ?? "Your MP"} voted the same way as you on{" "}
                <strong>
                  {mpResult.matched} of {mpResult.compared}
                </strong>{" "}
                bills you've both voted on so far.
              </p>
            ) : (
              <p className="muted">
                As you vote on bills your MP has divided on, we'll show how often they vote like you
                — entirely computed on your device.
              </p>
            )}
            <p className="muted">
              Your position now appears on the My MP compass next to your MP, their party, your
              constituency, and the country.
            </p>
            <div className="onboarding-actions">
              <button
                className="primary"
                onClick={() => {
                  close();
                  onGoToMyMP();
                }}
              >
                Open My MP <ArrowRight size={16} />
              </button>
              <button className="ghost" onClick={close}>
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
