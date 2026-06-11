import type { Sql } from "postgres";

const VOTES_API = "https://commonsvotes-api.parliament.uk/data";

type DivisionSummary = {
  DivisionId: number;
  Date: string;
  Number: number;
  Title: string;
  AyeCount: number;
  NoCount: number;
};

type DivisionDetail = DivisionSummary & {
  Ayes: Array<{ MemberId: number }>;
  Noes: Array<{ MemberId: number }>;
};

/**
 * Link a division to a bill by title convention: division titles for bill
 * stages read "Some Bill: Third Reading" / "Some Bill: Report Stage...".
 * Motions and humble addresses have no bill — bill_id stays null.
 */
async function matchBill(sql: Sql, title: string): Promise<number | null> {
  const prefix = title.split(":")[0]?.trim();
  if (!prefix || !/bill/i.test(prefix)) return null;
  const [bill] = await sql`
    select id from bills where lower(short_title) = ${prefix.toLowerCase()} limit 1
  `;
  if (bill) return bill.id as number;
  const [fuzzy] = await sql`
    select id from bills
    where lower(${prefix.toLowerCase()}) like '%' || lower(short_title) || '%'
    order by length(short_title) desc limit 1
  `;
  return (fuzzy?.id as number) ?? null;
}

/** Import the most recent Commons divisions with full per-MP vote lists. */
export async function importDivisions(sql: Sql, take = 50) {
  const [run] = await sql`
    insert into data_import_runs (kind) values ('divisions') returning id
  `;
  try {
    const response = await fetch(
      `${VOTES_API}/divisions.json/search?queryParameters.take=${take}`,
      { headers: { accept: "application/json" } }
    );
    if (!response.ok) throw new Error(`divisions search returned ${response.status}`);
    const summaries = (await response.json()) as DivisionSummary[];

    let imported = 0;
    let votesStored = 0;
    for (const summary of summaries) {
      const [existing] = await sql`
        select id from divisions where id = ${summary.DivisionId}
      `;
      const billId = await matchBill(sql, summary.Title);
      await sql`
        insert into divisions (id, title, date, number, aye_count, no_count, bill_id)
        values (
          ${summary.DivisionId}, ${summary.Title}, ${summary.Date}, ${summary.Number},
          ${summary.AyeCount}, ${summary.NoCount}, ${billId}
        )
        on conflict (id) do update set
          title = excluded.title, aye_count = excluded.aye_count,
          no_count = excluded.no_count, bill_id = excluded.bill_id
      `;
      if (existing) continue; // vote lists are immutable once published

      const detailResponse = await fetch(`${VOTES_API}/division/${summary.DivisionId}.json`, {
        headers: { accept: "application/json" }
      });
      if (!detailResponse.ok) continue;
      const detail = (await detailResponse.json()) as DivisionDetail;
      const rows = [
        ...(detail.Ayes ?? []).map((m) => ({ memberId: m.MemberId, vote: "aye" as const })),
        ...(detail.Noes ?? []).map((m) => ({ memberId: m.MemberId, vote: "no" as const }))
      ];
      for (const row of rows) {
        await sql`
          insert into division_votes (division_id, member_id, vote)
          values (${summary.DivisionId}, ${row.memberId}, ${row.vote})
          on conflict do nothing
        `;
      }
      votesStored += rows.length;
      imported += 1;
    }

    await sql`
      update data_import_runs
      set status = 'succeeded', finished_at = now(),
          detail = ${sql.json({ divisions: summaries.length, newDetails: imported, votesStored })}
      where id = ${run.id}
    `;
    return { divisions: summaries.length, newDetails: imported, votesStored };
  } catch (error) {
    await sql`
      update data_import_runs
      set status = 'failed', finished_at = now(),
          detail = ${sql.json({ error: error instanceof Error ? error.message : "unknown" })}
      where id = ${run.id}
    `;
    return { divisions: 0, newDetails: 0, votesStored: 0 };
  }
}

const PRIVACY_THRESHOLD = Number(process.env.PRIVACY_THRESHOLD ?? 5);

/**
 * Everything the "My MP" surface needs for one constituency: the MP, their
 * recent division record, civic votes cast in this constituency, and an
 * MP-vs-constituency alignment score over bills that have both a division
 * and enough civic ballots to publish.
 */
export async function constituencyProfile(sql: Sql, constituencyId: number) {
  const [constituency] = await sql`
    select id, name from constituencies where id = ${constituencyId}
  `;
  if (!constituency) return null;

  const [mp] = await sql`
    select r.id, r.name, r.thumbnail_url, p.name as party, p.abbreviation, p.background_colour
    from representatives r
    left join parties p on p.id = r.party_id
    where r.constituency_id = ${constituencyId}
    limit 1
  `;

  const votingRecord = mp
    ? await sql`
        select d.id, d.title, d.date, d.aye_count, d.no_count, d.bill_id, dv.vote,
               b.short_title as bill_title
        from division_votes dv
        join divisions d on d.id = dv.division_id
        left join bills b on b.id = d.bill_id
        where dv.member_id = ${mp.id}
        order by d.date desc
        limit 25
      `
    : [];

  // Civic ballots cast in this constituency, by bill (suppress small slices).
  const civicVotes = await sql`
    select ab.bill_id, b.short_title,
           count(*) filter (where choice = 'for')::int as for_count,
           count(*) filter (where choice = 'against')::int as against_count,
           count(*) filter (where choice = 'abstain')::int as abstain_count,
           count(*)::int as total
    from anonymous_ballots ab
    join bills b on b.id = ab.bill_id
    where ab.constituency_id = ${constituencyId}
    group by ab.bill_id, b.short_title
    having count(*) >= ${PRIVACY_THRESHOLD}
    order by count(*) desc
  `;

  // National civic majorities for the same comparison when the local slice is
  // too small to publish.
  const nationalVotes = await sql`
    select bill_id,
           count(*) filter (where choice = 'for')::int as for_count,
           count(*) filter (where choice = 'against')::int as against_count,
           count(*)::int as total
    from anonymous_ballots
    group by bill_id
  `;

  // Alignment: for each division linked to a bill, compare the MP's aye/no
  // with the civic majority (constituency first, national as fallback).
  type Comparison = {
    divisionId: number;
    billId: number;
    billTitle: string | null;
    divisionTitle: string;
    mpVote: string;
    constituencyMajority: string | null;
    nationalMajority: string | null;
    scope: "constituency" | "national";
    matched: boolean;
  };
  const comparisons: Comparison[] = [];
  if (mp) {
    const localByBill = new Map(civicVotes.map((row) => [row.bill_id as number, row]));
    const nationalByBill = new Map(nationalVotes.map((row) => [row.bill_id as number, row]));
    for (const record of votingRecord) {
      const billId = record.bill_id as number | null;
      if (!billId) continue;
      const local = localByBill.get(billId);
      const national = nationalByBill.get(billId);
      const slice = local ?? national;
      if (!slice || (slice.total as number) < PRIVACY_THRESHOLD) continue;
      const majority =
        (slice.for_count as number) > (slice.against_count as number)
          ? "for"
          : (slice.against_count as number) > (slice.for_count as number)
            ? "against"
            : null;
      if (!majority) continue;
      const mpChoice = record.vote === "aye" ? "for" : "against";
      comparisons.push({
        divisionId: record.id as number,
        billId,
        billTitle: (record.bill_title as string) ?? null,
        divisionTitle: record.title as string,
        mpVote: mpChoice,
        constituencyMajority: local ? majority : null,
        nationalMajority: national && !local ? majority : null,
        scope: local ? "constituency" : "national",
        matched: mpChoice === majority
      });
    }
  }
  const matched = comparisons.filter((item) => item.matched).length;

  const [participation] = await sql`
    select count(*)::int as ballots from anonymous_ballots where constituency_id = ${constituencyId}
  `;

  return {
    constituency: { id: constituency.id, name: constituency.name },
    mp: mp
      ? {
          id: mp.id,
          name: mp.name,
          party: mp.party,
          partyAbbreviation: mp.abbreviation,
          partyColour: mp.background_colour,
          thumbnailUrl: mp.thumbnail_url
        }
      : null,
    votingRecord: votingRecord.map((row) => ({
      divisionId: row.id,
      title: row.title,
      date: row.date,
      vote: row.vote,
      ayeCount: row.aye_count,
      noCount: row.no_count,
      billId: row.bill_id,
      billTitle: row.bill_title
    })),
    civicVotes: civicVotes.map((row) => ({
      billId: row.bill_id,
      billTitle: row.short_title,
      for: row.for_count,
      against: row.against_count,
      abstain: row.abstain_count,
      total: row.total
    })),
    alignment: {
      compared: comparisons.length,
      matched,
      percent: comparisons.length ? Math.round((matched / comparisons.length) * 100) : null,
      comparisons
    },
    participation: { ballots: participation.ballots, privacyThreshold: PRIVACY_THRESHOLD }
  };
}
