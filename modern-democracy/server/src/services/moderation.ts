import type { Sql } from "postgres";
import { storeAnalysis } from "./ai.js";

export type ModerationState =
  | "clean"
  | "heated-legitimate"
  | "needs-review"
  | "hidden"
  | "blocked";

type Classification = {
  state: ModerationState;
  reason: string;
  signals: string[];
};

const THREAT_PATTERNS = [
  /\b(i('|’)ll|i will|we('|’)ll|we will|gonna|going to)\s+(kill|hurt|attack|find|come for)\s+(you|them|him|her)\b/i,
  /\byou (deserve|should get) (a beating|violence|to die)\b/i,
  /\b(kill|shoot|stab|bomb)\s+(yourself|himself|herself)\b/i
];

const DOXX_PATTERNS = [
  /\b(home address|lives at|works at .{0,40}(find|confront))\b/i,
  /\b\d{1,4}\s+\w+\s+(street|road|avenue|lane|close|drive)\b.{0,60}\b(go|find|visit) (him|her|them)\b/i
];

const PERSONAL_ATTACK_PATTERNS = [
  /\byou('|’)?(re| are)\s+(an?\s+)?(idiot|moron|scum|vermin|traitor|liar|cretin|imbecile|degenerate)\b/i,
  /\bshut up\b.{0,30}\b(idiot|moron|fool)\b/i,
  /\bpeople like you (are|should)\b.{0,40}\b(scum|vermin|removed|silenced)\b/i
];

const DEHUMANIZATION_PATTERNS = [
  /\b(they|these people|immigrants|muslims|jews|christians|trans people|gays|refugees)\s+(are|r)\s+(animals|vermin|cockroaches|parasites|subhuman)\b/i
];

const VIOLENCE_PRAISE_PATTERNS = [
  /\b(deserve(s)? to be (shot|hanged|lynched|beaten))\b/i,
  /\b(string (him|her|them) up)\b/i
];

const HEATED_MARKERS = [
  /\b(disgrace|betrayal|outrage(ous)?|shameful|corrupt|incompetent|disaster|catastrophic|gutless|spineless)\b/i,
  /\b(this government|this policy|this bill|parliament|the opposition)\b/i
];

function matchAny(patterns: RegExp[], text: string) {
  return patterns.some((pattern) => pattern.test(text));
}

/**
 * Rule-based classifier implementing the project's moderation stance:
 * blunt political speech is allowed (and labelled heated-legitimate rather
 * than punished); attacks on people, threats, doxxing, dehumanization, and
 * spam are restricted. Borderline content goes to needs-review and stays
 * visible pending review — favour publication.
 */
export function classifyPost(body: string): Classification {
  const signals: string[] = [];
  const trimmed = body.trim();

  if (matchAny(THREAT_PATTERNS, trimmed)) {
    return { state: "blocked", reason: "threat of violence", signals: ["threat"] };
  }
  if (matchAny(DOXX_PATTERNS, trimmed)) {
    return { state: "blocked", reason: "doxxing / targeting", signals: ["doxxing"] };
  }
  if (matchAny(DEHUMANIZATION_PATTERNS, trimmed)) {
    return { state: "blocked", reason: "dehumanizing a group", signals: ["dehumanization"] };
  }
  if (matchAny(VIOLENCE_PRAISE_PATTERNS, trimmed)) {
    return { state: "blocked", reason: "incitement or praise of violence", signals: ["violence-praise"] };
  }
  if (matchAny(PERSONAL_ATTACK_PATTERNS, trimmed)) {
    return { state: "hidden", reason: "personal attack on another user", signals: ["personal-attack"] };
  }

  if (trimmed.length < 12) {
    return { state: "needs-review", reason: "very short, possible low-effort post", signals: ["short"] };
  }
  const linkCount = (trimmed.match(/https?:\/\//g) ?? []).length;
  if (linkCount > 3) {
    return { state: "needs-review", reason: "link-heavy, possible spam", signals: ["links"] };
  }
  const letters = trimmed.replace(/[^a-zA-Z]/g, "");
  const capsRatio = letters.length > 20 ? letters.replace(/[^A-Z]/g, "").length / letters.length : 0;
  if (capsRatio > 0.7) signals.push("shouting");

  if (matchAny(HEATED_MARKERS, trimmed)) {
    signals.push("heated-political");
    return {
      state: "heated-legitimate",
      reason: "strong political criticism without personal target — allowed",
      signals
    };
  }

  return { state: signals.includes("shouting") ? "needs-review" : "clean", reason: "no abuse signals", signals };
}

function banDurationHours(banNumber: number) {
  return Math.pow(2, banNumber - 1); // 1h, 2h, 4h, 8h...
}

export async function activeBan(sql: Sql, userId: number) {
  const [ban] = await sql`
    select id, ban_number, ends_at from temporary_bans
    where user_id = ${userId} and ends_at > now()
    order by ends_at desc limit 1
  `;
  return ban ?? null;
}

export async function publicBanCount(sql: Sql, userId: number) {
  const [row] = await sql`
    select count(*)::int as count from temporary_bans where user_id = ${userId}
  `;
  return row.count as number;
}

/**
 * Moderate and persist a debate post. Blocked content triggers an
 * exponentially escalating temporary ban. All classifications are stored as
 * ai_analyses rows (provenance) and moderation_actions (audit trail).
 */
export async function moderateAndStorePost(
  sql: Sql,
  params: { billId: number; userId: number; body: string; stance: string | null }
) {
  const ban = await activeBan(sql, params.userId);
  if (ban) {
    return { status: "banned" as const, endsAt: ban.ends_at as string, banNumber: ban.ban_number as number };
  }

  const classification = classifyPost(params.body);

  const [post] = await sql`
    insert into debate_posts (bill_id, user_id, stance, body, moderation_state)
    values (${params.billId}, ${params.userId}, ${params.stance}, ${params.body}, ${classification.state})
    returning id, created_at
  `;

  await storeAnalysis(sql, {
    subjectType: "debate_post",
    subjectId: String(post.id),
    kind: "moderation",
    text: params.body,
    output: { state: classification.state, reason: classification.reason, signals: classification.signals },
    model: "rules-v1",
    confidence: classification.state === "needs-review" ? 0.5 : 0.8
  });

  await sql`
    insert into moderation_actions (post_id, user_id, action, reason, detail)
    values (${post.id}, ${params.userId}, ${"classified:" + classification.state}, ${classification.reason}, ${sql.json({ signals: classification.signals })})
  `;

  let newBan: { banNumber: number; endsAt: string } | null = null;
  if (classification.state === "blocked") {
    const previous = await publicBanCount(sql, params.userId);
    const banNumber = previous + 1;
    const hours = banDurationHours(banNumber);
    const [banRow] = await sql`
      insert into temporary_bans (user_id, ban_number, reason, ends_at)
      values (${params.userId}, ${banNumber}, ${classification.reason}, now() + make_interval(hours => ${hours}))
      returning ends_at
    `;
    await sql`
      insert into moderation_actions (post_id, user_id, action, reason)
      values (${post.id}, ${params.userId}, 'ban_issued', ${`temporary ban #${banNumber} (${hours}h): ${classification.reason}`})
    `;
    newBan = { banNumber, endsAt: banRow.ends_at as string };
  }

  return {
    status: "posted" as const,
    postId: post.id as number,
    moderationState: classification.state,
    reason: classification.reason,
    ban: newBan
  };
}
