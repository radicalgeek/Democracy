import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  BadgeAlert,
  Banknote,
  Building2,
  ChevronRight,
  Compass as CompassIcon,
  ExternalLink,
  HandCoins,
  Landmark,
  Loader2,
  ReceiptText,
  Scale,
  ScrollText,
  Search,
  ShieldQuestion,
  TrendingUp,
  UserRound,
  Users,
  Vote
} from "lucide-react";
import { Compass } from "./Compass";
import { formatCompassPoint } from "../lib/compassLabel";
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

/** IPSA's per-MP costs page slug: honorifics stripped, name kebab-cased. */
function ipsaSlug(name: string) {
  return name
    .replace(/\b(Rt Hon|Sir|Dame|Dr|Mr|Mrs|Ms|MP)\b\.?/g, " ")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
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
  const [selectedParty, setSelectedParty] = useState<PartySummary | null>(null);
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
              onClick={() => {
                const next = partyFilter === party.name ? null : party.name;
                setPartyFilter(next);
                setSelectedParty(next ? party : null);
              }}
            >
              <strong>{party.abbreviation ?? party.name}</strong>
              <span>{party.seats} seats</span>
              {party.discipline != null && <em>{party.discipline}% discipline</em>}
              {party.compass && (
                <small className="party-compass">
                  {formatCompassPoint(party.compass.x, party.compass.y)}
                </small>
              )}
            </button>
          ))}
        </div>
        {selectedParty && <PartyInfluencePanel party={selectedParty} />}
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
              {member.compass_x != null && member.compass_y != null && (
                <span
                  className="rep-compass-chip"
                  title={`Revealed preference from ${member.compass_sample} division vote${member.compass_sample === 1 ? "" : "s"} on compass-scored bills`}
                >
                  {formatCompassPoint(member.compass_x, member.compass_y)}
                </span>
              )}
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
  const [interests, setInterests] = useState<MemberInterests | null>(null);
  const [interestsFailed, setInterestsFailed] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let mounted = true;
    setDetail(null);
    setElections(null);
    setInterests(null);
    setInterestsFailed(false);
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
        fetchMemberInterests(memberId)
          .then((result) => mounted && setInterests(result))
          .catch(() => mounted && setInterestsFailed(true));
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

  const { member, stats, latestElection, biography, votingRecord, compass, partyCompass } = detail;
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

      <InfluenceSummary
        member={member}
        stats={stats}
        compass={compass}
        partyCompass={detail.partyCompass}
        interests={interests}
        interestsFailed={interestsFailed}
      />

      <div className="petition-grid">
        <section className="panel">
          <h3>
            <CompassIcon size={16} /> Political position
          </h3>
          {compass ? (
            <>
              <Compass
                compact
                point={{
                  x: compass.x / 10,
                  y: compass.y / 10,
                  label: member.name,
                  confidence: 1,
                  rationale: ""
                }}
              />
              <p className="muted">
                {formatCompassPoint(compass.x, compass.y)} — revealed preference from{" "}
                {compass.sample} division vote{compass.sample === 1 ? "" : "s"} on compass-scored
                bills, not a self-description.
              </p>
            </>
          ) : partyCompass ? (
            <>
              <Compass
                compact
                point={{
                  x: partyCompass.x / 10,
                  y: partyCompass.y / 10,
                  label: member.party ?? "Party",
                  confidence: 1,
                  rationale: ""
                }}
              />
              <p className="muted">
                {formatCompassPoint(partyCompass.x, partyCompass.y)} — {member.party ?? "party"}{" "}
                position shown as a proxy: this MP has no division votes on compass-scored bills
                yet.
              </p>
            </>
          ) : (
            <p className="muted">
              No position yet — it appears once this MP has voted in divisions on compass-scored
              bills.
            </p>
          )}
        </section>
        <section className="panel">
          <h3>
            <ReceiptText size={16} /> Staffing and business costs
          </h3>
          <p className="muted">
            Every MP's office, staffing, travel and accommodation claims are published by IPSA, the
            independent expenses regulator.
          </p>
          <a
            className="civic-source-link"
            href={`https://www.theipsa.org.uk/mp-staffing-business-costs/your-mp/${ipsaSlug(member.name)}`}
            target="_blank"
            rel="noreferrer"
          >
            {member.name}'s published costs on theipsa.org.uk <ChevronRight size={14} />
          </a>
          <a
            className="civic-source-link"
            href="https://www.theipsa.org.uk/mp-staffing-business-costs/annual-publications"
            target="_blank"
            rel="noreferrer"
          >
            IPSA annual publications <ChevronRight size={14} />
          </a>
        </section>
      </div>

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

      <InterestsSection
        memberId={memberId}
        memberName={member.name}
        initialInterests={interests}
        initialFailed={interestsFailed}
      />

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

type InterestStats = {
  total: number;
  donorEntries: number;
  paidEntries: number;
  assetEntries: number;
  roleEntries: number;
  topDonors: string[];
};

function extractInterestStats(interests: MemberInterests | null): InterestStats {
  if (!interests) {
    return { total: 0, donorEntries: 0, paidEntries: 0, assetEntries: 0, roleEntries: 0, topDonors: [] };
  }

  const donorNames = new Set<string>();
  let donorEntries = 0;
  let paidEntries = 0;
  let assetEntries = 0;
  let roleEntries = 0;

  for (const category of interests.categories) {
    for (const interest of category.interests) {
      const text = `${category.name}\n${interest.summary}`;
      if (/donor|donation|gift|hospitality|benefit|sponsor|visit/i.test(text)) donorEntries += 1;
      if (/employment|earnings|payment|payer|salary|role, work|services/i.test(text)) paidEntries += 1;
      if (/land|property|shareholding|share|asset|trust|company/i.test(text)) assetEntries += 1;
      if (/director|trustee|chair|adviser|consultant|patron|board/i.test(text)) roleEntries += 1;

      const donor = interest.summary.match(/Name of donor:\s*([^\r\n]+)/i);
      if (donor?.[1]) donorNames.add(donor[1].trim());
      const payer = interest.summary.match(/Payer:\s*([^\r\n]+)/i);
      if (payer?.[1]) donorNames.add(payer[1].trim());
    }
  }

  return {
    total: interests.total,
    donorEntries,
    paidEntries,
    assetEntries,
    roleEntries,
    topDonors: [...donorNames].slice(0, 4)
  };
}

function InfluenceSummary({
  member,
  stats,
  compass,
  partyCompass,
  interests,
  interestsFailed
}: {
  member: RepDetail["member"];
  stats: RepDetail["stats"];
  compass: RepDetail["compass"];
  partyCompass: RepDetail["partyCompass"];
  interests: MemberInterests | null;
  interestsFailed: boolean;
}) {
  const interestStats = extractInterestStats(interests);

  return (
    <section className="workspace-section influence-section">
      <div className="section-heading">
        <Scale size={20} />
        <div>
          <h2>Influence and accountability</h2>
          <p>
            A source-labelled view of the money, interests, lobbying signals and compass scores
            around this MP.
          </p>
        </div>
      </div>

      <div className="influence-grid">
        <article className="influence-card compass-card">
          <div className="influence-card-head">
            <CompassIcon size={17} />
            <span>Political compass</span>
            <em className="source-pill official">calculated</em>
          </div>
          <strong>{compass ? formatCompassPoint(compass.x, compass.y) : "Awaiting score"}</strong>
          <small>
            {compass
              ? `${compass.sample} scored division vote${compass.sample === 1 ? "" : "s"}`
              : "Needs votes on compass-scored bills"}
          </small>
          <span className="influence-note">
            Party: {partyCompass ? formatCompassPoint(partyCompass.x, partyCompass.y) : "awaiting score"}
          </span>
        </article>

        <article className="influence-card">
          <div className="influence-card-head">
            <HandCoins size={17} />
            <span>Donors and benefits</span>
            <em className="source-pill self">self-reported</em>
          </div>
          <strong>{interests ? interestStats.donorEntries : interestsFailed ? "Unavailable" : "Loading"}</strong>
          <small>gift, donation, hospitality or sponsor-like entries</small>
          {interestStats.topDonors.length > 0 && (
            <span className="influence-note">{interestStats.topDonors.join(" · ")}</span>
          )}
        </article>

        <article className="influence-card">
          <div className="influence-card-head">
            <Banknote size={17} />
            <span>Paid interests</span>
            <em className="source-pill self">self-reported</em>
          </div>
          <strong>{interests ? interestStats.paidEntries : interestsFailed ? "Unavailable" : "Loading"}</strong>
          <small>employment, earnings, payment or services entries</small>
          <span className="influence-note">
            {interests ? `${interestStats.total} total register entries` : "Official register fetch"}
          </span>
        </article>

        <article className="influence-card">
          <div className="influence-card-head">
            <Building2 size={17} />
            <span>Assets and roles</span>
            <em className="source-pill self">self-reported</em>
          </div>
          <strong>{interests ? interestStats.assetEntries + interestStats.roleEntries : interestsFailed ? "Unavailable" : "Loading"}</strong>
          <small>property, shareholding, company, trustee or advisory signals</small>
          <span className="influence-note">
            {interestStats.assetEntries} asset · {interestStats.roleEntries} role
          </span>
        </article>

        <article className="influence-card">
          <div className="influence-card-head">
            <ShieldQuestion size={17} />
            <span>Lobbying exposure</span>
            <em className="source-pill partial">partial</em>
          </div>
          <strong>Not complete</strong>
          <small>ORCL only covers consultant lobbying of ministers and permanent secretaries</small>
          <a
            className="civic-source-link"
            href="https://registrarofconsultantlobbyists.org.uk/"
            target="_blank"
            rel="noreferrer"
          >
            Search consultant lobbyists <ChevronRight size={14} />
          </a>
        </article>

        <article className="influence-card">
          <div className="influence-card-head">
            <ReceiptText size={17} />
            <span>Public costs</span>
            <em className="source-pill official">official</em>
          </div>
          <strong>IPSA</strong>
          <small>staffing, office, travel and accommodation costs</small>
          <a
            className="civic-source-link"
            href={`https://www.theipsa.org.uk/mp-staffing-business-costs/your-mp/${ipsaSlug(member.name)}`}
            target="_blank"
            rel="noreferrer"
          >
            View MP costs <ChevronRight size={14} />
          </a>
        </article>
      </div>

      <p className="influence-caveat">
        This is an accountability map, not a misconduct claim. Register entries are published
        disclosures; lobbying coverage is known to be incomplete until ORCL, ministerial meetings,
        APPGs and Electoral Commission donations are joined.
      </p>
    </section>
  );
}

function PartyInfluencePanel({ party }: { party: PartySummary }) {
  return (
    <div className="party-influence panel" style={{ borderTopColor: partyColour(party.colour) }}>
      <div className="party-influence-title">
        <div>
          <h3>{party.name} transparency snapshot</h3>
          <p>
            Make party influence visible beside seats and discipline; full donor and lobbying
            imports should join this profile next.
          </p>
        </div>
        <span className="party-chip" style={{ background: partyColour(party.colour) }}>
          {party.abbreviation ?? party.name}
        </span>
      </div>
      <div className="party-influence-grid">
        <div>
          <span>Political compass</span>
          <strong>{party.compass ? formatCompassPoint(party.compass.x, party.compass.y) : "Awaiting score"}</strong>
          <em>
            {party.compass
              ? `${party.compass.sample} MP vote sample${party.compass.sample === 1 ? "" : "s"}`
              : "Needs scored divisions"}
          </em>
        </div>
        <div>
          <span>Party discipline</span>
          <strong>{party.discipline != null ? `${party.discipline}%` : "Awaiting votes"}</strong>
          <em>share of MP votes with party majority</em>
        </div>
        <div>
          <span>Known funding source</span>
          <strong>Electoral Commission</strong>
          <em>party donations and loans import planned</em>
        </div>
        <div>
          <span>Lobbying source</span>
          <strong>ORCL + APPGs</strong>
          <em>partial influence graph planned</em>
        </div>
      </div>
      <div className="party-source-links">
        <a
          className="civic-source-link"
          href="https://search.electoralcommission.org.uk/"
          target="_blank"
          rel="noreferrer"
        >
          Electoral Commission donations <ChevronRight size={14} />
        </a>
        <a
          className="civic-source-link"
          href="https://registrarofconsultantlobbyists.org.uk/"
          target="_blank"
          rel="noreferrer"
        >
          Consultant Lobbyists Register <ChevronRight size={14} />
        </a>
        <a
          className="civic-source-link"
          href="https://www.parliament.uk/about/mps-and-lords/members/apg/"
          target="_blank"
          rel="noreferrer"
        >
          All-Party Parliamentary Groups <ChevronRight size={14} />
        </a>
      </div>
    </div>
  );
}

/**
 * Register of Members' Financial Interests, live from the official Interests
 * API — grouped by category, collapsed by default, with a link to the full
 * register entry.
 */
function InterestsSection({
  memberId,
  memberName,
  initialInterests,
  initialFailed
}: {
  memberId: number;
  memberName: string;
  initialInterests: MemberInterests | null;
  initialFailed: boolean;
}) {
  const [interests, setInterests] = useState<MemberInterests | null>(initialInterests);
  const [failed, setFailed] = useState(initialFailed);
  const [openCategory, setOpenCategory] = useState<string | null>(null);

  useEffect(() => {
    if (initialInterests || initialFailed) {
      setInterests(initialInterests);
      setFailed(initialFailed);
      return;
    }
    let mounted = true;
    setInterests(null);
    setFailed(false);
    fetchMemberInterests(memberId)
      .then((payload) => mounted && setInterests(payload))
      .catch(() => mounted && setFailed(true));
    return () => {
      mounted = false;
    };
  }, [memberId, initialInterests, initialFailed]);

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
