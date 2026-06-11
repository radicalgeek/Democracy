import type { Sql } from "postgres";
import { sha256 } from "../lib/crypto.js";

const PROMPT_VERSION = "2026-06-11.1";
// LLM access goes through a LiteLLM proxy speaking the Anthropic /v1/messages
// wire format. LLM_BASE_URL points at the proxy (no trailing slash);
// LLM_API_KEY is only needed if the proxy enforces virtual keys.
const LLM_BASE_URL = process.env.LLM_BASE_URL ?? "";
const LLM_API_KEY = process.env.LLM_API_KEY ?? "";
const MODEL = process.env.LLM_MODEL ?? "router-local";

export type Citation = { label: string; url: string };

type AnalysisRequest = {
  subjectType: "bill" | "debate_post" | "news_item" | "petition";
  subjectId: string;
  kind: "summary" | "compass" | "moderation";
  text: string;
  citations?: Citation[];
};

type AnalysisResult = {
  output: Record<string, unknown>;
  model: string;
  confidence: number;
};

async function callLlm(system: string, user: string): Promise<Record<string, unknown> | null> {
  if (!LLM_BASE_URL) return null;
  try {
    const response = await fetch(`${LLM_BASE_URL}/v1/messages`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "anthropic-version": "2023-06-01",
        ...(LLM_API_KEY
          ? { "x-api-key": LLM_API_KEY, authorization: `Bearer ${LLM_API_KEY}` }
          : {})
      },
      body: JSON.stringify({
        model: MODEL,
        // Reasoning models behind the proxy burn ~1k tokens thinking before
        // any text; 1024 returns an empty content array.
        max_tokens: Number(process.env.LLM_MAX_TOKENS ?? 4096),
        system,
        messages: [{ role: "user", content: user }]
      })
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };
    const text = payload.content?.find((block) => block.type === "text")?.text ?? "";
    const jsonStart = text.indexOf("{");
    const jsonEnd = text.lastIndexOf("}");
    if (jsonStart === -1 || jsonEnd === -1) return null;
    return JSON.parse(text.slice(jsonStart, jsonEnd + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

const ECON_LEFT = ["nationalise", "nationalisation", "public ownership", "redistribution", "welfare", "union", "rent control", "wealth tax", "free at the point of use", "subsidy", "social housing"];
const ECON_RIGHT = ["privatise", "privatisation", "deregulation", "free market", "tax cut", "competition", "enterprise", "investor", "market-led", "fiscal discipline"];
const AUTH = ["mandatory", "surveillance", "enforcement", "criminalise", "prohibit", "compulsory", "penalty", "police powers", "detention", "restriction", "offence"];
const LIB = ["liberty", "consent", "decriminalise", "privacy", "civil liberties", "freedom", "autonomy", "voluntary", "rights of the individual", "transparency"];

function lexiconScore(text: string, words: string[]) {
  const lower = text.toLowerCase();
  return words.reduce((sum, word) => sum + (lower.includes(word) ? 1 : 0), 0);
}

function heuristicCompass(text: string) {
  const left = lexiconScore(text, ECON_LEFT);
  const right = lexiconScore(text, ECON_RIGHT);
  const auth = lexiconScore(text, AUTH);
  const lib = lexiconScore(text, LIB);
  const clamp = (value: number) => Math.max(-10, Math.min(10, value));
  return {
    x: clamp((right - left) * 1.5),
    y: clamp((auth - lib) * 1.5),
    label: "heuristic lexicon estimate",
    rationale: `Lexicon hits — economic left ${left}, right ${right}; authoritarian ${auth}, libertarian ${lib}. Low-confidence placeholder until the LLM endpoint is reachable.`
  };
}

function heuristicSummary(text: string) {
  const sentences = text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .filter((sentence) => sentence.length > 40 && sentence.length < 400);
  return {
    summary: sentences.slice(0, 4).join(" ") || text.slice(0, 600),
    method: "extractive first-sentences"
  };
}

async function generate(request: AnalysisRequest): Promise<AnalysisResult> {
  if (request.kind === "summary") {
    const result = await callLlm(
      "You summarise UK parliamentary bills for the general public. Respond with JSON only: {\"summary\": string (plain English, 3-5 sentences, neutral), \"keyPoints\": string[]}.",
      request.text.slice(0, 30_000)
    );
    if (result) return { output: result, model: MODEL, confidence: 0.85 };
    return { output: heuristicSummary(request.text), model: "heuristic-extractive-v0", confidence: 0.3 };
  }

  if (request.kind === "compass") {
    const result = await callLlm(
      "You place UK political texts on the political compass. x: economic, -10 left to +10 right. y: -10 libertarian to +10 authoritarian. Respond with JSON only: {\"x\": number, \"y\": number, \"label\": string, \"rationale\": string}.",
      request.text.slice(0, 30_000)
    );
    if (result) return { output: result, model: MODEL, confidence: 0.8 };
    return { output: heuristicCompass(request.text), model: "heuristic-lexicon-v0", confidence: 0.25 };
  }

  throw new Error(`moderation analyses are generated by the moderation service`);
}

/**
 * Generate (or reuse) an analysis and persist full provenance: model, prompt
 * version, source hash, citations, confidence, review state.
 */
export async function analyzeAndStore(sql: Sql, request: AnalysisRequest) {
  const sourceHash = sha256(request.text);
  const [existing] = await sql`
    select id, output, model, confidence from ai_analyses
    where subject_type = ${request.subjectType}
      and subject_id = ${request.subjectId}
      and kind = ${request.kind}
      and source_hash = ${sourceHash}
      and prompt_version = ${PROMPT_VERSION}
    order by id desc limit 1
  `;
  if (existing) {
    return { id: existing.id as number, output: existing.output as Record<string, unknown>, model: existing.model as string, confidence: existing.confidence as number, reused: true };
  }

  const result = await generate(request);
  const [row] = await sql`
    insert into ai_analyses (subject_type, subject_id, kind, model, prompt_version, source_hash, output, citations, confidence)
    values (
      ${request.subjectType},
      ${request.subjectId},
      ${request.kind},
      ${result.model},
      ${PROMPT_VERSION},
      ${sourceHash},
      ${sql.json(result.output as never)},
      ${sql.json((request.citations ?? []) as never)},
      ${result.confidence}
    )
    returning id
  `;
  return { id: row.id as number, output: result.output, model: result.model, confidence: result.confidence, reused: false };
}

/** Store an externally produced classification (e.g. moderation) with provenance. */
export async function storeAnalysis(
  sql: Sql,
  request: Omit<AnalysisRequest, "citations"> & {
    output: Record<string, unknown>;
    model: string;
    confidence: number;
  }
) {
  const [row] = await sql`
    insert into ai_analyses (subject_type, subject_id, kind, model, prompt_version, source_hash, output, confidence)
    values (
      ${request.subjectType},
      ${request.subjectId},
      ${request.kind},
      ${request.model},
      ${PROMPT_VERSION},
      ${sha256(request.text)},
      ${sql.json(request.output as never)},
      ${request.confidence}
    )
    returning id
  `;
  return row.id as number;
}
