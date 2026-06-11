import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import type { Sql } from "postgres";
import { normalizeConstituencyName } from "../lib/names.js";
import { randomToken, sha256 } from "../lib/crypto.js";

const POSTCODES_API = "https://api.postcodes.io/postcodes";

export type PublicUser = {
  id: number;
  displayName: string;
  email: string | null;
  constituencyId: number | null;
  constituencyName: string | null;
  verificationTier: number;
  verifiedAt: string | null;
};

function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

function checkPassword(password: string, stored: string) {
  const [scheme, salt, hash] = stored.split(":");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const candidate = scryptSync(password, salt, 64);
  return timingSafeEqual(candidate, Buffer.from(hash, "hex"));
}

/**
 * Resolve a UK postcode to a current constituency row via postcodes.io,
 * matched by normalized name against the imported constituencies table.
 */
export async function lookupPostcode(sql: Sql, postcode: string) {
  const cleaned = postcode.replace(/\s+/g, "").toUpperCase();
  if (!/^[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2}$/.test(cleaned)) {
    return { error: "invalid-postcode" as const };
  }
  let constituencyName: string | undefined;
  try {
    const response = await fetch(`${POSTCODES_API}/${encodeURIComponent(cleaned)}`);
    if (response.status === 404) return { error: "postcode-not-found" as const };
    if (!response.ok) return { error: "lookup-unavailable" as const };
    const payload = (await response.json()) as {
      result?: { parliamentary_constituency_2024?: string; parliamentary_constituency?: string };
    };
    constituencyName =
      payload.result?.parliamentary_constituency_2024 ?? payload.result?.parliamentary_constituency;
  } catch {
    return { error: "lookup-unavailable" as const };
  }
  if (!constituencyName) return { error: "no-constituency" as const };

  const normalized = normalizeConstituencyName(constituencyName);
  const [match] = await sql`
    select id, name from constituencies
    where normalized_name = ${normalized} and (end_date is null or end_date > now())
    limit 1
  `;
  if (!match) return { error: "constituency-not-imported" as const, constituencyName };
  return { constituencyId: match.id as number, constituencyName: match.name as string };
}

function toPublicUser(row: Record<string, unknown>): PublicUser {
  return {
    id: row.id as number,
    displayName: row.display_name as string,
    email: (row.email as string) ?? null,
    constituencyId: (row.constituency_id as number) ?? null,
    constituencyName: (row.constituency_name as string) ?? null,
    verificationTier: (row.verification_tier as number) ?? 0,
    verifiedAt: row.verified_at ? new Date(row.verified_at as string).toISOString() : null
  };
}

const userColumns = (sql: Sql) => sql`
  select u.id, u.display_name, u.email, u.constituency_id, u.verification_tier, u.verified_at,
         c.name as constituency_name
  from users u left join constituencies c on c.id = u.constituency_id
`;

export async function registerUser(
  sql: Sql,
  input: { email: string; password: string; displayName: string; postcode: string }
) {
  const email = input.email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "invalid-email" as const };
  if (input.password.length < 8) return { error: "password-too-short" as const };
  const displayName = input.displayName.trim().slice(0, 60);
  if (!displayName) return { error: "display-name-required" as const };

  const constituency = await lookupPostcode(sql, input.postcode);
  if ("error" in constituency) return constituency;

  const [existing] = await sql`select id from users where lower(email) = ${email}`;
  if (existing) return { error: "email-taken" as const };

  const token = randomToken();
  const [row] = await sql`
    insert into users (display_name, token_hash, constituency_id, email, password_hash, postcode, verification_tier)
    values (
      ${displayName}, ${sha256(token)}, ${constituency.constituencyId},
      ${email}, ${hashPassword(input.password)},
      ${input.postcode.replace(/\s+/g, "").toUpperCase()}, 1
    )
    returning id
  `;
  const user = await userFromId(sql, row.id as number);
  return { token, user: user! };
}

export async function loginUser(sql: Sql, input: { email: string; password: string }) {
  const email = input.email.trim().toLowerCase();
  const [row] = await sql`
    select id, password_hash from users where lower(email) = ${email}
  `;
  if (!row?.password_hash || !checkPassword(input.password, row.password_hash as string)) {
    return { error: "invalid-credentials" as const };
  }
  // Single active session: rotate the token on every login.
  const token = randomToken();
  await sql`update users set token_hash = ${sha256(token)} where id = ${row.id}`;
  const user = await userFromId(sql, row.id as number);
  return { token, user: user! };
}

export async function userFromId(sql: Sql, id: number): Promise<PublicUser | null> {
  const [row] = await sql`${userColumns(sql)} where u.id = ${id}`;
  return row ? toPublicUser(row) : null;
}

export async function publicUserFromToken(sql: Sql, token: string | undefined) {
  if (!token) return null;
  const [row] = await sql`${userColumns(sql)} where u.token_hash = ${sha256(token)}`;
  return row ? toPublicUser(row) : null;
}

/**
 * Identity verification provider interface. The simulated provider stands in
 * for a real electoral-roll-backed IDV service (Onfido/Yoti/credit-agency KBV)
 * and applies only shape checks. Swap `verifier` to integrate a real provider;
 * callers and the API contract stay unchanged.
 */
export type IdentityCheck = {
  fullName: string;
  dateOfBirth: string;
  addressLine1: string;
  postcode: string;
};

export type IdentityVerifier = {
  name: string;
  verify(check: IdentityCheck): Promise<{ verified: boolean; reason?: string }>;
};

const simulatedVerifier: IdentityVerifier = {
  name: "simulated-idv-v1",
  async verify(check) {
    if (check.fullName.trim().split(/\s+/).length < 2) {
      return { verified: false, reason: "Full legal name (first and last) is required." };
    }
    const dob = new Date(check.dateOfBirth);
    if (Number.isNaN(dob.getTime())) return { verified: false, reason: "Invalid date of birth." };
    const age = (Date.now() - dob.getTime()) / (365.25 * 24 * 3600 * 1000);
    if (age < 16) return { verified: false, reason: "You must be 16 or over to verify." };
    if (age > 120) return { verified: false, reason: "Invalid date of birth." };
    if (!check.addressLine1.trim()) return { verified: false, reason: "Address is required." };
    // Simulated provider latency so the UX matches a real IDV round trip.
    await new Promise((resolve) => setTimeout(resolve, 1500));
    return { verified: true };
  }
};

export const verifier: IdentityVerifier = simulatedVerifier;

export async function verifyIdentity(sql: Sql, userId: number, check: IdentityCheck) {
  const result = await verifier.verify(check);
  if (!result.verified) return { verified: false as const, reason: result.reason };
  await sql`
    update users set verification_tier = 2, verified_at = now() where id = ${userId}
  `;
  const user = await userFromId(sql, userId);
  return { verified: true as const, provider: verifier.name, user: user! };
}
