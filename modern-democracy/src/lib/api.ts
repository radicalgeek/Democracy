import type { IntegrationStatus, VoteChoice } from "../data/types";

const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? "http://localhost:8787";

export type BackendBill = {
  id: number;
  short_title: string;
  long_title: string | null;
  current_house: string | null;
  current_stage: string | null;
  bill_type: string | null;
  last_updated: string | null;
  source_url: string;
  has_text: boolean;
  ballots: number;
  divisions: number;
  debate_posts: number;
  hansard_debates: number;
  news_items: number;
  has_summary: boolean;
  has_compass: boolean;
  has_debate_summary: boolean;
};

export type BillDebate = {
  id: number;
  ext_id: string;
  title: string;
  house: string | null;
  sitting_date: string | null;
  contributions: number;
  speakers: number;
  source_url: string;
};

export type BackendAnalysis = {
  kind: "summary" | "compass" | "debate-summary";
  model: string;
  prompt_version: string;
  output: Record<string, unknown>;
  citations: Array<{ label: string; url: string }>;
  confidence: number;
  review_state: string;
  generated_at: string;
};

export type BackendAggregates = {
  totals: { for: number; against: number; abstain: number };
  ballots: number;
  privacyThreshold: number;
  constituencies: Array<{
    constituencyId: number;
    name: string;
    for: number;
    against: number;
    abstain: number;
    total: number;
  }>;
  suppressedConstituencies: number;
};

export type BackendBillDetail = {
  bill: BackendBill & { imported_at: string };
  texts: Array<{
    id: number;
    title: string | null;
    content_type: string | null;
    source_url: string;
    has_text: boolean;
    text_length: number | null;
  }>;
  events: Array<{ stage: string | null; house: string | null; happened_on: string | null }>;
  analyses: BackendAnalysis[];
  debates: BillDebate[];
  checkpoint: {
    merkle_root: string;
    ballot_count: number;
    checkpoint_hash: string;
    created_at: string;
  } | null;
  aggregates: BackendAggregates;
  news: BackendNewsItem[];
};

export type CivicSource = {
  id: string;
  name: string;
  category: string;
  scope: string;
  owner: string;
  url: string;
  licence: string | null;
  official_status: string;
  refresh_cadence: string | null;
  newcomer_explanation: string;
  compass_score_potential: string;
  aggregate_view_potential: string;
  caveats: string | null;
};

export type CompassScoreRecord = {
  subject_type: string;
  subject_id: string;
  x: string | number;
  y: string | number;
  label: string;
  explanation: string;
  confidence: number;
  source_id: string | null;
};

export type AggregateView = {
  id: string;
  title: string;
  view_type: string;
  summary: string;
  source_ids: string[];
  beginner_question: string;
  compass_lens: string | null;
  route_hint: string | null;
  status: string;
};

export type LocalCivicLayer = {
  id: string;
  title: string;
  layer_type: string;
  summary: string;
  source_id: string | null;
  beginner_label: string;
  gamified_action: string | null;
  compass_potential: string | null;
  aggregate_view: string;
  status: string;
  source_name: string | null;
  source_url: string | null;
  official_status: string | null;
};

export type FiscalIndicator = {
  id: string;
  title: string;
  plain_english: string;
  source_id: string | null;
  period: string | null;
  value_label: string | null;
  trend_label: string | null;
  why_it_matters: string;
  compass_potential: string | null;
  aggregate_view: string;
  status: string;
  source_name: string | null;
  source_url: string | null;
  official_status: string | null;
};

export type TaxScenario = {
  id: string;
  title: string;
  persona: string;
  plain_english: string;
  source_ids: string[];
  visible_pattern: string;
  compass_potential: string | null;
  aggregate_view: string;
  status: string;
};

export type LocalCivicOverview = {
  promise: string;
  layers: LocalCivicLayer[];
  aggregateViews: AggregateView[];
  compassScores: CompassScoreRecord[];
};

export type FiscalCivicOverview = {
  promise: string;
  indicators: FiscalIndicator[];
  taxScenarios: TaxScenario[];
  aggregateViews: AggregateView[];
  compassScores: CompassScoreRecord[];
};

export type CivicPostcodeProfile = {
  postcode: string;
  location: {
    latitude: number | null;
    longitude: number | null;
    country: string | null;
    region: string | null;
  };
  parliamentary: {
    constituency: string | null;
    constituency2024: string | null;
  };
  local: {
    district: string | null;
    county: string | null;
    ward: string | null;
    parish: string | null;
    ced: string | null;
    ccg: string | null;
    policeForce: string | null;
  };
  codes: Record<string, string | null>;
  source: { id: string; name: string; url: string };
  beginnerExplanation: string;
  nextActions: string[];
};

export type SeatBinding = {
  svg_id: string;
  legacy_name: string;
  legacy_party: string | null;
  constituency_id: number | null;
  match_status: "exact" | "normalized" | "unmatched";
  constituency_name: string | null;
  mp_name: string | null;
  party_name: string | null;
  party_colour: string | null;
};

export type MapBindings = {
  bySvgId: Record<string, SeatBinding>;
  summary: { exact: number; normalized: number; unmatched: number };
};

export type BackendDebatePost = {
  id: number;
  stance: VoteChoice | null;
  moderation_state: "clean" | "heated-legitimate" | "needs-review" | "hidden" | "blocked";
  created_at: string;
  body: string | null;
  author: string;
  public_ban_count: number;
};

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error(`${path} returned ${response.status}`);
  return (await response.json()) as T;
}

async function postJson<T>(path: string, body: unknown, token?: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify(body ?? {})
  });
  const payload = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(payload.error ?? `${path} returned ${response.status}`);
  return payload;
}

export async function checkBackend(): Promise<IntegrationStatus> {
  const checkedAt = new Date().toISOString();
  try {
    const status = await getJson<{
      counts: { bills: number; constituencies: number; ballots: number; matched_seats: number };
    }>("/api/status");
    return {
      source: "Democracy backend",
      status: "live",
      message: `${status.counts.bills} bills, ${status.counts.constituencies} constituencies, ${status.counts.ballots.toLocaleString()} anonymous ballots, ${status.counts.matched_seats} map seats bound.`,
      checkedAt,
      records: status.counts.bills
    };
  } catch {
    return {
      source: "Democracy backend",
      status: "fallback",
      message: "Backend not reachable — using sample civic data. Run `docker compose up` for the full stack.",
      checkedAt
    };
  }
}

export function fetchBackendBills(take = 20) {
  return getJson<{ bills: BackendBill[] }>(`/api/bills?take=${take}`);
}

export function fetchBillDetail(billId: number) {
  return getJson<BackendBillDetail>(`/api/bills/${billId}`);
}

export function fetchLocalCivicOverview() {
  return getJson<LocalCivicOverview>("/api/civic/local");
}

export function fetchFiscalCivicOverview() {
  return getJson<FiscalCivicOverview>("/api/civic/fiscal");
}

export function fetchCivicSources(category?: string) {
  const suffix = category ? `?category=${encodeURIComponent(category)}` : "";
  return getJson<{ sources: CivicSource[] }>(`/api/civic/sources${suffix}`);
}

export function fetchCivicPostcodeProfile(postcode: string) {
  return getJson<CivicPostcodeProfile>(`/api/civic/postcode/${encodeURIComponent(postcode)}`);
}

export async function fetchMapBindings(): Promise<MapBindings> {
  const payload = await getJson<{
    bindings: SeatBinding[];
    summary: { exact: number; normalized: number; unmatched: number };
  }>("/api/map/bindings");
  const bySvgId: Record<string, SeatBinding> = {};
  for (const binding of payload.bindings) bySvgId[binding.svg_id] = binding;
  return { bySvgId, summary: payload.summary };
}

export function fetchDebate(billId: number) {
  return getJson<{ posts: BackendDebatePost[] }>(`/api/bills/${billId}/debate`);
}

const SESSION_KEY = "democracy.sessionToken";

export type AccountUser = {
  id: number;
  displayName: string;
  email: string | null;
  constituencyId: number | null;
  constituencyName: string | null;
  verificationTier: number;
  verifiedAt: string | null;
};

export function storedToken() {
  return localStorage.getItem(SESSION_KEY);
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

export async function registerAccount(input: {
  email: string;
  password: string;
  displayName: string;
  postcode: string;
}) {
  const result = await postJson<{ token: string; user: AccountUser }>("/api/auth/register", input);
  localStorage.setItem(SESSION_KEY, result.token);
  return result.user;
}

export async function loginAccount(input: { email: string; password: string }) {
  const result = await postJson<{ token: string; user: AccountUser }>("/api/auth/login", input);
  localStorage.setItem(SESSION_KEY, result.token);
  return result.user;
}

export async function currentUser(): Promise<AccountUser | null> {
  const token = storedToken();
  if (!token) return null;
  try {
    const result = await getJsonAuthed<{ user: AccountUser }>("/api/auth/me", token);
    return result.user;
  } catch {
    clearSession();
    return null;
  }
}

export async function submitIdentityCheck(input: {
  fullName: string;
  dateOfBirth: string;
  addressLine1: string;
  postcode: string;
}) {
  const token = storedToken();
  if (!token) throw new Error("not signed in");
  return postJson<{ verified: boolean; reason?: string; user?: AccountUser }>(
    "/api/auth/verify",
    input,
    token
  );
}

export async function lookupPostcode(postcode: string) {
  const response = await fetch(`${API_BASE}/api/postcode/${encodeURIComponent(postcode)}`, {
    headers: { accept: "application/json" }
  });
  const payload = (await response.json()) as {
    constituencyId?: number;
    constituencyName?: string;
    error?: string;
  };
  if (!response.ok) return { error: payload.error ?? "lookup failed" };
  return payload as { constituencyId: number; constituencyName: string };
}

async function getJsonAuthed<T>(path: string, token: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { accept: "application/json", authorization: `Bearer ${token}` }
  });
  if (!response.ok) throw new Error(`${path} returned ${response.status}`);
  return (await response.json()) as T;
}

async function ensureSession(): Promise<string> {
  const existing = storedToken();
  if (!existing) throw new Error("sign-in-required");
  return existing;
}

export type CastResult =
  | { ok: true; receiptCode: string; leafHash: string }
  | { ok: false; reason: string };

export async function castVote(
  billId: number,
  choice: VoteChoice,
  constituencyId: number | null
): Promise<CastResult> {
  try {
    const token = await ensureSession();
    const credential = await postJson<{ credential: string }>(
      `/api/bills/${billId}/credential`,
      {},
      token
    );
    const ballot = await postJson<{ receiptCode: string; leafHash: string }>(
      `/api/bills/${billId}/ballots`,
      { credential: credential.credential, choice }
    );
    localStorage.setItem(`democracy.receipt.${billId}`, ballot.receiptCode);
    // Choice stays on this device only — the server never links it to you.
    // It powers the client-side "does my MP vote like me" comparison.
    localStorage.setItem(`democracy.choice.${billId}`, choice);
    return { ok: true, ...ballot };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : "vote failed"
    };
  }
}

export function storedReceipt(billId: number) {
  return localStorage.getItem(`democracy.receipt.${billId}`);
}

export function storedChoice(billId: number): VoteChoice | null {
  const value = localStorage.getItem(`democracy.choice.${billId}`);
  return value === "for" || value === "against" || value === "abstain" ? value : null;
}

export type ConstituencyProfile = {
  constituency: { id: number; name: string };
  mp: {
    id: number;
    name: string;
    party: string | null;
    partyAbbreviation: string | null;
    partyColour: string | null;
    thumbnailUrl: string | null;
  } | null;
  votingRecord: Array<{
    divisionId: number;
    title: string;
    date: string;
    vote: "aye" | "no";
    ayeCount: number;
    noCount: number;
    billId: number | null;
    billTitle: string | null;
  }>;
  civicVotes: Array<{
    billId: number;
    billTitle: string;
    for: number;
    against: number;
    abstain: number;
    total: number;
  }>;
  alignment: {
    compared: number;
    matched: number;
    percent: number | null;
    comparisons: Array<{
      divisionId: number;
      billId: number;
      billTitle: string | null;
      divisionTitle: string;
      mpVote: string;
      scope: "constituency" | "national";
      matched: boolean;
    }>;
  };
  participation: { ballots: number; privacyThreshold: number };
};

export type CompassVector = { x: number; y: number; sample: number } | null;

export type CompassComparison = {
  mp: CompassVector;
  party: CompassVector;
  partyName: string | null;
  constituency: CompassVector;
  national: CompassVector;
  proximities: {
    mpConstituency: number | null;
    mpNational: number | null;
    mpParty: number | null;
    partyNational: number | null;
  } | null;
};

export function fetchConstituencyProfile(constituencyId: number) {
  return getJson<ConstituencyProfile & { compass: CompassComparison }>(
    `/api/constituencies/${constituencyId}/profile`
  );
}

export type BackendPetition = {
  id: number;
  action: string;
  state: string;
  signature_count: number;
  opened_at: string | null;
  for_count: number;
  against_count: number;
  abstain_count: number;
  debate_count: number;
};

export type PetitionDetailPayload = {
  petition: {
    id: number;
    action: string;
    background: string | null;
    additionalDetails: string | null;
    state: string;
    signatureCount: number;
    openedAt: string | null;
    officialUrl: string;
  };
  analyses: {
    summary: { summary?: string } | null;
    compass:
      | { x?: number; y?: number; label?: string; rationale?: string; model?: string; confidence?: number }
      | null;
  };
  votes: { for: number; against: number; abstain: number; total: number };
  myVote: string | null;
  posts: BackendDebatePost[];
  news: BackendNewsItem[];
};

export type BackendNewsItem = {
  id: number;
  title: string;
  url: string;
  source: string | null;
  publishedAt: string | null;
  summary: string | null;
  compass: {
    x: number;
    y: number;
    label: string;
    rationale: string;
    model?: string;
    confidence?: number;
  } | null;
};

/** Map a backend news article (±10 compass) onto the UI NewsItem shape (±1). */
export function mapBackendNews(item: BackendNewsItem): import("../data/types").NewsItem {
  return {
    id: String(item.id),
    source: item.source ?? "Unknown source",
    title: item.title,
    type: "reporting",
    publishedAt: item.publishedAt ?? "",
    url: item.url,
    compass: {
      x: (item.compass?.x ?? 0) / 10,
      y: (item.compass?.y ?? 0) / 10,
      label: item.compass?.label ?? "awaiting scoring",
      confidence: item.compass?.confidence ?? 0,
      rationale: item.compass?.rationale ?? ""
    },
    confidence: item.compass?.confidence ?? 0,
    summary: item.summary ?? ""
  };
}

export type RepListMember = {
  id: number;
  name: string;
  gender: string | null;
  thumbnail_url: string | null;
  party: string | null;
  party_abbreviation: string | null;
  party_colour: string | null;
  constituency_id: number | null;
  constituency: string | null;
  division_votes: number;
};

export type PartySummary = {
  id: number;
  name: string;
  abbreviation: string | null;
  colour: string | null;
  seats: number;
  discipline: number | null;
  compass: { x: number; y: number; sample: number } | null;
};

export type RepDetail = {
  member: {
    id: number;
    name: string;
    gender: string | null;
    thumbnailUrl: string | null;
    party: string | null;
    partyAbbreviation: string | null;
    partyColour: string | null;
    constituencyId: number | null;
    constituency: string | null;
    memberSince: string | null;
    synopsis: string | null;
  };
  biography: {
    representations?: Array<{ name: string; startDate?: string; endDate?: string | null }>;
    governmentPosts?: Array<{ name: string; startDate?: string; endDate?: string | null }>;
    oppositionPosts?: Array<{ name: string; startDate?: string; endDate?: string | null }>;
    committeeMemberships?: Array<{ name: string; startDate?: string; endDate?: string | null }>;
  } | null;
  latestElection: {
    electionDate?: string;
    majority?: number;
    turnout?: number;
    electorate?: number;
    candidates?: Array<{
      name: string;
      votes: number;
      voteShare: number;
      party?: { name?: string; backgroundColour?: string };
    }>;
  } | null;
  stats: { divisionsVoted: number; rebellions: number; partyLinePercent: number | null };
  compass: { x: number; y: number; sample: number } | null;
  votingRecord: Array<{
    divisionId: number;
    title: string;
    date: string;
    vote: "aye" | "no";
    ayeCount: number;
    noCount: number;
    billId: number | null;
    billTitle: string | null;
    rebelled: boolean;
  }>;
};

export type ConstituencyElection = {
  electionDate?: string;
  electionTitle?: string;
  result?: string;
  winningParty?: { name?: string; backgroundColour?: string; abbreviation?: string } | null;
  electorate?: number;
  turnout?: number;
  majority?: number;
};

export function fetchRepresentatives(params: { search?: string; party?: string; skip?: number; take?: number }) {
  const query = new URLSearchParams();
  if (params.search) query.set("search", params.search);
  if (params.party) query.set("party", params.party);
  if (params.skip) query.set("skip", String(params.skip));
  if (params.take) query.set("take", String(params.take));
  return getJson<{ total: number; members: RepListMember[] }>(`/api/representatives?${query}`);
}

export function fetchRepresentativeDetail(memberId: number) {
  return getJson<RepDetail>(`/api/representatives/${memberId}`);
}

export type MemberInterests = {
  memberId: number;
  total: number;
  registerUrl: string;
  categories: Array<{
    name: string;
    interests: Array<{ id: number; summary: string; registered: string | null }>;
  }>;
};

export function fetchMemberInterests(memberId: number) {
  return getJson<MemberInterests>(`/api/representatives/${memberId}/interests`);
}

export type DepartmentSummary = {
  slug: string;
  name: string;
  abbreviation: string;
  spend: string;
  spendNote: string;
  riskScore: number | null;
  riskLevel: string | null;
};

export type DepartmentProfile = DepartmentSummary & {
  description: string | null;
  govukUrl: string;
  spendNote: string;
  riskNote: string | null;
  ministers: Array<{ post: string; name: string; party: string | null; memberId: number | null }>;
  committee: { name: string; url: string } | null;
  links: Array<{ label: string; url: string }>;
};

export function fetchDepartments() {
  return getJson<{ departments: DepartmentSummary[] }>("/api/departments");
}

export function fetchDepartmentProfile(slug: string) {
  return getJson<{ department: DepartmentProfile }>(`/api/departments/${slug}`);
}

export function fetchParties() {
  return getJson<{ parties: PartySummary[] }>("/api/parties");
}

export function fetchConstituencyElections(constituencyId: number) {
  return getJson<{ elections: ConstituencyElection[] }>(
    `/api/constituencies/${constituencyId}/elections`
  );
}

export function fetchPetitions() {
  return getJson<{ petitions: BackendPetition[] }>("/api/petitions");
}

export type MediaOutlet = { name: string; x: number; y: number; sample: number };

export type MediaCompassPayload = {
  outlets: MediaOutlet[];
  overall: { x: number; y: number; sample: number } | null;
};

export function fetchMediaCompass() {
  return getJson<MediaCompassPayload>("/api/insights/media");
}

export type NationalCompassVector = { x: number; y: number; sample: number } | null;

export type NationalCompassPayload = {
  civicWill: NationalCompassVector;
  discussion: NationalCompassVector;
  media: { overall: NationalCompassVector; outlets: MediaOutlet[] };
  government: {
    party: {
      name: string;
      abbreviation: string | null;
      colour: string | null;
      seats: number;
      compass: NationalCompassVector;
    };
    legislation: NationalCompassVector;
  } | null;
  parties: Array<{
    name: string;
    abbreviation: string | null;
    colour: string | null;
    seats: number;
    compass: NationalCompassVector;
  }>;
  generatedAt: string;
};

export function fetchNationalCompass() {
  return getJson<NationalCompassPayload>("/api/insights/national-compass");
}

export type BallotMajority = {
  billId: number;
  billTitle: string;
  national: { for: number; against: number; total: number };
  constituency: { for: number; against: number; total: number } | null;
};

export function fetchBallotMajorities(constituencyId: number | null) {
  const query = constituencyId ? `?constituencyId=${constituencyId}` : "";
  return getJson<{ privacyThreshold: number; majorities: BallotMajority[] }>(
    `/api/insights/ballots${query}`
  );
}

export type ConstituencyLean = {
  constituencyId: number;
  ballots: number;
  lean: { x: number; y: number; sample: number } | null;
};

export function fetchConstituencyLeans() {
  return getJson<{ privacyThreshold: number; leans: ConstituencyLean[] }>("/api/insights/leans");
}

export async function fetchPetitionDetail(petitionId: number) {
  const token = storedToken();
  const response = await fetch(`${API_BASE}/api/petitions/${petitionId}`, {
    headers: {
      accept: "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {})
    }
  });
  if (!response.ok) throw new Error(`petition ${petitionId} returned ${response.status}`);
  return (await response.json()) as PetitionDetailPayload;
}

export async function votePetition(petitionId: number, choice: VoteChoice) {
  const token = storedToken();
  if (!token) throw new Error("sign-in-required");
  return postJson<{ ok: boolean }>(`/api/petitions/${petitionId}/vote`, { choice }, token);
}

export async function submitPetitionDebatePost(
  petitionId: number,
  body: string,
  stance: VoteChoice | null
): Promise<DebatePostResult> {
  const token = storedToken();
  if (!token) throw new Error("sign-in-required");
  const response = await fetch(`${API_BASE}/api/petitions/${petitionId}/debate`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({ body, stance })
  });
  const payload = (await response.json()) as DebatePostResult & { error?: string };
  if (!response.ok && payload.status !== "banned") {
    throw new Error(payload.error ?? `post failed (${response.status})`);
  }
  return payload;
}

export type ReceiptVerification = {
  verified: boolean;
  reason?: string;
  merkleRoot?: string;
  leafIndex?: number;
  checkpointId?: number;
  proof?: Array<{ hash: string; position: string }>;
};

export function verifyReceipt(code: string) {
  return getJson<ReceiptVerification>(`/api/receipts/${code}/verify`);
}

export type DebatePostResult =
  | {
      status: "posted";
      postId: number;
      moderationState: string;
      reason: string;
      ban: { banNumber: number; endsAt: string } | null;
      publicBanCount: number;
    }
  | { status: "banned"; endsAt: string; banNumber: number };

export async function submitDebatePost(
  billId: number,
  body: string,
  stance: VoteChoice | null
): Promise<DebatePostResult> {
  const token = await ensureSession();
  const response = await fetch(`${API_BASE}/api/bills/${billId}/debate`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({ body, stance })
  });
  const payload = (await response.json()) as DebatePostResult & { error?: string };
  if (response.status === 401) {
    localStorage.removeItem(SESSION_KEY);
    throw new Error("session expired — try again");
  }
  if (!response.ok && payload.status !== "banned") {
    throw new Error(payload.error ?? `post failed (${response.status})`);
  }
  return payload;
}

// Learning & gamification API
export type EngagementStats = {
  billsVoted: number;
  debatePostsCreated: number;
  constituenciesExplored: number;
  helpTopicsViewed: number;
  currentStreak: number;
  engagementLevel: string;
  achievements: string[];
  nextMilestone: {
    target: string;
    billsNeeded: number;
    billsRemaining: number;
    topicsNeeded: number;
    topicsRemaining: number;
  } | null;
};

export async function fetchEngagementStats(): Promise<{ engagement: EngagementStats } | null> {
  const token = storedToken();
  if (!token) return null;
  try {
    const response = await fetch(`${API_BASE}/api/auth/me/engagement`, {
      headers: { authorization: `Bearer ${token}` }
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

export async function markHelpViewedBackend(topicId: string): Promise<boolean> {
  const token = storedToken();
  if (!token) return false;
  try {
    const response = await fetch(`${API_BASE}/api/auth/me/help-view`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ topicId })
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function fetchLearningStats(): Promise<{
  learning: {
    helpTopicsViewed: string[];
    achievements: Array<{ id: string; unlockedAt: string }>;
  };
} | null> {
  const token = storedToken();
  if (!token) return null;
  try {
    const response = await fetch(`${API_BASE}/api/auth/me/learning`, {
      headers: { authorization: `Bearer ${token}` }
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}
