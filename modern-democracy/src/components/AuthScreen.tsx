import { useEffect, useState } from "react";
import { ArrowLeft, BadgeCheck, Loader2, MapPin, ShieldCheck } from "lucide-react";
import {
  loginAccount,
  lookupPostcode,
  registerAccount,
  submitIdentityCheck,
  type AccountUser
} from "../lib/api";

export type AuthMode = "signup" | "login" | "verify";

type AuthScreenProps = {
  mode: AuthMode;
  user: AccountUser | null;
  onAuthed: (user: AccountUser) => void;
  onSwitchMode: (mode: AuthMode) => void;
  onBack: () => void;
};

export function AuthScreen({ mode, user, onAuthed, onSwitchMode, onBack }: AuthScreenProps) {
  return (
    <div className="auth-screen">
      <header className="landing-top">
        <div className="brand">
          <div className="brand-mark">D</div>
          <div>
            <strong>Democracy</strong>
            <span>The dashboard of democracy</span>
          </div>
        </div>
        <button className="ghost" onClick={onBack}>
          <ArrowLeft size={16} /> Back
        </button>
      </header>
      <div className="auth-card panel">
        {mode === "signup" && <SignupForm onAuthed={onAuthed} onSwitchMode={onSwitchMode} />}
        {mode === "login" && <LoginForm onAuthed={onAuthed} onSwitchMode={onSwitchMode} />}
        {mode === "verify" && <VerifyForm user={user} onAuthed={onAuthed} onSkip={onBack} />}
      </div>
    </div>
  );
}

function SignupForm({
  onAuthed,
  onSwitchMode
}: {
  onAuthed: (user: AccountUser) => void;
  onSwitchMode: (mode: AuthMode) => void;
}) {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [postcode, setPostcode] = useState("");
  const [constituency, setConstituency] = useState<string | null>(null);
  const [lookupState, setLookupState] = useState<"idle" | "checking" | "ok" | "error">("idle");
  const [lookupMessage, setLookupMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const cleaned = postcode.replace(/\s+/g, "");
    if (cleaned.length < 5) {
      setLookupState("idle");
      setConstituency(null);
      return;
    }
    const timer = setTimeout(async () => {
      setLookupState("checking");
      const result = await lookupPostcode(postcode);
      if ("error" in result) {
        setLookupState("error");
        setConstituency(null);
        setLookupMessage(
          result.error === "postcode-not-found"
            ? "Postcode not found."
            : result.error === "invalid-postcode"
              ? "That doesn't look like a UK postcode."
              : "Could not check that postcode right now."
        );
      } else {
        setLookupState("ok");
        setConstituency(result.constituencyName);
        setLookupMessage(null);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [postcode]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const user = await registerAccount({ email, password, displayName, postcode });
      onAuthed(user);
    } catch (err) {
      const message = err instanceof Error ? err.message : "registration failed";
      setError(
        message === "email-taken"
          ? "An account with that email already exists — try signing in."
          : message === "password-too-short"
            ? "Password must be at least 8 characters."
            : message
      );
    }
    setSubmitting(false);
  }

  return (
    <form onSubmit={handleSubmit}>
      <h2>Create your account</h2>
      <p className="muted">
        Your postcode places your vote in your constituency. Your name appears only on debate posts
        — never on ballots, which are recorded anonymously.
      </p>
      <label>
        Display name
        <input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="How you'll appear in debates"
          required
        />
      </label>
      <label>
        Email
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          required
        />
      </label>
      <label>
        Password
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="At least 8 characters"
          minLength={8}
          required
        />
      </label>
      <label>
        Postcode
        <input
          value={postcode}
          onChange={(e) => setPostcode(e.target.value)}
          placeholder="e.g. SW1A 1AA"
          required
        />
      </label>
      <p className={`postcode-status ${lookupState}`}>
        {lookupState === "checking" && (
          <>
            <Loader2 size={14} className="spin" /> Checking postcode…
          </>
        )}
        {lookupState === "ok" && constituency && (
          <>
            <MapPin size={14} /> Your constituency: <strong>{constituency}</strong>
          </>
        )}
        {lookupState === "error" && lookupMessage}
      </p>
      {error && <p className="form-error">{error}</p>}
      <button className="primary" type="submit" disabled={submitting || lookupState !== "ok"}>
        {submitting ? <Loader2 size={16} className="spin" /> : null} Create account
      </button>
      <p className="auth-switch">
        Already have an account?{" "}
        <button type="button" onClick={() => onSwitchMode("login")}>
          Sign in
        </button>
      </p>
    </form>
  );
}

function LoginForm({
  onAuthed,
  onSwitchMode
}: {
  onAuthed: (user: AccountUser) => void;
  onSwitchMode: (mode: AuthMode) => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const user = await loginAccount({ email, password });
      onAuthed(user);
    } catch {
      setError("Email or password is incorrect.");
    }
    setSubmitting(false);
  }

  return (
    <form onSubmit={handleSubmit}>
      <h2>Sign in</h2>
      <label>
        Email
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </label>
      <label>
        Password
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </label>
      {error && <p className="form-error">{error}</p>}
      <button className="primary" type="submit" disabled={submitting}>
        {submitting ? <Loader2 size={16} className="spin" /> : null} Sign in
      </button>
      <p className="auth-switch">
        New here?{" "}
        <button type="button" onClick={() => onSwitchMode("signup")}>
          Create an account
        </button>
      </p>
    </form>
  );
}

function VerifyForm({
  user,
  onAuthed,
  onSkip
}: {
  user: AccountUser | null;
  onAuthed: (user: AccountUser) => void;
  onSkip: () => void;
}) {
  const [fullName, setFullName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [postcode, setPostcode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (user?.verificationTier === 2 || done) {
    return (
      <div className="verify-done">
        <BadgeCheck size={36} />
        <h2>You're verified</h2>
        <p className="muted">
          Your account is identity-verified. Your votes carry full weight in constituency and
          national results.
        </p>
        <button className="primary" onClick={onSkip}>
          Continue to the app
        </button>
      </div>
    );
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const result = await submitIdentityCheck({ fullName, dateOfBirth, addressLine1, postcode });
      if (result.verified && result.user) {
        setDone(true);
        onAuthed(result.user);
      } else {
        setError(result.reason ?? "Verification failed.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed.");
    }
    setSubmitting(false);
  }

  return (
    <form onSubmit={handleSubmit}>
      <h2>
        <ShieldCheck size={20} /> Verify your identity
      </h2>
      <p className="muted">
        A one-time check that you're a real person at a real UK address. We store the result — your
        name, date of birth, and address are checked, not retained. Verified accounts make the
        results credible.
      </p>
      <label>
        Full legal name
        <input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
      </label>
      <label>
        Date of birth
        <input
          type="date"
          value={dateOfBirth}
          onChange={(e) => setDateOfBirth(e.target.value)}
          required
        />
      </label>
      <label>
        Address line 1
        <input
          value={addressLine1}
          onChange={(e) => setAddressLine1(e.target.value)}
          placeholder="House number and street"
          required
        />
      </label>
      <label>
        Postcode
        <input value={postcode} onChange={(e) => setPostcode(e.target.value)} required />
      </label>
      {error && <p className="form-error">{error}</p>}
      <button className="primary" type="submit" disabled={submitting}>
        {submitting ? (
          <>
            <Loader2 size={16} className="spin" /> Checking…
          </>
        ) : (
          "Verify identity"
        )}
      </button>
      <p className="auth-switch">
        <button type="button" onClick={onSkip}>
          Skip for now — you can verify later from My Voice
        </button>
      </p>
    </form>
  );
}
