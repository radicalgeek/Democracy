import type { Sql } from "postgres";

export type EngagementLevel = "inactive" | "curious" | "engaged" | "committed" | "scholar";

export interface UserEngagementStats {
  userId: number;
  billsVoted: number;
  debatePostsCreated: number;
  constituenciesExplored: number;
  helpTopicsViewed: number;
  currentStreak: number;
  engagementLevel: EngagementLevel;
  achievements: string[];
}

const ENGAGEMENT_REQUIREMENTS = {
  inactive: { bills: 0, topics: 0 },
  curious: { bills: 1, topics: 1 },
  engaged: { bills: 6, topics: 3 },
  committed: { bills: 21, topics: 5 },
  scholar: { bills: 50, topics: 8 }
};

const REQUIRED_TOPICS_BY_LEVEL = {
  curious: [],
  engaged: ["compass", "bill-process", "anonymous-voting"],
  committed: ["compass", "bill-process", "anonymous-voting", "divisions", "mp-voting"],
  scholar: [
    "compass",
    "bill-process",
    "anonymous-voting",
    "divisions",
    "mp-voting",
    "moderation",
    "petitions",
    "verification-tiers"
  ]
};

export async function getUserEngagementStats(
  sql: Sql,
  userId: number
): Promise<UserEngagementStats | null> {
  const [user] = await sql`select id from users where id = ${userId}`;
  if (!user) return null;

  const billsVoted = await sql`
    select count(distinct bill_id)::int as count
    from credential_issuances
    where user_id = ${userId}
  `;

  const debatePosts = await sql`
    select count(*)::int as count
    from debate_posts
    where user_id = ${userId}
      and moderation_state != 'blocked'
      and moderation_state != 'hidden'
  `;

  const helpTopicsViewed = await sql`
    select count(distinct topic_id)::int as count
    from user_help_views
    where user_id = ${userId}
  `;

  const viewedTopics = await sql`
    select topic_id
    from user_help_views
    where user_id = ${userId}
  `;

  const constituenciesExplored = await sql`
    select count(distinct b.id)::int as count
    from credential_issuances ci
    join bills b on b.id = ci.bill_id
    join svg_seat_bindings sb on sb.constituency_id = b.id
    where ci.user_id = ${userId}
  `;

  const billsCount = billsVoted[0]?.count ?? 0;
  const topicsCount = helpTopicsViewed[0]?.count ?? 0;
  const postsCount = debatePosts[0]?.count ?? 0;
  const constCount = constituenciesExplored[0]?.count ?? 0;
  const viewedTopicsSet = new Set(viewedTopics.map((r: any) => r.topic_id));

  const level = calculateEngagementLevel(billsCount, topicsCount, viewedTopicsSet);
  const achievements = await getUnlockedAchievements(sql, userId, billsCount, topicsCount, postsCount, viewedTopicsSet);
  const streak = await calculateStreak(sql, userId);

  return {
    userId,
    billsVoted: billsCount,
    debatePostsCreated: postsCount,
    constituenciesExplored: constCount,
    helpTopicsViewed: topicsCount,
    currentStreak: streak,
    engagementLevel: level,
    achievements
  };
}

function calculateEngagementLevel(
  billsVoted: number,
  topicsViewed: number,
  viewedTopics: Set<string>
): EngagementLevel {
  if (billsVoted >= ENGAGEMENT_REQUIREMENTS.scholar.bills &&
      topicsViewed >= ENGAGEMENT_REQUIREMENTS.scholar.topics &&
      hasAllRequiredTopics(viewedTopics, REQUIRED_TOPICS_BY_LEVEL.scholar)) {
    return "scholar";
  }
  if (billsVoted >= ENGAGEMENT_REQUIREMENTS.committed.bills &&
      topicsViewed >= ENGAGEMENT_REQUIREMENTS.committed.topics &&
      hasAllRequiredTopics(viewedTopics, REQUIRED_TOPICS_BY_LEVEL.committed)) {
    return "committed";
  }
  if (billsVoted >= ENGAGEMENT_REQUIREMENTS.engaged.bills &&
      topicsViewed >= ENGAGEMENT_REQUIREMENTS.engaged.topics &&
      hasAllRequiredTopics(viewedTopics, REQUIRED_TOPICS_BY_LEVEL.engaged)) {
    return "engaged";
  }
  if (billsVoted >= ENGAGEMENT_REQUIREMENTS.curious.bills &&
      topicsViewed >= ENGAGEMENT_REQUIREMENTS.curious.topics) {
    return "curious";
  }
  return "inactive";
}

function hasAllRequiredTopics(viewedTopics: Set<string>, required: string[]): boolean {
  return required.every((topic) => viewedTopics.has(topic));
}

async function getUnlockedAchievements(
  sql: Sql,
  userId: number,
  billsVoted: number,
  topicsViewed: number,
  debatePosts: number,
  viewedTopics: Set<string>
): Promise<string[]> {
  const achievements: string[] = [];

  // Learning achievements
  if (viewedTopics.has("compass") && billsVoted >= 1) {
    achievements.push("compass-quest");
  }
  if (
    viewedTopics.has("compass") &&
    viewedTopics.has("bill-process") &&
    viewedTopics.has("divisions")
  ) {
    achievements.push("bill-process-master");
  }
  if (viewedTopics.has("anonymous-voting") && viewedTopics.has("vote-receipts")) {
    achievements.push("anonymous-sentinel");
  }
  if (
    viewedTopics.has("divisions") &&
    viewedTopics.has("mp-voting") &&
    billsVoted >= 5
  ) {
    achievements.push("mp-detective");
  }

  // Engagement achievements
  if (billsVoted >= 1) {
    achievements.push("first-voter");
  }
  if (debatePosts >= 10) {
    achievements.push("conversationalist");
  }

  // Combination achievements
  if (billsVoted >= 20 && topicsViewed >= 5) {
    achievements.push("informed-voter");
  }

  return achievements;
}

async function calculateStreak(sql: Sql, userId: number): Promise<number> {
  // Get engagement stats for the last 7 days
  const stats = await sql`
    select period_date, current_streak
    from user_engagement_stats
    where user_id = ${userId}
    order by period_date desc
    limit 7
  `;

  if (stats.length === 0) return 0;

  // Latest stat
  const latest = stats[0];
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const latestDate = new Date(latest.period_date);
  latestDate.setUTCHours(0, 0, 0, 0);

  const daysDiff = Math.floor((today.getTime() - latestDate.getTime()) / (1000 * 60 * 60 * 24));

  // If more than 1 day since last activity, streak is broken
  if (daysDiff > 1) return 0;

  return latest.current_streak ?? 0;
}

export async function computeEngagementStatsForUser(
  sql: Sql,
  userId: number
): Promise<void> {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split("T")[0];

  // Check if we already have stats for today
  const [existing] = await sql`
    select id from user_engagement_stats
    where user_id = ${userId} and period_date = ${todayStr}
  `;

  // Get previous day's stats
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split("T")[0];

  const [prevStats] = await sql`
    select current_streak from user_engagement_stats
    where user_id = ${userId} and period_date = ${yesterdayStr}
  `;

  // Check if user engaged today (posted or voted)
  const [todayActivity] = await sql`
    select count(*) > 0 as engaged
    from (
      select 1 from credential_issuances where user_id = ${userId} and date(issued_at) = ${todayStr}
      union all
      select 1 from debate_posts where user_id = ${userId} and date(created_at) = ${todayStr}
      union all
      select 1 from user_help_views where user_id = ${userId} and date(viewed_at) = ${todayStr}
    ) as activity
  `;

  const newStreak = todayActivity.engaged ? ((prevStats?.current_streak ?? 0) + 1) : 0;

  // Get cumulative stats
  const stats = await getUserEngagementStats(sql, userId);
  if (!stats) return;

  if (existing) {
    await sql`
      update user_engagement_stats
      set
        bills_voted_cumulative = ${stats.billsVoted},
        debate_posts_cumulative = ${stats.debatePostsCreated},
        constituencies_explored = ${stats.constituenciesExplored},
        help_topics_viewed_cumulative = ${stats.helpTopicsViewed},
        current_streak = ${newStreak},
        current_engagement_level = ${stats.engagementLevel},
        learning_achievements = ${JSON.stringify(stats.achievements)}
      where user_id = ${userId} and period_date = ${todayStr}
    `;
  } else {
    await sql`
      insert into user_engagement_stats (
        user_id,
        period_date,
        bills_voted_cumulative,
        debate_posts_cumulative,
        constituencies_explored,
        help_topics_viewed_cumulative,
        current_streak,
        current_engagement_level,
        learning_achievements
      ) values (
        ${userId},
        ${todayStr},
        ${stats.billsVoted},
        ${stats.debatePostsCreated},
        ${stats.constituenciesExplored},
        ${stats.helpTopicsViewed},
        ${newStreak},
        ${stats.engagementLevel},
        ${JSON.stringify(stats.achievements)}
      )
    `;
  }
}
