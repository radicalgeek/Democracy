import { useEffect, useState } from "react";
import { BadgeCheck, Check, HelpCircle, Loader2, ShieldCheck } from "lucide-react";
import {
  castVote,
  storedReceipt,
  verifyReceipt,
  type ReceiptVerification
} from "../lib/api";
import { HelpTrigger } from "./HelpTrigger";
import type { IntegritySnapshot, VoteChoice } from "../data/types";

type VotePanelProps = {
  integrity: IntegritySnapshot;
  selectedVote: VoteChoice | null;
  onVote: (vote: VoteChoice) => void;
  liveBillId?: number | null;
  constituencyId?: number | null;
  signedIn?: boolean;
  onRequireAccount?: () => void;
};

export function VotePanel({
  integrity,
  selectedVote,
  onVote,
  liveBillId,
  constituencyId,
  signedIn = true,
  onRequireAccount
}: VotePanelProps) {
  const [casting, setCasting] = useState(false);
  const [receipt, setReceipt] = useState<string | null>(null);
  const [castError, setCastError] = useState<string | null>(null);
  const [verification, setVerification] = useState<ReceiptVerification | null>(null);

  useEffect(() => {
    setReceipt(liveBillId ? storedReceipt(liveBillId) : null);
    setVerification(null);
    setCastError(null);
  }, [liveBillId]);

  async function handleVote(choice: VoteChoice) {
    if (!signedIn) {
      onRequireAccount?.();
      return;
    }
    onVote(choice);
    if (!liveBillId) return;

    setCasting(true);
    setCastError(null);
    const result = await castVote(liveBillId, choice, constituencyId ?? null);
    setCasting(false);
    if (result.ok) {
      setReceipt(result.receiptCode);
    } else {
      setCastError(
        result.reason === "already-issued"
          ? "You already hold a voting credential for this bill — one anonymous ballot per person."
          : result.reason
      );
    }
  }

  return (
    <section className="panel vote-panel">
      <div className="panel-title">
        <ShieldCheck size={18} />
        <div>
          <h3>Cast civic vote</h3>
          <HelpTrigger topicId="anonymous-voting" inline>
            <HelpCircle size={16} />
          </HelpTrigger>
          <p>
            {!signedIn
              ? "Create an account to cast a vote in your constituency."
              : liveBillId
                ? "Anonymous credential, private receipt, public aggregate — live."
                : "Anonymous credential, private receipt, public aggregate."}
          </p>
        </div>
      </div>
      {liveBillId != null && receipt != null && (
        <p className="vote-note">
          Your anonymous ballot on this bill is already in — one vote per person, so the buttons
          are locked. Your receipt is below.
        </p>
      )}
      <div className="vote-actions">
        {(["for", "against", "abstain"] as VoteChoice[]).map((choice) => (
          <button
            key={choice}
            disabled={casting || (liveBillId != null && receipt != null)}
            className={selectedVote === choice ? `vote-button ${choice} active` : `vote-button ${choice}`}
            onClick={() => handleVote(choice)}
          >
            {casting && selectedVote === choice ? (
              <Loader2 size={16} className="spin" />
            ) : (
              selectedVote === choice && <Check size={16} />
            )}
            {choice}
          </button>
        ))}
      </div>
      {castError && <p className="vote-error">{castError}</p>}
      {liveBillId && receipt ? (
        <div className="receipt-card">
          <span>
            Your private receipt
            <HelpTrigger topicId="vote-receipts" inline>
              <HelpCircle size={14} />
            </HelpTrigger>
          </span>
          <strong>{receipt.slice(0, 18)}...</strong>
          <p>Proves your ballot's inclusion without revealing your choice.</p>
          <button
            className="verify-button"
            onClick={async () => {
              try {
                setVerification(await verifyReceipt(receipt));
              } catch {
                setVerification({ verified: false, reason: "verification request failed" });
              }
            }}
          >
            <BadgeCheck size={15} /> Verify inclusion
          </button>
          {verification && (
            <p className={verification.verified ? "verify-ok" : "verify-fail"}>
              {verification.verified
                ? `Verified in checkpoint #${verification.checkpointId} · leaf ${verification.leafIndex} · root ${verification.merkleRoot?.slice(0, 14)}...`
                : verification.reason ?? "not verified"}
            </p>
          )}
        </div>
      ) : (
        <div className="receipt-card">
          <span>Latest checkpoint</span>
          <strong>{integrity.merkleRoot.slice(0, 18)}...</strong>
          <p>{integrity.ballots.toLocaleString()} anonymous ballots in snapshot.</p>
        </div>
      )}
    </section>
  );
}
