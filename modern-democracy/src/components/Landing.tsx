import {
  BarChart3,
  CheckCircle2,
  Landmark,
  LockKeyhole,
  MapPin,
  MessageSquare,
  ScrollText,
  ShieldCheck,
  Vote
} from "lucide-react";

type LandingProps = {
  onCreateAccount: () => void;
  onSignIn: () => void;
  onExplore: () => void;
};

export function Landing({ onCreateAccount, onSignIn, onExplore }: LandingProps) {
  return (
    <div className="landing">
      <header className="landing-top">
        <div className="brand">
          <div className="brand-mark">D</div>
          <div>
            <strong>Democracy</strong>
            <span>Represent yourself</span>
          </div>
        </div>
        <div className="landing-top-actions">
          <button className="ghost" onClick={onSignIn}>
            Sign in
          </button>
          <button className="primary" onClick={onCreateAccount}>
            Create account
          </button>
        </div>
      </header>

      <section className="landing-hero">
        <h1>
          Parliament votes on your behalf.
          <br />
          Now you can vote too — and see the gap.
        </h1>
        <p>
          Democracy lets you cast your own vote on the same bills MPs debate in Westminster,
          deliberate with other citizens, and compare what your constituency thinks with how your MP
          actually votes.
        </p>
        <div className="landing-cta">
          <button className="primary" onClick={onCreateAccount}>
            <Vote size={18} /> Create your account
          </button>
          <button className="ghost" onClick={onExplore}>
            Explore first, sign up later
          </button>
        </div>
        <p className="landing-disclaimer">
          Democracy is an independent civic platform. Votes here are public opinion — they are not
          official electoral votes and have no legal effect. We exist to make the will of
          constituents visible, not to replace the ballot box.
        </p>
      </section>

      <section className="landing-grid">
        <article>
          <ScrollText size={20} />
          <h3>Real parliamentary business</h3>
          <p>
            Bills, stages, MPs, and constituencies come live from the official UK Parliament APIs.
            Plain-English AI summaries explain what each bill actually does, with sources cited.
          </p>
        </article>
        <article>
          <MapPin size={20} />
          <h3>Your postcode, your constituency</h3>
          <p>
            Sign up with your postcode and your votes count toward your constituency. The map shows
            how every part of the country leans — and where MPs diverge from the people they
            represent.
          </p>
        </article>
        <article>
          <LockKeyhole size={20} />
          <h3>Anonymous, verifiable voting</h3>
          <p>
            Your ballot is recorded anonymously — separated from your identity at the moment it is
            cast — and you get a private receipt that cryptographically proves your vote was counted
            without revealing what it was.
          </p>
        </article>
        <article>
          <ShieldCheck size={20} />
          <h3>Verified voters carry weight</h3>
          <p>
            Anyone can sign up and take part. Verify your identity to strengthen the count — verified
            accounts are how we keep results credible and resistant to manipulation.
          </p>
        </article>
        <article>
          <MessageSquare size={20} />
          <h3>Debate that stays civil</h3>
          <p>
            Heated, legitimate political argument is protected. Personal attacks and trolling earn
            escalating temporary bans, applied by transparent moderation with a public audit trail.
          </p>
        </article>
        <article>
          <BarChart3 size={20} />
          <h3>Everything auditable</h3>
          <p>
            Aggregate results, data freshness, AI methodology, and moderation decisions are all
            published. If we show a number, you can check where it came from.
          </p>
        </article>
      </section>

      <section className="landing-how">
        <h2>How it works</h2>
        <ol>
          <li>
            <strong>Sign up with your postcode.</strong> We resolve it to your parliamentary
            constituency — that's the only location information we keep.
          </li>
          <li>
            <strong>Verify your identity (optional, recommended).</strong> A one-time check confirms
            you're a real person at a real UK address. We store the result, never the documents.
          </li>
          <li>
            <strong>Read, debate, and vote.</strong> Each bill gets one vote per person — for,
            against, or abstain — recorded anonymously with a private receipt.
          </li>
          <li>
            <strong>Hold power to account.</strong> Watch how your MP votes next to how your
            constituency voted, on every bill, in public.
          </li>
        </ol>
        <div className="landing-cta">
          <button className="primary" onClick={onCreateAccount}>
            <CheckCircle2 size={18} /> Get started
          </button>
          <button className="ghost" onClick={onSignIn}>
            I already have an account
          </button>
        </div>
      </section>

      <footer className="landing-footer">
        <Landmark size={16} />
        <span>
          Built on official UK Parliament data. Not affiliated with the UK Parliament or any
          political party.
        </span>
      </footer>
    </div>
  );
}
