import type { Sql } from "postgres";
import { heuristicCompass, llmModelName, runLlmJson, storeAnalysis } from "./ai.js";

/**
 * Compass-score user debate posts so the discussion itself carries positions
 * — the missing piece between "what subjects people debate" and "what people
 * actually say". Batched LLM scoring (same pattern as news), heuristic
 * lexicon fallback per post when the LLM is unreachable, full provenance via
 * ai_analyses.
 */

const BATCH_SIZE = 8;

type ScorablePost = { id: number; body: string };

async function unscoredPosts(sql: Sql, limit: number): Promise<ScorablePost[]> {
  const rows = await sql`
    select dp.id, dp.body from debate_posts dp
    where dp.moderation_state not in ('hidden', 'blocked')
      and length(dp.body) >= 40
      and not exists (
        select 1 from ai_analyses a
        where a.subject_type = 'debate_post' and a.subject_id = dp.id::text and a.kind = 'compass'
      )
    order by dp.id desc
    limit ${limit}
  `;
  return rows.map((row) => ({ id: row.id as number, body: row.body as string }));
}

type BatchScore = { index: number; x: number; y: number; label?: string; rationale?: string };

async function scoreBatchWithLlm(posts: ScorablePost[]): Promise<Map<number, BatchScore> | null> {
  const numbered = posts
    .map((post, index) => `${index + 1}. ${post.body.slice(0, 500)}`)
    .join("\n\n");
  const result = await runLlmJson(
    'You score short UK political comments on the political compass based on the position the author expresses. x: economic, -10 left to +10 right. y: -10 libertarian to +10 authoritarian. If a comment expresses no discernible political position, use x: 0, y: 0 and label "neutral". Respond with JSON only: an array [{"index": number, "x": number, "y": number, "label": string}] with one entry per numbered comment.',
    numbered
  );
  if (!Array.isArray(result)) return null;
  const byIndex = new Map<number, BatchScore>();
  for (const entry of result as BatchScore[]) {
    if (typeof entry?.index === "number" && typeof entry.x === "number" && typeof entry.y === "number") {
      byIndex.set(entry.index, entry);
    }
  }
  return byIndex.size > 0 ? byIndex : null;
}

export async function compassDebatePosts(sql: Sql, limit = 48) {
  const posts = await unscoredPosts(sql, limit);
  let llmScored = 0;
  let heuristicScored = 0;

  for (let start = 0; start < posts.length; start += BATCH_SIZE) {
    const batch = posts.slice(start, start + BATCH_SIZE);
    const scores = await scoreBatchWithLlm(batch);
    for (const [offset, post] of batch.entries()) {
      const score = scores?.get(offset + 1);
      if (score) {
        await storeAnalysis(sql, {
          subjectType: "debate_post",
          subjectId: String(post.id),
          kind: "compass",
          text: post.body,
          output: {
            x: Math.max(-10, Math.min(10, score.x)),
            y: Math.max(-10, Math.min(10, score.y)),
            label: score.label ?? "scored",
            rationale: score.rationale ?? "batched comment scoring"
          },
          model: llmModelName(),
          confidence: 0.7
        });
        llmScored += 1;
      } else {
        await storeAnalysis(sql, {
          subjectType: "debate_post",
          subjectId: String(post.id),
          kind: "compass",
          text: post.body,
          output: heuristicCompass(post.body) as unknown as Record<string, unknown>,
          model: "heuristic-lexicon-v0",
          confidence: 0.2
        });
        heuristicScored += 1;
      }
    }
  }
  return { postsChecked: posts.length, llmScored, heuristicScored };
}
