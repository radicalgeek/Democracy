import type { Sql } from "postgres";
import { merkleProof, merkleRoot, randomToken, sha256, verifyProof } from "../lib/crypto.js";

export const PRIVACY_THRESHOLD = Number(process.env.PRIVACY_THRESHOLD ?? 5);

/**
 * Append an event to the hash-chained log. Serialized via advisory lock so
 * the chain never forks under concurrent writers.
 */
export async function appendEvent(sql: Sql, eventType: string, payload: Record<string, unknown>) {
  return sql.begin(async (tx) => {
    await tx`select pg_advisory_xact_lock(42)`;
    const [last] = await tx`
      select seq, event_hash from append_only_events order by seq desc limit 1
    `;
    const prevHash = (last?.event_hash as string) ?? sha256("genesis");
    const body = JSON.stringify(payload);
    const eventHash = sha256(`${prevHash}|${eventType}|${body}`);
    const [row] = await tx`
      insert into append_only_events (event_type, payload, prev_hash, event_hash)
      values (${eventType}, ${tx.json(payload as never)}, ${prevHash}, ${eventHash})
      returning seq
    `;
    return { seq: row.seq as number, eventHash };
  });
}

export async function createSession(sql: Sql, displayName: string, constituencyId: number | null, isDemo = false) {
  const token = randomToken();
  const [user] = await sql`
    insert into users (display_name, token_hash, constituency_id, is_demo)
    values (${displayName}, ${sha256(token)}, ${constituencyId}, ${isDemo})
    returning id
  `;
  return { userId: user.id as number, token };
}

export async function userFromToken(sql: Sql, token: string | undefined) {
  if (!token) return null;
  const [user] = await sql`
    select id, display_name, constituency_id from users where token_hash = ${sha256(token)}
  `;
  return user ?? null;
}

/**
 * Issue a single-use voting credential for a bill. The issuance record links
 * user→bill (so eligibility and one-credential-per-user are enforceable);
 * the credential row stores only a hash plus the constituency claim, with no
 * user reference. Prototype caveat: true cryptographic unlinkability needs
 * blind signatures — this is a data-model separation, documented as such.
 */
export async function issueCredential(sql: Sql, userId: number, billId: number, constituencyId: number | null) {
  try {
    await sql`
      insert into credential_issuances (user_id, bill_id) values (${userId}, ${billId})
    `;
  } catch {
    return { error: "already-issued" as const };
  }
  const credential = randomToken();
  await sql`
    insert into voting_credentials (credential_hash, bill_id, constituency_id)
    values (${sha256(credential)}, ${billId}, ${constituencyId})
  `;
  await appendEvent(sql, "credential_issued", { billId });
  return { credential };
}

export async function castBallot(sql: Sql, billId: number, credential: string, choice: "for" | "against" | "abstain") {
  const [spentRow] = await sql`
    update voting_credentials
    set spent = true, spent_at = now()
    where credential_hash = ${sha256(credential)} and bill_id = ${billId} and spent = false
    returning constituency_id
  `;
  if (!spentRow) return { error: "invalid-or-spent-credential" as const };

  const salt = randomToken(16);
  const leafHash = sha256(`${billId}|${choice}|${salt}`);
  await sql`
    insert into anonymous_ballots (bill_id, constituency_id, choice, leaf_hash, salt)
    values (${billId}, ${spentRow.constituency_id}, ${choice}, ${leafHash}, ${salt})
  `;
  const event = await appendEvent(sql, "ballot_cast", { billId, leafHash });

  const receiptCode = randomToken(16);
  await sql`
    insert into vote_receipts (receipt_code, bill_id, leaf_hash)
    values (${receiptCode}, ${billId}, ${leafHash})
  `;
  return { receiptCode, leafHash, eventSeq: event.seq };
}

/** Publish a Merkle checkpoint for a bill if new ballots have arrived. */
export async function runCheckpoint(sql: Sql, billId: number) {
  const leaves = (
    await sql`select leaf_hash from anonymous_ballots where bill_id = ${billId} order by id`
  ).map((row) => row.leaf_hash as string);

  const [latest] = await sql`
    select ballot_count, checkpoint_hash from checkpoints where bill_id = ${billId} order by id desc limit 1
  `;
  if (latest && (latest.ballot_count as number) === leaves.length) return null;
  if (leaves.length === 0) return null;

  const root = merkleRoot(leaves);
  const prevHash = (latest?.checkpoint_hash as string) ?? sha256("genesis-checkpoint");
  const checkpointHash = sha256(`${prevHash}|${billId}|${root}|${leaves.length}`);
  const event = await appendEvent(sql, "checkpoint", { billId, root, count: leaves.length });

  const [row] = await sql`
    insert into checkpoints (bill_id, merkle_root, ballot_count, event_seq, prev_checkpoint_hash, checkpoint_hash)
    values (${billId}, ${root}, ${leaves.length}, ${event.seq}, ${latest?.checkpoint_hash ?? null}, ${checkpointHash})
    returning id, created_at
  `;
  return { id: row.id as number, root, count: leaves.length };
}

/**
 * Verify a receipt: locate its leaf in the bill's ballot list, build a Merkle
 * proof against the latest checkpoint, and check it. Proves inclusion without
 * revealing the vote choice to the verifier.
 */
export async function verifyReceipt(sql: Sql, receiptCode: string) {
  const [receipt] = await sql`
    select bill_id, leaf_hash from vote_receipts where receipt_code = ${receiptCode}
  `;
  if (!receipt) return { verified: false, reason: "unknown receipt" };

  const billId = receipt.bill_id as number;
  const [checkpoint] = await sql`
    select id, merkle_root, ballot_count, created_at from checkpoints
    where bill_id = ${billId} order by id desc limit 1
  `;
  if (!checkpoint) return { verified: false, reason: "no checkpoint published yet — try again shortly" };

  const leaves = (
    await sql`
      select leaf_hash from anonymous_ballots where bill_id = ${billId} order by id
      limit ${checkpoint.ballot_count}
    `
  ).map((row) => row.leaf_hash as string);

  const index = leaves.indexOf(receipt.leaf_hash as string);
  if (index === -1) {
    return { verified: false, reason: "ballot newer than latest checkpoint — try again shortly" };
  }

  const proof = merkleProof(leaves, index);
  const verified = verifyProof(receipt.leaf_hash as string, proof, checkpoint.merkle_root as string);
  return {
    verified,
    billId,
    leafHash: receipt.leaf_hash as string,
    leafIndex: index,
    merkleRoot: checkpoint.merkle_root as string,
    checkpointId: checkpoint.id as number,
    checkpointAt: checkpoint.created_at as string,
    proof
  };
}

/** Vote totals plus per-constituency slices, suppressing slices under the privacy threshold. */
export async function billAggregates(sql: Sql, billId: number) {
  const totals = await sql`
    select choice, count(*)::int as count from anonymous_ballots
    where bill_id = ${billId} group by choice
  `;
  const byChoice = { for: 0, against: 0, abstain: 0 } as Record<string, number>;
  for (const row of totals) byChoice[row.choice as string] = row.count as number;

  const slices = await sql`
    select b.constituency_id, c.name,
      count(*) filter (where b.choice = 'for')::int as for_count,
      count(*) filter (where b.choice = 'against')::int as against_count,
      count(*) filter (where b.choice = 'abstain')::int as abstain_count,
      count(*)::int as total
    from anonymous_ballots b
    left join constituencies c on c.id = b.constituency_id
    where b.bill_id = ${billId} and b.constituency_id is not null
    group by b.constituency_id, c.name
  `;

  const published = [];
  let suppressed = 0;
  for (const slice of slices) {
    if ((slice.total as number) < PRIVACY_THRESHOLD) {
      suppressed += 1;
      continue;
    }
    published.push({
      constituencyId: slice.constituency_id as number,
      name: slice.name as string,
      for: slice.for_count as number,
      against: slice.against_count as number,
      abstain: slice.abstain_count as number,
      total: slice.total as number
    });
  }

  return {
    totals: byChoice,
    ballots: byChoice.for + byChoice.against + byChoice.abstain,
    privacyThreshold: PRIVACY_THRESHOLD,
    constituencies: published,
    suppressedConstituencies: suppressed
  };
}
