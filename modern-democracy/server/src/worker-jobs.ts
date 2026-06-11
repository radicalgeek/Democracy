import { sql } from "./db.js";
import { analyzeAndStore } from "./services/ai.js";
import { castBallot, createSession, issueCredential, runCheckpoint } from "./services/integrity.js";
import { rebuildSeatBindings } from "./services/mapping.js";
import { importDivisions } from "./services/divisions.js";
import { analyzePetitions, importPetitions } from "./services/petitions.js";
import {
  importBills,
  importBillTexts,
  importConstituenciesAndMembers
} from "./services/parliament.js";

export async function runFullImport() {
  const constituencies = await importConstituenciesAndMembers(sql);
  const bills = await importBills(sql);
  const texts = await importBillTexts(sql);
  const divisions = await importDivisions(sql);
  const petitions = await importPetitions(sql);
  const bindings = await rebuildSeatBindings(sql);
  const analyses = await analyzeImportedBills();
  const petitionAnalyses = await analyzePetitions(sql);
  return { constituencies, bills, texts, divisions, petitions, bindings, analyses, petitionAnalyses };
}

/** Generate summary + compass (with provenance) for bills that have source text. */
export async function analyzeImportedBills() {
  const bills = await sql`
    select b.id, b.short_title, b.long_title, b.source_url,
           t.text_content, t.source_url as text_url, t.title as text_title
    from bills b
    left join lateral (
      select text_content, source_url, title from bill_texts
      where bill_id = b.id and text_content is not null
      order by id limit 1
    ) t on true
    order by exists (select 1 from divisions d where d.bill_id = b.id) desc,
             b.last_updated desc nulls last
    limit 12
  `;

  let generated = 0;
  for (const bill of bills) {
    const sourceText =
      (bill.text_content as string | null) ?? `${bill.short_title}. ${bill.long_title ?? ""}`;
    if (sourceText.trim().length < 20) continue;
    const citations = [
      { label: "Bill page", url: bill.source_url as string },
      ...(bill.text_url
        ? [{ label: (bill.text_title as string) ?? "Source text", url: bill.text_url as string }]
        : [])
    ];
    const summary = await analyzeAndStore(sql, {
      subjectType: "bill",
      subjectId: String(bill.id),
      kind: "summary",
      text: sourceText,
      citations
    });
    const compass = await analyzeAndStore(sql, {
      subjectType: "bill",
      subjectId: String(bill.id),
      kind: "compass",
      text: sourceText,
      citations
    });
    if (!summary.reused || !compass.reused) generated += 1;
  }
  return { billsAnalyzed: bills.length, generated };
}

/**
 * Optional demo seeding (DEMO_SEED=true): exercises the REAL pipeline —
 * session → credential → anonymous ballot → checkpoint — with clearly
 * labelled demo users, so the map and aggregates show genuine
 * aggregate-driven data instead of hash colours. Never fabricates rows
 * directly in ballot tables.
 */
export async function seedDemoBallots() {
  const [{ count: existing }] = await sql`
    select count(*)::int as count from users where is_demo
  `;
  if ((existing as number) > 0) return { seeded: 0, skipped: true };

  const bills = await sql`
    select id from bills order by last_updated desc nulls last limit 2
  `;
  const constituencies = await sql`
    select distinct c.id from constituencies c
    join svg_seat_bindings sb on sb.constituency_id = c.id
    order by c.id limit 60
  `;
  if (bills.length === 0 || constituencies.length === 0) return { seeded: 0, skipped: true };

  const choices = ["for", "for", "for", "against", "against", "abstain"] as const;
  let seeded = 0;

  for (const bill of bills) {
    for (const [index, constituency] of constituencies.entries()) {
      // 5-8 ballots per constituency so slices clear the privacy threshold
      const ballots = 5 + ((index * 7 + (bill.id as number)) % 4);
      for (let i = 0; i < ballots; i += 1) {
        const session = await createSession(
          sql,
          `Demo citizen ${seeded + 1}`,
          constituency.id as number,
          true
        );
        const issued = await issueCredential(
          sql,
          session.userId,
          bill.id as number,
          constituency.id as number
        );
        if ("error" in issued) continue;
        const choice = choices[(index + i + (bill.id as number)) % choices.length];
        await castBallot(sql, bill.id as number, issued.credential, choice);
        seeded += 1;
      }
    }
    await runCheckpoint(sql, bill.id as number);
  }
  return { seeded, skipped: false };
}

/**
 * Second demo-seed pass: division-linked bills are what power the MP-alignment
 * comparison, so make sure a couple of them have civic ballots. Same rules as
 * seedDemoBallots — labelled demo users, real credential→ballot pipeline only.
 */
export async function seedDivisionBallots() {
  const bills = await sql`
    select distinct d.bill_id as id from divisions d
    where d.bill_id is not null
      and not exists (select 1 from anonymous_ballots ab where ab.bill_id = d.bill_id)
    order by d.bill_id desc
    limit 2
  `;
  if (bills.length === 0) return { seeded: 0, skipped: true };

  const constituencies = await sql`
    select distinct c.id from constituencies c
    join svg_seat_bindings sb on sb.constituency_id = c.id
    order by c.id limit 60
  `;
  const choices = ["for", "for", "for", "against", "against", "abstain"] as const;
  let seeded = 0;

  for (const bill of bills) {
    for (const [index, constituency] of constituencies.entries()) {
      const ballots = 5 + ((index * 7 + (bill.id as number)) % 4);
      for (let i = 0; i < ballots; i += 1) {
        const session = await createSession(
          sql,
          `Demo citizen d${seeded + 1}`,
          constituency.id as number,
          true
        );
        const issued = await issueCredential(
          sql,
          session.userId,
          bill.id as number,
          constituency.id as number
        );
        if ("error" in issued) continue;
        const choice = choices[(index + i + (bill.id as number)) % choices.length];
        await castBallot(sql, bill.id as number, issued.credential, choice);
        seeded += 1;
      }
    }
    await runCheckpoint(sql, bill.id as number);
  }
  return { seeded, skipped: false };
}

export async function checkpointAllBills() {
  const bills = await sql`select distinct bill_id from anonymous_ballots`;
  let published = 0;
  for (const bill of bills) {
    const result = await runCheckpoint(sql, bill.bill_id as number);
    if (result) published += 1;
  }
  return { published };
}
