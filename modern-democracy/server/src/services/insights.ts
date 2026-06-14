import type { Sql } from "postgres";
import { MEDIA_FEEDS } from "./news.js";
import { POLL_PARTIES, matchPartyCode, pollPartyByCode } from "./polling.js";

const PRIVACY_THRESHOLD = Number(process.env.PRIVACY_THRESHOLD ?? 5);

/** Format a pg date/timestamp (returned as a JS Date) as YYYY-MM-DD. */
const ymd = (value: unknown) => (value instanceof Date ? value.toISOString() : String(value)).slice(0, 10);

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
  const scoredByName = new Map(
    outlets.map((row) => [
      row.name as string,
      {
        name: row.name as string,
        x: row.x as number,
        y: row.y as number,
        sample: row.sample as number
      }
    ])
  );
  const configuredOutlets = MEDIA_FEEDS.map((feed) => {
    const scored = scoredByName.get(feed.name);
    return scored ?? { name: feed.name, x: null, y: null, sample: 0 };
  });
  const extraScored = outlets
    .filter((row) => !MEDIA_FEEDS.some((feed) => feed.name === row.name))
    .map((row) => ({
      name: row.name as string,
      x: row.x as number,
      y: row.y as number,
      sample: row.sample as number
    }));

  return {
    outlets: [...configuredOutlets, ...extraScored],
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

  // --- Discussion: what people actually say. Prefer per-post compass scores
  // (every scored comment is a data point); fall back to subject positions
  // signed by stance balance while post scoring catches up. ---
  const [postScores] = await sql`
    with latest as (
      select distinct on (subject_id) subject_id,
             (output->>'x')::float as x, (output->>'y')::float as y
      from ai_analyses
      where subject_type = 'debate_post' and kind = 'compass' and output->>'x' is not null
      order by subject_id, id desc
    )
    select count(*)::int as sample,
           round(avg(x)::numeric, 2)::float as x,
           round(avg(y)::numeric, 2)::float as y
    from latest
    where x <> 0 or y <> 0
  `;
  let discussion: { x: number; y: number; sample: number } | null = null;
  if (postScores && (postScores.sample as number) >= 5) {
    discussion = {
      x: postScores.x as number,
      y: postScores.y as number,
      sample: postScores.sample as number
    };
  } else {
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
    discussion = mean(discussionPoints, discussionWeights);
  }

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

  // --- Polling: where the public sits if you weight each party's revealed
  // compass position by its current voting-intention share. Derived, not a
  // measured public compass — kept separate from civicWill. ---
  const polling = await supportWeightedCompass(
    sql,
    parties.map((party) => ({ name: party.name, compass: party.compass }))
  );

  return {
    civicWill,
    discussion,
    polling,
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

/** Latest compass-scored articles across all outlets, for the media page. */
export async function mediaArticles(sql: Sql, take = 40) {
  const articles = await sql`
    select n.id, n.title, n.url, n.published_at, s.name as source,
           c.x, c.y, c.label
    from news_items n
    left join news_sources s on s.id = n.source_id
    join lateral (
      select (output->>'x')::float as x, (output->>'y')::float as y,
             output->>'label' as label
      from ai_analyses
      where subject_type = 'news_item' and subject_id = n.id::text
        and kind = 'compass' and output->>'x' is not null
      order by id desc limit 1
    ) c on true
    order by n.published_at desc nulls last
    limit ${take}
  `;
  return {
    articles: articles.map((row) => ({
      id: row.id as number,
      title: row.title as string,
      url: row.url as string,
      publishedAt: row.published_at as string | null,
      source: (row.source as string) ?? "Unknown source",
      compass: { x: row.x as number, y: row.y as number, label: (row.label as string) ?? "scored" }
    }))
  };
}

/** Latest poll-of-polls party shares (one row per party), most recent first. */
async function latestPollOfPolls(sql: Sql) {
  return sql`
    select r.party_code, r.party_label, r.percent::float as percent, p.fieldwork_end
    from polls p
    join poll_results r on r.poll_id = p.id
    where p.is_poll_of_polls
    order by p.fieldwork_end desc
    limit ${POLL_PARTIES.length}
  `;
}

/**
 * Support-weighted national compass: each party's revealed-preference compass
 * position, weighted by its current voting-intention share. The result is a
 * derived "where the public's party support sits" point, not a measured public
 * compass — labelled as such in the UI and never folded into civic will.
 */
async function supportWeightedCompass(
  sql: Sql,
  parties: Array<{ name: string; compass: { x: number; y: number; sample: number } | null }>
) {
  const shares = await latestPollOfPolls(sql);
  if (shares.length === 0) return null;
  const compassByCode = new Map<string, { x: number; y: number }>();
  for (const party of parties) {
    if (!party.compass) continue;
    const code = matchPartyCode(party.name);
    if (code) compassByCode.set(code, { x: party.compass.x, y: party.compass.y });
  }
  let sumX = 0;
  let sumY = 0;
  let weight = 0;
  let matchedParties = 0;
  for (const row of shares) {
    const compass = compassByCode.get(row.party_code as string);
    const share = row.percent as number;
    if (!compass || !Number.isFinite(share)) continue;
    sumX += compass.x * share;
    sumY += compass.y * share;
    weight += share;
    matchedParties += 1;
  }
  if (weight === 0 || matchedParties === 0) return null;
  return {
    x: Math.round((sumX / weight) * 100) / 100,
    y: Math.round((sumY / weight) * 100) / 100,
    sample: matchedParties
  };
}

/**
 * National polling snapshot: the latest poll-of-polls average, the most recent
 * poll from each pollster, and the per-party spread across those pollsters.
 * Free-source data (BritPolls CC BY 4.0 + Wikipedia CC BY-SA).
 */
export async function pollingSnapshot(sql: Sql) {
  const [pop] = await sql`
    select id, fieldwork_end, method, source from polls
    where is_poll_of_polls order by fieldwork_end desc limit 1
  `;
  const pollOfPolls = pop
    ? {
        date: ymd(pop.fieldwork_end),
        method: pop.method as string | null,
        parties: (
          await sql`
            select party_code, party_label, percent::float as percent
            from poll_results where poll_id = ${pop.id} order by percent desc
          `
        ).map((row) => ({
          code: row.party_code as string,
          label: row.party_label as string,
          percent: row.percent as number,
          colour: pollPartyByCode(row.party_code as string)?.colour ?? null
        }))
      }
    : null;

  // Latest standard poll per pollster, within the recent window so historical
  // (e.g. Wikipedia-backfilled) rows don't distort the "current" picture.
  const recent = await sql`
    select distinct on (p.pollster) p.id, p.pollster, p.fieldwork_end, p.sample_size, p.source
    from polls p
    where not p.is_poll_of_polls and p.fieldwork_end >= current_date - make_interval(days => 45)
    order by p.pollster, p.fieldwork_end desc
  `;
  const recentIds = recent.map((row) => row.id as number);
  const resultsByPoll = new Map<number, Array<{ code: string; percent: number }>>();
  if (recentIds.length > 0) {
    const rows = await sql`
      select poll_id, party_code, percent::float as percent
      from poll_results where poll_id in ${sql(recentIds)}
    `;
    for (const row of rows) {
      const list = resultsByPoll.get(row.poll_id as number) ?? [];
      list.push({ code: row.party_code as string, percent: row.percent as number });
      resultsByPoll.set(row.poll_id as number, list);
    }
  }

  const pollsters = recent
    .map((row) => ({
      pollster: row.pollster as string,
      date: ymd(row.fieldwork_end),
      sampleSize: row.sample_size as number | null,
      source: row.source as string,
      parties: (resultsByPoll.get(row.id as number) ?? []).sort((a, b) => b.percent - a.percent)
    }))
    .sort((a, b) => (b.date > a.date ? 1 : -1));

  // Per-party spread (min/max) across the latest poll from each pollster.
  const spread = POLL_PARTIES.filter((party) => party.code !== "oth").map((party) => {
    const values = pollsters
      .map((poll) => poll.parties.find((entry) => entry.code === party.code)?.percent)
      .filter((value): value is number => value != null);
    return values.length
      ? {
          code: party.code,
          label: party.label,
          colour: party.colour,
          min: Math.min(...values),
          max: Math.max(...values),
          samples: values.length
        }
      : null;
  });

  return {
    pollOfPolls,
    pollsters: pollsters.slice(0, 12),
    spread: spread.filter(Boolean),
    attribution: "Source: BritPolls.co.uk (CC BY 4.0) + Wikipedia (CC BY-SA)",
    generatedAt: new Date().toISOString()
  };
}

/**
 * Voting-intention trend: every poll (BritPolls + Wikipedia backfill) averaged
 * by week, per party. Aggregating all pollsters smooths house effects and gives
 * an immediate multi-month line rather than waiting for daily poll-of-polls
 * snapshots to accumulate.
 */
export async function pollingTrend(sql: Sql, weeks = 26) {
  const points = await sql`
    select date_trunc('week', p.fieldwork_end)::date as date, r.party_code,
           round(avg(r.percent)::numeric, 1)::float as percent
    from polls p
    join poll_results r on r.poll_id = p.id
    where not p.is_poll_of_polls
      and p.fieldwork_end >= current_date - make_interval(days => ${weeks * 7})
    group by date, r.party_code
    order by date asc
  `;
  const byDate = new Map<string, Record<string, number>>();
  for (const row of points) {
    const date = ymd(row.date);
    const entry = byDate.get(date) ?? {};
    entry[row.party_code as string] = row.percent as number;
    byDate.set(date, entry);
  }
  return {
    parties: POLL_PARTIES.filter((party) => party.code !== "oth").map((party) => ({
      code: party.code,
      label: party.label,
      colour: party.colour
    })),
    points: [...byDate.entries()].map(([date, shares]) => ({ date, ...shares })),
    attribution: "Source: BritPolls.co.uk (CC BY 4.0)"
  };
}

/**
 * A party's popularity over time (weekly poll average) with the news events
 * around it plotted — so you can see how coverage tracks support. News events
 * are descriptive context, never an integrity judgement.
 */
export async function partyPopularity(sql: Sql, partyId: number, weeks = 26) {
  const [party] = await sql`select id, name, abbreviation, background_colour from parties where id = ${partyId}`;
  if (!party) return null;
  const code = matchPartyCode(party.name as string);

  const trend = code
    ? await sql`
        select to_char(date_trunc('week', p.fieldwork_end)::date, 'YYYY-MM-DD') as date,
               round(avg(r.percent)::numeric, 1)::float as percent
        from polls p
        join poll_results r on r.poll_id = p.id
        where r.party_code = ${code} and not p.is_poll_of_polls
          and p.fieldwork_end >= current_date - make_interval(days => ${weeks * 7})
        group by 1 order by 1
      `
    : [];

  const events = await sql`
    select to_char(n.published_at::date, 'YYYY-MM-DD') as date, n.title, n.url, s.name as source,
           na.factual_label, na.bias::float as bias
    from news_party_links l
    join news_items n on n.id = l.news_item_id
    left join news_sources s on s.id = n.source_id
    left join news_assessments na on na.news_item_id = n.id
    where l.party_id = ${partyId} and n.published_at is not null
      and n.published_at >= current_date - make_interval(days => ${weeks * 7})
    order by n.published_at desc limit 12
  `;

  return {
    party: { id: party.id, name: party.name, abbreviation: party.abbreviation, colour: party.background_colour, code },
    trend: trend.map((r) => ({ date: r.date as string, percent: r.percent as number })),
    events: events.map((e) => ({
      date: e.date as string,
      title: e.title as string,
      url: e.url as string,
      source: e.source as string | null,
      factualLabel: e.factual_label as string | null,
      bias: e.bias as number | null
    })),
    note: "Poll movement and coverage shown together for context — correlation, not proof of cause."
  };
}

/** Latest net-approval rating for each party leader. */
export async function leaderApproval(sql: Sql) {
  const rows = await sql`
    select distinct on (leader) leader, party_code,
           approve::float as approve, disapprove::float as disapprove,
           net::float as net, as_of
    from leader_approval
    order by leader, as_of desc
  `;
  return {
    leaders: rows
      .map((row) => ({
        leader: row.leader as string,
        partyCode: row.party_code as string | null,
        colour: row.party_code ? (pollPartyByCode(row.party_code as string)?.colour ?? null) : null,
        approve: row.approve as number | null,
        disapprove: row.disapprove as number | null,
        net: row.net as number | null,
        asOf: ymd(row.as_of)
      }))
      .sort((a, b) => (b.net ?? -999) - (a.net ?? -999)),
    attribution: "Source: BritPolls.co.uk (CC BY 4.0)"
  };
}

/** Latest MRP projection (one source/release) as projected winner per seat. */
export async function mrpProjection(sql: Sql, source?: string) {
  const [latest] = source
    ? await sql`
        select source, released_on from mrp_estimates
        where source = ${source} order by released_on desc limit 1
      `
    : await sql`select source, released_on from mrp_estimates order by released_on desc limit 1`;
  if (!latest) return { source: null, releasedOn: null, seats: [], available: [] };

  const seats = await sql`
    select constituency_id, constituency_name, party_code, party_label, percent::float as percent
    from mrp_estimates
    where source = ${latest.source} and released_on = ${latest.released_on} and projected_winner
      and constituency_id is not null
  `;
  const available = await sql`
    select source, released_on, count(distinct constituency_name)::int as seats
    from mrp_estimates group by source, released_on order by released_on desc
  `;

  return {
    source: latest.source as string,
    releasedOn: ymd(latest.released_on),
    seats: seats.map((row) => ({
      constituencyId: row.constituency_id as number,
      constituencyName: row.constituency_name as string,
      partyCode: row.party_code as string,
      partyLabel: row.party_label as string,
      colour: pollPartyByCode(row.party_code as string)?.colour ?? null,
      percent: row.percent as number
    })),
    available: available.map((row) => ({
      source: row.source as string,
      releasedOn: row.released_on as string,
      seats: row.seats as number
    })),
    caveat: "Modelled MRP estimate — a projection per seat, not a vote or result."
  };
}
