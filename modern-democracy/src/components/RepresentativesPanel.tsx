import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  BadgeAlert,
  ChevronRight,
  ExternalLink,
  Landmark,
  Loader2,
  ScrollText,
  Search,
  TrendingUp,
  UserRound,
  Users,
  Vote
} from "lucide-react";
import {
  fetchConstituencyElections,
  fetchMemberInterests,
  fetchParties,
  fetchRepresentativeDetail,
  fetchRepresentatives,
  type ConstituencyElection,
  type MemberInterests,
  type PartySummary,
  type RepDetail,
  type RepListMember
} from "../lib/api";

const PAGE_SIZE = 24;

function partyColour(colour: string | null | undefined) {
  return colour ? `#${colour.replace(/^#/, "")}` : "var(--muted)";
}

/** Official public page for a Commons division — ids are the Votes API's own. */
export function divisionUrl(divisionId: number) {
  return `https://votes.parliament.uk/Votes/Commons/Division/${divisionId}`;
}

type RepresentativesPanelProps = {
  /** Open this MP's profile directly (e.g. from the global search). */
  openMemberId?: number | null;
  /** Open a bill in the app when a division row is linked to one. */
  onOpenBill?: (billId: number) => void;
};

export function RepresentativesPanel({ openMemberId, onOpenBill }: RepresentativesPanelProps) {
  const [members, setMembers] = useState<RepListMember[]>([]);
  const [total, setTotal] = useState(0);
  const [parties, setParties] = useState<PartySummary[]>([]);
  const [search, setSearch] = useState("");
  const [partyFilter, setPartyFilter] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(openMemberId ?? null);

  useEffect(() => {
    if (openMemberId != null) setSelectedId(openMemberId);
  }, [openMemberId]);

  const load = useCallback(
    async (reset: boolean, currentCount: number) => {
      setLoading(true);
      try {
        const payload = await fetchRepresentatives({
          search: search || undefined,
          party: partyFilter ?? undefined,
          skip: reset ? 0 : currentCount,
          take: PAGE_SIZE
        });
        setTotal(payload.total);
        setMembers((current) => (reset ? payload.members : [...current, ...payload.members]));
      } catch {
        if (reset) setMembers([]);
      }
      setLoading(false);
    },
    [search, partyFilter]
  );

  useEffect(() => {
    const timer = setTimeout(() => load(true, 0), search ? 400 : 0);
    return () => clearTimeout(timer);
  }, [load, search]);

  useEffect(() => {
    fetchParties()
      .then((payload) => setParties(payload.parties))
      .catch(() => setParties([]));
  }, []);

  if (selectedId != null) {
    return (
      <RepresentativeDetail
        memberId={selectedId}
        onBack={() => setSelectedId(null)}
        onOpenBill={onOpenBill}
      />
    );
  }

  return (
    <>
      <section className="workspace-section">
        <div className="section-heading">
          <Users size={20} />
          <div>
            <h2>Parties in the Commons</h2>
            <p>
              Seats from live Parliament data; discipline is the share of division votes cast with
              the party's own majority.
            </p>
          </div>
        </div>
        <div className="party-strip">
          {parties.map((party) => (
            <button
              key={party.id}
              className={partyFilter === party.name ? "party-card selected" : "party-card"}
              style={{ borderTopColor: partyColour(party.colour) }}
              onClick={() => setPartyFilter(partyFilter === party.name ? null : party.name)}
            >
              <strong>{party.abbreviation ?? party.name}</strong>
              <span>{party.seats} seats</span>
              {party.discipline != null && <em>{party.discipline}% discipline</em>}
            </button>
          ))}
        </div>
      </section>

      <section className="workspace-section">
        <div className="section-heading">
          <Landmark size={20} />
          <div>
            <h2>Members of Parliament</h2>
            <p>
              {total.toLocaleString()} sitting MPs{partyFilter ? ` · ${partyFilter}` : ""} — live
              from the official Members API.
            </p>
          </div>
        </div>
        <div className="searchbox rep-search">
          <Search size={16} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name or constituency"
            aria-label="Search MPs"
          />
        </div>
        <div className="rep-grid">
          {members.map((member) => (
            <article
              key={member.id}
              className="rep-card clickable"
              role="button"
              tabIndex={0}
              style={{ borderTopColor: partyColour(member.party_colour) }}
              onClick={() => setSelectedId(member.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") setSelectedId(member.id);
              }}
            >
              {member.thumbnail_url ? (
                <img src={member.thumbnail_url} alt="" className="rep-photo" loading="lazy" />
              ) : (
                <div className="rep-photo placeholder">
                  <UserRound size={22} />
                </div>
              )}
              <strong>{member.name}</strong>
              <span
                className="party-chip"
                style={{ background: partyColour(member.party_colour) }}
              >
                {member.party ?? "Independent"}
              </span>
              <span className="muted">{member.constituency ?? "—"}</span>
            </article>
          ))}
        </div>
        {loading && (
          <p className="mp-loading">
            <Loader2 size={16} className="spin" /> Loading…
          </p>
        )}
        {!loading && members.length < total && (
          <button className="ghost load-more" onClick={() => load(false, members.length)}>
            Show more ({members.length} of {total})
          </button>
        )}
      </section>
    </>
  );
}

function RepresentativeDetail({
  memberId,
  onBack,
  onOpenBill
}: {
  memberId: number;
  onBack: () => void;
  onOpenBill?: (billId: number) => void;
}) {
  const [detail, setDetail] = useState<RepDetail | null>(null);
  const [elections, setElections] = useState<ConstituencyElection[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let mounted = true;
    setDetail(null);
    setElections(null);
    fetchRepresentativeDetail(memberId)
      .then((payload) => {
        if (!mounted) return;
        setDetail(payload);
        if (payload.member.constituencyId) {
          fetchConstituencyElections(payload.member.constituencyId)
            .then((result) => mounted && setElections(result.elections))
            .catch(() => mounted && setElections([]));
        } else {
          setElections([]);
        }
      })
      .catch(() => mounted && setFailed(true));
    return () => {
      mounted = false;
    };
  }, [memberId]);

  if (failed) {
    return (
      <section className="workspace-section">
        <button className="ghost" onClick={onBack}>
          <ArrowLeft size={15} /> All MPs
        </button>
        <p className="muted">Could not load this MP right now.</p>
      </section>
    );
  }

  if (!detail) {
    return (
      <section className="workspace-section mp-loading">
        <Loader2 size={18} className="spin" /> Loading MP profile…
      </section>
    );
  }

  const { member, stats, latestElection, biography, votingRecord } = detail;
  const candidates = (latestElection?.candidates ?? [])
    .slice()
    .sort((a, b) => b.votes - a.votes)
    .slice(0, 6);
  const posts = [
    ...(biography?.governmentPosts ?? []).map((post) => ({ ...post, kind: "Government" })),
    ...(biography?.oppositionPosts ?? []).map((post) => ({ ...post, kind: "Opposition" }))
  ]
    .sort((a, b) => (b.startDate ?? "").localeCompare(a.startDate ?? ""))
    .slice(0, 6);
  const seatHistory = (biography?.representations ?? []).slice(0, 8);

  return (
    <>
      <section className="workspace-section">
        <button className="ghost" onClick={onBack}>
          <ArrowLeft size={15} /> All MPs
        </button>
        <div
          className="mp-card panel"
          style={{ borderTopColor: partyColour(member.partyColour), marginTop: 12 }}
        >
          {member.thumbnailUrl ? (
            <img src={member.thumbnailUrl} alt={member.name} className="mp-photo" />
          ) : (
            <div className="mp-photo placeholder">
              <UserRound size={28} />
            </div>
          )}
          <div className="mp-card-body">
            <h3>{member.name}</h3>
            <p>
              <span className="party-chip" style={{ background: partyColour(member.partyColour) }}>
                {member.party ?? "Independent"}
              </span>{" "}
              {member.constituency ?? ""}
              {member.memberSince && ` · MP since ${new Date(member.memberSince).getFullYear()}`}
            </p>
          </div>
          <div className="mp-scores">
            <div className="mp-score">
              <span>Divisions voted</span>
              <strong>{stats.divisionsVoted}</strong>
              <em>in the imported window</em>
            </div>
            <div className="mp-score">
              <span>With their party</span>
              <strong>{stats.partyLinePercent != null ? `${stats.partyLinePercent}%` : "—"}</strong>
              <em>
                {stats.rebellions} rebellion{stats.rebellions === 1 ? "" : "s"}
              </em>
            </div>
          </div>
        </div>
        {member.synopsis && <p className="rep-synopsis">{member.synopsis}</p>}
      </section>

      {(posts.length > 0 || seatHistory.length > 0) && (
        <div className="petition-grid">
          {posts.length > 0 && (
            <section className="panel">
              <h3>
                <BadgeAlert size={16} /> Posts held
              </h3>
              <ul className="plain-list">
                {posts.map((post) => (
                  <li key={`${post.kind}-${post.name}-${post.startDate}`}>
                    <strong>{post.name}</strong>
                    <span className="muted">
                      {" "}
                      {post.kind} · {post.startDate?.slice(0, 4)}
                      {post.endDate ? `–${post.endDate.slice(0, 4)}` : "–present"}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {seatHistory.length > 0 && (
            <section className="panel">
              <h3>
                <Landmark size={16} /> Seats held
              </h3>
              <ul className="plain-list">
                {seatHistory.map((seat) => (
                  <li key={`${seat.name}-${seat.startDate}`}>
                    <strong>{seat.name}</strong>
                    <span className="muted">
                      {" "}
                      {seat.startDate?.slice(0, 4)}
                      {seat.endDate ? `–${seat.endDate.slice(0, 4)}` : "–present"}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}

      {candidates.length > 0 && (
        <section className="workspace-section">
          <div className="section-heading">
            <Vote size={20} />
            <div>
              <h2>Last election in {member.constituency}</h2>
              <p>
                {latestElection?.electionDate?.slice(0, 10)} · majority{" "}
                {latestElection?.majority?.toLocaleString()} · turnout{" "}
                {latestElection?.turnout?.toLocaleString()} of{" "}
                {latestElection?.electorate?.toLocaleString()} electors
              </p>
            </div>
          </div>
          <div className="election-bars">
            {candidates.map((candidate) => (
              <div key={candidate.name} className="election-bar">
                <span className="candidate">
                  {candidate.name}
                  <em>{candidate.party?.name ?? "Independent"}</em>
                </span>
                <div className="bar">
                  <div
                    className="fill"
                    style={{
                      width: `${Math.round(candidate.voteShare * 100)}%`,
                      background: partyColour(candidate.party?.backgroundColour)
                    }}
                  />
                </div>
                <strong>{Math.round(candidate.voteShare * 1000) / 10}%</strong>
              </div>
            ))}
          </div>
        </section>
      )}

      {elections && elections.length > 0 && (
        <section className="workspace-section">
          <div className="section-heading">
            <TrendingUp size={20} />
            <div>
              <h2>{member.constituency} over time</h2>
              <p>General and by-election winners, merged across boundary changes.</p>
            </div>
          </div>
          <div className="election-timeline">
            {elections.map((election) => (
              <article key={election.electionDate} className="timeline-row">
                <span className="timeline-date">{election.electionDate?.slice(0, 10)}</span>
                <span
                  className="party-chip"
                  style={{ background: partyColour(election.winningParty?.backgroundColour) }}
                >
                  {election.winningParty?.name ?? "—"}
                </span>
                <span className="muted">
                  {election.electionTitle} · {election.result}
                  {election.majority != null && ` · majority ${election.majority.toLocaleString()}`}
                </span>
              </article>
            ))}
          </div>
        </section>
      )}

      <InterestsSection memberId={memberId} memberName={member.name} />

      <section className="workspace-section">
        <div className="section-heading">
          <ScrollText size={20} />
          <div>
            <h2>Recent votes in the Commons</h2>
            <p>Live from the official Commons Votes API; rebellions marked against party majority.</p>
          </div>
        </div>
        <div className="division-list">
          {votingRecord.map((record) => (
            <article
              className={record.billId && onOpenBill ? "division-row clickable" : "division-row"}
              key={record.divisionId}
              role={record.billId && onOpenBill ? "button" : undefined}
              tabIndex={record.billId && onOpenBill ? 0 : undefined}
              onClick={() => record.billId && onOpenBill?.(record.billId)}
              onKeyDown={(event) => {
                if ((event.key === "Enter" || event.key === " ") && record.billId) {
                  onOpenBill?.(record.billId);
                }
              }}
            >
              <div>
                <strong>{record.title}</strong>
                <span className="muted">
                  {new Date(record.date).toLocaleDateString("en-GB")} · Ayes {record.ayeCount} ·
                  Noes {record.noCount}
                  {record.rebelled && " · rebelled against party majority"}
                  {record.billId && onOpenBill && " · view the bill"}
                </span>
              </div>
              <span className={`division-vote ${record.vote}${record.rebelled ? " rebelled" : ""}`}>
                {record.vote === "aye" ? "Aye" : "No"}
              </span>
              <a
                className="division-link"
                href={divisionUrl(record.divisionId)}
                target="_blank"
                rel="noreferrer"
                aria-label="Open this division on votes.parliament.uk"
                title="Open on votes.parliament.uk"
                onClick={(event) => event.stopPropagation()}
              >
                <ExternalLink size={14} />
              </a>
            </article>
          ))}
          {votingRecord.length === 0 && (
            <p className="muted">No recorded divisions in the imported window.</p>
          )}
        </div>
      </section>
    </>
  );
}

/**
 * Register of Members' Financial Interests, live from the official Interests
 * API — grouped by category, collapsed by default, with a link to the full
 * register entry.
 */
function InterestsSection({ memberId, memberName }: { memberId: number; memberName: string }) {
  const [interests, setInterests] = useState<MemberInterests | null>(null);
  const [failed, setFailed] = useState(false);
  const [openCategory, setOpenCategory] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setInterests(null);
    setFailed(false);
    fetchMemberInterests(memberId)
      .then((payload) => mounted && setInterests(payload))
      .catch(() => mounted && setFailed(true));
    return () => {
      mounted = false;
    };
  }, [memberId]);

  if (failed) return null;

  return (
    <section className="workspace-section">
      <div className="section-heading">
        <BadgeAlert size={20} />
        <div>
          <h2>Register of financial interests</h2>
          <p>
            {interests
              ? interests.total === 0
                ? `${memberName} has no current entries in the register.`
                : `${interests.total} declared interest${interests.total === 1 ? "" : "s"} — official register, self-reported.`
              : "Loading the official register…"}
          </p>
        </div>
      </div>
      {interests && interests.categories.length > 0 && (
        <div className="drill-list">
          {interests.categories.map((category) => {
            const open = openCategory === category.name;
            return (
              <article className={open ? "drill open" : "drill"} key={category.name}>
                <button
                  type="button"
                  className="drill-summary"
                  aria-expanded={open}
                  onClick={() => setOpenCategory(open ? null : category.name)}
                >
                  <span className="drill-copy">
                    <strong>{category.name}</strong>
                    <small>
                      {category.interests.length} entr{category.interests.length === 1 ? "y" : "ies"}
                    </small>
                  </span>
                  <ChevronRight size={15} className="drill-chevron" />
                </button>
                {open && (
                  <div className="drill-body">
                    <ul className="interest-list">
                      {category.interests.map((interest) => (
                        <li key={interest.id}>
                          {interest.summary}
                          {interest.registered && (
                            <em>
                              {" "}
                              · registered{" "}
                              {new Date(interest.registered).toLocaleDateString("en-GB")}
                            </em>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
      {interests && (
        <a className="civic-source-link" href={interests.registerUrl} target="_blank" rel="noreferrer">
          Full register entry on parliament.uk <ChevronRight size={14} />
        </a>
      )}
    </section>
  );
}
