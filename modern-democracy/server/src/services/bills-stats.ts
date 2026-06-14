import type { Sql } from "postgres";

/**
 * Aggregate statistics for the Bills screen: how many bills are progressing,
 * how many became law (Royal Assent / is_act) vs were defeated, where bills sit
 * in the legislative process, parliamentary throughput over time, and the civic
 * engagement they have attracted. All from the imported bills + bill_events.
 */
export async function billStats(sql: Sql) {
  const [totals] = await sql`
    select count(*)::int as total,
           count(*) filter (where is_act)::int as acts,
           count(*) filter (where is_defeated)::int as defeated,
           count(*) filter (where current_house = 'Commons')::int as commons,
           count(*) filter (where current_house = 'Lords')::int as lords
    from bills
  `;
  const inProgress = (totals.total as number) - (totals.acts as number) - (totals.defeated as number);
  const decided = (totals.acts as number) + (totals.defeated as number);

  const byStage = await sql`
    select coalesce(current_stage, 'Unknown') as stage, count(*)::int as count
    from bills group by current_stage order by count(*) desc
  `;

  const [engagement] = await sql`
    select (select count(*)::int from anonymous_ballots) as ballots,
           (select count(*)::int from divisions) as divisions,
           (select count(*)::int from debate_posts where moderation_state <> 'blocked') as posts,
           (select count(*)::int from bill_debates) as hansard
  `;

  // Parliamentary throughput: dated stage events per month (real activity).
  const throughput = await sql`
    select to_char(date_trunc('month', happened_on), 'YYYY-MM') as month, count(*)::int as events
    from bill_events
    where happened_on is not null and happened_on >= current_date - make_interval(months => 18)
    group by 1 order by 1
  `;

  // Bills that made it past Royal Assent — the "became law" list.
  const recentActs = await sql`
    select id, short_title, current_house, last_updated
    from bills where is_act
    order by last_updated desc nulls last limit 12
  `;

  return {
    totals: {
      total: totals.total as number,
      acts: totals.acts as number,
      defeated: totals.defeated as number,
      inProgress,
      commons: totals.commons as number,
      lords: totals.lords as number
    },
    passRate: decided > 0 ? Math.round(((totals.acts as number) / decided) * 100) : null,
    failRate: decided > 0 ? Math.round(((totals.defeated as number) / decided) * 100) : null,
    byStage: byStage.map((row) => ({ stage: row.stage as string, count: row.count as number })),
    engagement: {
      ballots: engagement.ballots as number,
      divisions: engagement.divisions as number,
      posts: engagement.posts as number,
      hansard: engagement.hansard as number
    },
    throughput: throughput.map((row) => ({ month: row.month as string, events: row.events as number })),
    recentActs: recentActs.map((row) => ({
      id: row.id as number,
      title: row.short_title as string,
      house: row.current_house as string | null,
      lastUpdated: row.last_updated as string | null
    })),
    generatedAt: new Date().toISOString()
  };
}
