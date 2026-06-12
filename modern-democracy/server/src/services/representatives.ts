import type { Sql } from "postgres";

const MEMBERS_API = "https://members-api.parliament.uk/api";
const CACHE_TTL_MS = 7 * 24 * 3600 * 1000;

async function membersApi<T>(path: string): Promise<T | null> {
  try {
    const response = await fetch(`${MEMBERS_API}${path}`, {
      headers: { accept: "application/json" }
    });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

/** Searchable, filterable list of sitting MPs from the imported data. */
export async function listRepresentatives(
  sql: Sql,
  options: { search?: string; party?: string; skip?: number; take?: number }
) {
  const take = Math.min(options.take ?? 24, 100);
  const skip = options.skip ?? 0;
  const search = options.search ? `%${options.search.toLowerCase()}%` : null;
  const rows = await sql`
    with scored as (
      select distinct on (a.subject_id) (a.subject_id)::int as bill_id,
             (a.output->>'x')::float as x, (a.output->>'y')::float as y
      from ai_analyses a
      where a.subject_type = 'bill' and a.kind = 'compass' and a.output->>'x' is not null
      order by a.subject_id, a.id desc
    ),
    member_compass as (
      select dv.member_id,
             round(avg((case when dv.vote = 'aye' then 1 else -1 end) * s.x)::numeric, 2)::float as x,
             round(avg((case when dv.vote = 'aye' then 1 else -1 end) * s.y)::numeric, 2)::float as y,
             count(*)::int as sample
      from division_votes dv
      join divisions d on d.id = dv.division_id
      join scored s on s.bill_id = d.bill_id
      group by dv.member_id
    )
    select r.id, r.name, r.gender, r.thumbnail_url,
           p.name as party, p.abbreviation as party_abbreviation, p.background_colour as party_colour,
           c.id as constituency_id, c.name as constituency,
           (select count(*)::int from division_votes dv where dv.member_id = r.id) as division_votes,
           mc.x as compass_x, mc.y as compass_y, mc.sample as compass_sample,
           count(*) over ()::int as total
    from representatives r
    left join parties p on p.id = r.party_id
    left join constituencies c on c.id = r.constituency_id
    left join member_compass mc on mc.member_id = r.id
    where (${search}::text is null or lower(r.name) like ${search} or lower(c.name) like ${search})
      and (${options.party ?? null}::text is null or p.name = ${options.party ?? null})
    order by r.name
    limit ${take} offset ${skip}
  `;
  return {
    total: (rows[0]?.total as number) ?? 0,
    members: rows.map(({ total: _total, ...row }) => row)
  };
}

/**
 * Per-party summary: seats, division discipline (votes matching the party's
 * own majority on each division), and a revealed-preference compass position.
 */
export async function partySummaries(sql: Sql) {
  const parties = await sql`
    select p.id, p.name, p.abbreviation, p.background_colour,
           count(r.id)::int as seats
    from parties p
    join representatives r on r.party_id = p.id
    group by p.id, p.name, p.abbreviation, p.background_colour
    order by count(r.id) desc
  `;

  // Party majority per division, then each vote compared against it.
  const discipline = await sql`
    with party_division as (
      select r.party_id, dv.division_id,
             count(*) filter (where dv.vote = 'aye')::int as ayes,
             count(*) filter (where dv.vote = 'no')::int as noes
      from division_votes dv
      join representatives r on r.id = dv.member_id
      group by r.party_id, dv.division_id
    )
    select r.party_id,
           count(*)::int as votes,
           count(*) filter (
             where (dv.vote = 'aye' and pd.ayes >= pd.noes) or (dv.vote = 'no' and pd.noes > pd.ayes)
           )::int as with_party
    from division_votes dv
    join representatives r on r.id = dv.member_id
    join party_division pd on pd.party_id = r.party_id and pd.division_id = dv.division_id
    group by r.party_id
  `;
  const disciplineByParty = new Map(discipline.map((row) => [row.party_id as number, row]));

  const compass = await partyCompassPositions(sql);

  return parties.map((party) => {
    const d = disciplineByParty.get(party.id as number);
    return {
      id: party.id,
      name: party.name,
      abbreviation: party.abbreviation,
      colour: party.background_colour,
      seats: party.seats,
      discipline: d && (d.votes as number) > 0
        ? Math.round(((d.with_party as number) / (d.votes as number)) * 100)
        : null,
      compass: compass.get(party.id as number) ?? null
    };
  });
}

async function compassScoredBills(sql: Sql) {
  const rows = await sql`
    select distinct on (a.subject_id) (a.subject_id)::int as bill_id,
           (a.output->>'x')::float as x, (a.output->>'y')::float as y
    from ai_analyses a
    where a.subject_type = 'bill' and a.kind = 'compass' and a.output->>'x' is not null
    order by a.subject_id, a.id desc
  `;
  return new Map(rows.map((row) => [row.bill_id as number, { x: row.x as number, y: row.y as number }]));
}

async function partyCompassPositions(sql: Sql) {
  const bills = await compassScoredBills(sql);
  if (bills.size === 0) return new Map<number, { x: number; y: number; sample: number }>();
  const votes = await sql`
    select r.party_id, d.bill_id, dv.vote
    from division_votes dv
    join representatives r on r.id = dv.member_id
    join divisions d on d.id = dv.division_id
    where d.bill_id in ${sql([...bills.keys()])}
  `;
  const sums = new Map<number, { x: number; y: number; n: number }>();
  for (const row of votes) {
    const bill = bills.get(row.bill_id as number)!;
    const sign = row.vote === "aye" ? 1 : -1;
    const entry = sums.get(row.party_id as number) ?? { x: 0, y: 0, n: 0 };
    entry.x += sign * bill.x;
    entry.y += sign * bill.y;
    entry.n += 1;
    sums.set(row.party_id as number, entry);
  }
  return new Map(
    [...sums.entries()].map(([partyId, sum]) => [
      partyId,
      {
        x: Math.round((sum.x / sum.n) * 100) / 100,
        y: Math.round((sum.y / sum.n) * 100) / 100,
        sample: sum.n
      }
    ])
  );
}

type MemberProfileCache = {
  synopsis: string | null;
  membership_start: string | null;
  biography: unknown;
  latest_election: unknown;
};

/** Lazy-fetch + cache the rich Members API data for one MP. */
async function memberProfileCached(sql: Sql, memberId: number): Promise<MemberProfileCache | null> {
  const [cached] = await sql`
    select synopsis, membership_start, biography, latest_election, fetched_at
    from member_profiles where member_id = ${memberId}
  `;
  if (cached && Date.now() - new Date(cached.fetched_at as string).getTime() < CACHE_TTL_MS) {
    return cached as unknown as MemberProfileCache;
  }

  const [core, synopsis, biography, election] = await Promise.all([
    membersApi<{ value?: { latestHouseMembership?: { membershipStartDate?: string } } }>(
      `/Members/${memberId}`
    ),
    membersApi<{ value?: string }>(`/Members/${memberId}/Synopsis`),
    membersApi<{ value?: unknown }>(`/Members/${memberId}/Biography`),
    membersApi<{ value?: unknown }>(`/Members/${memberId}/LatestElectionResult`)
  ]);
  if (!core && !synopsis && cached) return cached as unknown as MemberProfileCache;

  const cleanSynopsis = synopsis?.value
    ? synopsis.value.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim()
    : null;
  const membershipStart =
    core?.value?.latestHouseMembership?.membershipStartDate?.slice(0, 10) ?? null;

  const [row] = await sql`
    insert into member_profiles (member_id, synopsis, membership_start, biography, latest_election, fetched_at)
    values (
      ${memberId}, ${cleanSynopsis}, ${membershipStart},
      ${sql.json((biography?.value ?? null) as never)},
      ${sql.json((election?.value ?? null) as never)}, now()
    )
    on conflict (member_id) do update set
      synopsis = excluded.synopsis, membership_start = excluded.membership_start,
      biography = excluded.biography, latest_election = excluded.latest_election,
      fetched_at = now()
    returning synopsis, membership_start, biography, latest_election
  `;
  return row as unknown as MemberProfileCache;
}

/** Full MP detail: profile, voting stats, rebellion rate, compass, elections. */
export async function representativeDetail(sql: Sql, memberId: number) {
  const [member] = await sql`
    select r.id, r.name, r.gender, r.thumbnail_url, r.constituency_id,
           p.id as party_id, p.name as party, p.abbreviation as party_abbreviation,
           p.background_colour as party_colour,
           c.name as constituency
    from representatives r
    left join parties p on p.id = r.party_id
    left join constituencies c on c.id = r.constituency_id
    where r.id = ${memberId}
  `;
  if (!member) return null;

  const profile = await memberProfileCached(sql, memberId);

  // Voting record + party-line comparison.
  const record = await sql`
    with party_division as (
      select dv.division_id,
             count(*) filter (where dv.vote = 'aye')::int as ayes,
             count(*) filter (where dv.vote = 'no')::int as noes
      from division_votes dv
      join representatives r on r.id = dv.member_id
      where r.party_id = ${member.party_id ?? 0}
      group by dv.division_id
    )
    select d.id, d.title, d.date, d.aye_count, d.no_count, d.bill_id, dv.vote,
           b.short_title as bill_title,
           case when pd.ayes >= pd.noes then 'aye' else 'no' end as party_majority
    from division_votes dv
    join divisions d on d.id = dv.division_id
    left join bills b on b.id = d.bill_id
    left join party_division pd on pd.division_id = dv.division_id
    where dv.member_id = ${memberId}
    order by d.date desc
  `;
  const rebellions = record.filter((row) => row.party_majority && row.vote !== row.party_majority);

  // Personal compass from votes on compass-scored bills.
  const bills = await compassScoredBills(sql);
  const compassPoints = record
    .filter((row) => row.bill_id && bills.has(row.bill_id as number))
    .map((row) => {
      const bill = bills.get(row.bill_id as number)!;
      const sign = row.vote === "aye" ? 1 : -1;
      return { x: sign * bill.x, y: sign * bill.y };
    });
  const compass =
    compassPoints.length > 0
      ? {
          x: Math.round((compassPoints.reduce((s, p) => s + p.x, 0) / compassPoints.length) * 100) / 100,
          y: Math.round((compassPoints.reduce((s, p) => s + p.y, 0) / compassPoints.length) * 100) / 100,
          sample: compassPoints.length
        }
      : null;

  // Party position as a proxy when the MP has no personal scored votes yet —
  // the client labels which one it is showing.
  const partyPositions = await partyCompassPositions(sql);
  const partyCompass = member.party_id
    ? partyPositions.get(member.party_id as number) ?? null
    : null;

  return {
    member: {
      id: member.id,
      name: member.name,
      gender: member.gender,
      thumbnailUrl: member.thumbnail_url,
      party: member.party,
      partyAbbreviation: member.party_abbreviation,
      partyColour: member.party_colour,
      constituencyId: member.constituency_id,
      constituency: member.constituency,
      memberSince: profile?.membership_start ?? null,
      synopsis: profile?.synopsis ?? null
    },
    biography: profile?.biography ?? null,
    latestElection: profile?.latest_election ?? null,
    stats: {
      divisionsVoted: record.length,
      rebellions: rebellions.length,
      partyLinePercent:
        record.length > 0
          ? Math.round(((record.length - rebellions.length) / record.length) * 100)
          : null
    },
    compass,
    partyCompass,
    votingRecord: record.slice(0, 25).map((row) => ({
      divisionId: row.id,
      title: row.title,
      date: row.date,
      vote: row.vote,
      ayeCount: row.aye_count,
      noCount: row.no_count,
      billId: row.bill_id,
      billTitle: row.bill_title,
      rebelled: row.party_majority != null && row.vote !== row.party_majority
    }))
  };
}

type ElectionResult = {
  electionDate?: string;
  electionTitle?: string;
  result?: string;
  winningParty?: { name?: string; backgroundColour?: string; abbreviation?: string } | null;
  electorate?: number;
  turnout?: number;
  majority?: number;
  isGeneralElection?: boolean;
  constituencyName?: string;
};

/**
 * Election history for a constituency over time. 2024 boundary changes gave
 * most seats fresh ids with a single election, so same-named historic
 * constituency ids are merged in to recover the longer timeline.
 */
export async function constituencyElections(sql: Sql, constituencyId: number) {
  const [cached] = await sql`
    select elections, fetched_at from constituency_election_cache
    where constituency_id = ${constituencyId}
  `;
  if (cached && Date.now() - new Date(cached.fetched_at as string).getTime() < CACHE_TTL_MS) {
    return cached.elections as ElectionResult[];
  }

  const [constituency] = await sql`
    select name from constituencies where id = ${constituencyId}
  `;
  if (!constituency) return [];

  const search = await membersApi<{
    items?: Array<{ value?: { id?: number; name?: string } }>;
  }>(`/Location/Constituency/Search?searchText=${encodeURIComponent(constituency.name as string)}&skip=0&take=10`);

  const matchingIds = (search?.items ?? [])
    .map((item) => item.value)
    .filter(
      (value): value is { id: number; name: string } =>
        value?.id != null &&
        (value.name ?? "").toLowerCase() === (constituency.name as string).toLowerCase()
    )
    .map((value) => value.id);
  if (!matchingIds.includes(constituencyId)) matchingIds.push(constituencyId);

  const merged: ElectionResult[] = [];
  for (const id of matchingIds) {
    const results = await membersApi<{ value?: ElectionResult[] }>(
      `/Location/Constituency/${id}/ElectionResults`
    );
    for (const result of results?.value ?? []) {
      merged.push({
        electionDate: result.electionDate,
        electionTitle: result.electionTitle,
        result: result.result,
        winningParty: result.winningParty
          ? {
              name: result.winningParty.name,
              backgroundColour: result.winningParty.backgroundColour,
              abbreviation: result.winningParty.abbreviation
            }
          : null,
        electorate: result.electorate,
        turnout: result.turnout,
        majority: result.majority,
        isGeneralElection: result.isGeneralElection
      });
    }
  }
  merged.sort((a, b) => (b.electionDate ?? "").localeCompare(a.electionDate ?? ""));
  // Dedupe same-date entries that appear under both old and new ids.
  const seen = new Set<string>();
  const deduped = merged.filter((entry) => {
    const key = entry.electionDate ?? "";
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  await sql`
    insert into constituency_election_cache (constituency_id, elections, fetched_at)
    values (${constituencyId}, ${sql.json(deduped as never)}, now())
    on conflict (constituency_id) do update set elections = excluded.elections, fetched_at = now()
  `;
  return deduped;
}
