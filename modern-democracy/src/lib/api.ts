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
};

export type BackendAnalysis = {
  kind: "summary" | "compass";
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
  checkpoint: {
    merkle_root: string;
    ballot_count: number;
    checkpoint_hash: string;
    created_at: string;
  } | null;
  aggregates: BackendAggregates;
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

export function fetchConstituencyProfile(constituencyId: number) {
  return getJson<ConstituencyProfile>(`/api/constituencies/${constituencyId}/profile`);
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
