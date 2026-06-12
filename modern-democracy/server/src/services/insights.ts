import type { Sql } from "postgres";

const PRIVACY_THRESHOLD = Number(process.env.PRIVACY_THRESHOLD ?? 5);

/**
 * Where each news outlet sits on the compass, derived from the mean of its
 * compass-scored coverage. The per-article scores judge the framing of a
 * headline and summary, so the outlet mean reads as "editorial lean as
 * expressed in recent politics coverage" — not a claim about the outlet
 * overall.
 */
export async function mediaCompass(sql: Sql) {
  const outlets = await sql`
    with latest as (
      select distinct on (subject_id) subject_id,
             (output->>'x')::float as x, (output->>'y')::float as y
      from ai_analyses
      where subject_type = 'news_item' and kind = 'compass' and output->>'x' is not null
      order by subject_id, id desc
    )
    select s.name, count(*)::int as sample,
           round(avg(l.x)::numeric, 2)::float as x,
           round(avg(l.y)::numeric, 2)::float as y
    from latest l
    join news_items n on n.id = (l.subject_id)::int
    join news_sources s on s.id = n.source_id
    group by s.name
    having count(*) >= 3
    order by count(*) desc
  `;
  const [overall] = await sql`
    with latest as (
      select distinct on (subject_id) subject_id,
             (output->>'x')::float as x, (output->>'y')::float as y
      from ai_analyses
      where subject_type = 'news_item' and kind = 'compass' and output->>'x' is not null
      order by subject_id, id desc
    )
    select count(*)::int as sample,
           round(avg(x)::numeric, 2)::float as x,
           round(avg(y)::numeric, 2)::float as y
    from latest
  `;
  return {
    outlets: outlets.map((row) => ({
      name: row.name as string,
      x: row.x as number,
      y: row.y as number,
      sample: row.sample as number
    })),
    overall:
      overall && (overall.sample as number) > 0
        ? { x: overall.x as number, y: overall.y as number, sample: overall.sample as number }
        : null
  };
}

/**
 * Per-bill civic majorities, nationally and for one constituency, so the
 * client can compare the user's own (device-only) choices against both.
 * Constituency slices below the privacy threshold are withheld, same rule as
 * every other published aggregate.
 */
export async function ballotMajorities(sql: Sql, constituencyId: number | null) {
  const rows = await sql`
    select ab.bill_id, b.short_title,
           count(*) filter (where ab.choice = 'for')::int as nat_for,
           count(*) filter (where ab.choice = 'against')::int as nat_against,
           count(*)::int as nat_total,
           count(*) filter (where ab.choice = 'for' and ab.constituency_id = ${constituencyId ?? -1})::int as local_for,
           count(*) filter (where ab.choice = 'against' and ab.constituency_id = ${constituencyId ?? -1})::int as local_against,
           count(*) filter (where ab.constituency_id = ${constituencyId ?? -1})::int as local_total
    from anonymous_ballots ab
    join bills b on b.id = ab.bill_id
    group by ab.bill_id, b.short_title
    order by count(*) desc
  `;
  return {
    privacyThreshold: PRIVACY_THRESHOLD,
    majorities: rows.map((row) => ({
      billId: row.bill_id as number,
      billTitle: row.short_title as string,
      national: {
        for: row.nat_for as number,
        against: row.nat_against as number,
        total: row.nat_total as number
      },
      constituency:
        (row.local_total as number) >= PRIVACY_THRESHOLD
          ? {
              for: row.local_for as number,
              against: row.local_against as number,
              total: row.local_total as number
            }
          : null
    }))
  };
}

/**
 * Revealed-preference compass lean per constituency: the mean of signed bill
 * compass vectors over civic-ballot majorities (same approximation as
 * compassComparison), plus total participation. Powers map shading.
 */
export async function constituencyLeans(sql: Sql) {
  const scoredBills = await sql`
    select distinct on (a.subject_id) (a.subject_id)::int as bill_id,
           (a.output->>'x')::float as x, (a.output->>'y')::float as y
    from ai_analyses a
    where a.subject_type = 'bill' and a.kind = 'compass' and a.output->>'x' is not null
    order by a.subject_id, a.id desc
  `;
  const compassByBill = new Map(
    scoredBills.map((row) => [row.bill_id as number, { x: row.x as number, y: row.y as number }])
  );

  const slices = await sql`
    select constituency_id, bill_id,
           count(*) filter (where choice = 'for')::int as for_count,
           count(*) filter (where choice = 'against')::int as against_count,
           count(*)::int as total
    from anonymous_ballots
    where constituency_id is not null
    group by constituency_id, bill_id
  `;

  type Accumulator = { ballots: number; x: number; y: number; sample: number };
  const bySeat = new Map<number, Accumulator>();
  for (const row of slices) {
    const seatId = row.constituency_id as number;
    const entry = bySeat.get(seatId) ?? { ballots: 0, x: 0, y: 0, sample: 0 };
    entry.ballots += row.total as number;
    const bill = compassByBill.get(row.bill_id as number);
    if (
      bill &&
      (row.total as number) >= PRIVACY_THRESHOLD &&
      (row.for_count as number) !== (row.against_count as number)
    ) {
      const sign = (row.for_count as number) > (row.against_count as number) ? 1 : -1;
      entry.x += sign * bill.x;
      entry.y += sign * bill.y;
      entry.sample += 1;
    }
    bySeat.set(seatId, entry);
  }

  return {
    privacyThreshold: PRIVACY_THRESHOLD,
    leans: [...bySeat.entries()].map(([constituencyId, entry]) => ({
      constituencyId,
      ballots: entry.ballots,
      lean:
        entry.sample > 0
          ? {
              x: Math.round((entry.x / entry.sample) * 100) / 100,
              y: Math.round((entry.y / entry.sample) * 100) / 100,
              sample: entry.sample
            }
          : null
    }))
  };
}

/**
 * The direction of the country, from everything the platform stores:
 *  - civicWill: mean signed compass vector of bill/petition positions, signed
 *    by how people actually voted on them (national civic majorities);
 *  - discussion: the same subjects weighted by debate activity and signed by
 *    the stance balance of the posts — where the conversation is pushing;
 *  - media: average outlet coverage position (influence on the narrative);
 *  - government: the governing party's revealed position plus the mean
 *    position of current legislation — the direction it is taking things;
 *  - parties: every major party's revealed position from division votes.
 */
export async function nationalCompass(sql: Sql) {
  const scoredBills = await sql`
    select distinct on (a.subject_id) (a.subject_id)::int as bill_id,
           (a.output->>'x')::float as x, (a.output->>'y')::float as y
    from ai_analyses a
    where a.subject_type = 'bill' and a.kind = 'compass' and a.output->>'x' is not null
    order by a.subject_id, a.id desc
  `;
  const billVectors = new Map(
    scoredBills.map((row) => [row.bill_id as number, { x: row.x as number, y: row.y as number }])
  );
  const scoredPetitions = await sql`
    select distinct on (a.subject_id) (a.subject_id)::int as petition_id,
           (a.output->>'x')::float as x, (a.output->>'y')::float as y
    from ai_analyses a
    where a.subject_type = 'petition' and a.kind = 'compass' and a.output->>'x' is not null
    order by a.subject_id, a.id desc
  `;
  const petitionVectors = new Map(
    scoredPetitions.map((row) => [row.petition_id as number, { x: row.x as number, y: row.y as number }])
  );

  // --- Civic will: votes on bills and petitions, signed by majority ---
  const billTallies = await sql`
    select bill_id,
           count(*) filter (where choice = 'for')::int as for_count,
           count(*) filter (where choice = 'against')::int as against_count,
           count(*)::int as total
    from anonymous_ballots group by bill_id
  `;
  const petitionTallies = await sql`
    select petition_id,
           count(*) filter (where choice = 'for')::int as for_count,
           count(*) filter (where choice = 'against')::int as against_count,
           count(*)::int as total
    from petition_votes group by petition_id
  `;
  const willPoints: Array<{ x: number; y: number }> = [];
  for (const row of billTallies) {
    const vector = billVectors.get(row.bill_id as number);
    if (!vector || (row.total as number) < PRIVACY_THRESHOLD) continue;
    if ((row.for_count as number) === (row.against_count as number)) continue;
    const sign = (row.for_count as number) > (row.against_count as number) ? 1 : -1;
    willPoints.push({ x: sign * vector.x, y: sign * vector.y });
  }
  for (const row of petitionTallies) {
    const vector = petitionVectors.get(row.petition_id as number);
    if (!vector || (row.total as number) < PRIVACY_THRESHOLD) continue;
    if ((row.for_count as number) === (row.against_count as number)) continue;
    const sign = (row.for_count as number) > (row.against_count as number) ? 1 : -1;
    willPoints.push({ x: sign * vector.x, y: sign * vector.y });
  }
  const mean = (points: Array<{ x: number; y: number }>, weights?: number[]) => {
    if (points.length === 0) return null;
    const totalWeight = weights ? weights.reduce((sum, w) => sum + w, 0) : points.length;
    if (totalWeight === 0) return null;
    const sumX = points.reduce((sum, p, i) => sum + p.x * (weights ? weights[i] : 1), 0);
    const sumY = points.reduce((sum, p, i) => sum + p.y * (weights ? weights[i] : 1), 0);
    return {
      x: Math.round((sumX / totalWeight) * 100) / 100,
      y: Math.round((sumY / totalWeight) * 100) / 100,
      sample: points.length
    };
  };
  const civicWill = mean(willPoints);

  // --- Discussion: debate-post stance balance per subject, weighted by activity ---
  const postStances = await sql`
    select bill_id, petition_id,
           count(*) filter (where stance = 'for')::int as for_count,
           count(*) filter (where stance = 'against')::int as against_count,
           count(*)::int as total
    from debate_posts
    where moderation_state not in ('hidden', 'blocked')
    group by bill_id, petition_id
  `;
  const discussionPoints: Array<{ x: number; y: number }> = [];
  const discussionWeights: number[] = [];
  for (const row of postStances) {
    const vector = row.bill_id
      ? billVectors.get(row.bill_id as number)
      : row.petition_id
        ? petitionVectors.get(row.petition_id as number)
        : null;
    if (!vector) continue;
    if ((row.for_count as number) === (row.against_count as number)) continue;
    const sign = (row.for_count as number) > (row.against_count as number) ? 1 : -1;
    discussionPoints.push({ x: sign * vector.x, y: sign * vector.y });
    discussionWeights.push(row.total as number);
  }
  const discussion = mean(discussionPoints, discussionWeights);

  // --- Media influence: average coverage position ---
  const media = await mediaCompass(sql);

  // --- Government: governing party position + direction of current legislation ---
  const { partySummaries } = await import("./representatives.js");
  const parties = await partySummaries(sql);
  const major = parties
    .filter((party) => party.compass != null && party.seats >= 3)
    .map((party) => ({
      name: party.name,
      abbreviation: party.abbreviation,
      colour: party.colour,
      seats: party.seats,
      compass: party.compass
    }));
  const governing = [...parties].sort((a, b) => b.seats - a.seats)[0] ?? null;

  const recentBills = await sql`
    select id from bills order by last_updated desc nulls last limit 20
  `;
  const legislationPoints = recentBills
    .map((row) => billVectors.get(row.id as number))
    .filter((vector): vector is { x: number; y: number } => Boolean(vector));
  const legislation = mean(legislationPoints);

  return {
    civicWill,
    discussion,
    media: { overall: media.overall, outlets: media.outlets.slice(0, 6) },
    government: governing
      ? {
          party: {
            name: governing.name,
            abbreviation: governing.abbreviation,
            colour: governing.colour,
            seats: governing.seats,
            compass: governing.compass
          },
          legislation
        }
      : null,
    parties: major,
    generatedAt: new Date().toISOString()
  };
}
