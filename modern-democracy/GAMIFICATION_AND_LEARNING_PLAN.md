# Gamification + Learning System Plan

## Executive Summary
Engagement without understanding creates noise. This plan layers **contextual help** throughout the app with **learning-based progression** in gamification. Users level up by *engaging AND learning*, ensuring data quality while improving UX.

---

## Part 1: Learning System (Help & Explanation)

### 1.1 Core Concept
Every key concept in the app should be **clickable** for explanation. Not a top-level FAQ—explanations live where they matter.

#### What needs explanation:
1. **Compass** — what are X/Y axes, how do votes position you
2. **Bill process** — stages (Second Reading → Committee → Report → Third Reading → Division → Act)
3. **Anonymous voting** — credentials, receipts, why ballots aren't linked to users
4. **Constituency & MPs** — what they represent, why it matters
5. **Debate & moderation** — why posts are hidden, what "heated-legitimate" means
6. **Petitions** — how they connect to Parliament
7. **Verification tiers** — what each tier unlocks, why identity matters
8. **Division voting** — how MPs actually voted vs your opinion
9. **News integration** — why bill context matters

### 1.2 UI Pattern: Inline Help

**Clickable icons trigger modal explanations:**
```
Compass icon (?) → Modal: "What is the political compass?"
Bill stage "Committee" → Popover: "Bills are debated line-by-line by committees..."
Division link → Popover: "This is how MPs voted. Here's how you voted..."
```

#### Implementation: HelpTrigger Component
```tsx
<HelpTrigger topic="compass" label="political compass">
  <CompassIcon />
</HelpTrigger>

// Renders as: [?] political compass (clickable)
// Click → modal explaining compass with visual
```

Reusable across the app.

### 1.3 Help Content Structure

Central help registry (`lib/help.ts`):
```typescript
export const HELP_TOPICS = {
  compass: {
    title: "Political Compass",
    shortDesc: "How we measure political position",
    content: ReactNode,  // Structured explanation + diagram
    relatedTopics: ["bill-analysis", "mp-voting"],
    videoUrl?: "https://...",  // Optional
    readTime: 3  // minutes
  },
  bill-process: {
    title: "How Bills Become Law",
    content: <BillProcessDiagram />,
    shortDesc: "The parliamentary stages your votes affect",
    relatedTopics: ["divisions", "voting-mechanics"]
  },
  anonymous-voting: {
    title: "Why Your Ballots Are Anonymous",
    content: <AnonymousVotingExplainer />,
    shortDesc: "Privacy-first voting design",
    relatedTopics: ["verification-tiers", "receipts"]
  },
  // ... more topics
};
```

### 1.4 Placement Strategy (Where Help Lives)

| Location | Help Topic | Trigger |
|----------|-----------|---------|
| Dashboard → "Your position" card | Compass | Click compass icon |
| Dashboard → Engagement level badge | Verification tiers | Click tier label |
| Bill view → header | Bill process & divisions | Click "Committee" stage / division count |
| Vote panel | Anonymous voting | Click "anonymous ballot" link or info icon |
| Debate section | Moderation & heated speech | Click "hidden" post or moderation badge |
| Petition card | How petitions work | Click petition source badge (parliament.uk) |
| MP card → "voted with you" | Division voting | Click MP vote record |
| News item | Bill context | Click bill link in news |

### 1.5 Learning Content Examples

#### Compass Explainer
- Visual: Interactive compass with you + MP + party averages positioned
- Text: "X-axis = Economic (left = redistribute, right = free market). Y-axis = Authority (up = state authority, down = personal freedom). Bills and your votes position you. Your MP has an average position based on their division votes."
- Action: "Take the compass quiz to see your position"
- Related: bill-analysis, mp-voting

#### Bill Process Explainer
```
Second Reading → Committee Stage → Report Stage → Third Reading → Division (Vote)

Each stage MPs debate and amend. Your anonymous ballot 
counts alongside petitions, constituent feedback, campaigns.
```
- Visual: Timeline with icons for each stage
- Action: "See current bills at each stage"

#### Anonymous Voting Explainer
- Text: "Your ballot is separated from your identity. You get a receipt to verify inclusion, but the ballot itself has no name on it. This protects you and prevents vote coercion."
- Visual: Diagram showing credential → ballot flow with hashing
- Related: verification-tiers, receipts

---

## Part 2: Learning-Based Gamification

### 2.1 Engagement Progression (Revised)

**Old model:** Bills voted → level up
**New model:** Bills voted + Bills understood → level up

Engagement levels now require *both*:

| Level | Bills Voted | Help Topics Viewed | Unlocks |
|-------|-------------|-------------------|---------|
| **Curious** | 1–5 | ≥1 (compass OR bill-process) | View debate posts |
| **Engaged** | 6–20 | ≥3 (including anonymous-voting) | Constituency heatmap, debate history |
| **Committed** | 21+ | ≥5 (including divisions, mp-voting) | CSV export, news RSS, early features |
| **Scholar** | 50+ | ≥8 (all major topics) | Custom compass queries, API access |

**Key insight:** Can't level up to Committed without learning about divisions. Can't use features without understanding them first.

### 2.2 Learning Achievements (Reward Understanding)

Add to user_engagement_stats:
```sql
alter table user_engagement_stats add column if not exists
  help_topics_viewed int default 0,
  learning_badges jsonb default '[]';

-- Examples: 
-- ["compass-quest", "bill-process-master", "anonymous-sentinel", "mp-detective"]
```

Achievements for learning:
- **Compass Quest** (3 minutes): View compass explainer + take quiz
- **Bill Process Master**: View all 4 bill-related explanations
- **Anonymous Sentinel**: Read anonymous voting + receipts explanations
- **MP Detective**: Compare your votes to your MP's division record (implies viewing division + mp-voting explanations)
- **Petition Activist**: View petition + bill-process explanations, vote on 3 petitions
- **Moderator's Eye**: View debate + moderation explanations, read 10+ debate posts

**Display on profile:**
```
🏆 Achievements (5/9)
  ✓ Compass Quest
  ✓ Bill Process Master
  ✓ Anonymous Sentinel
  ✓ MP Detective
  ○ Petition Activist (2/3 conditions met)
  ○ Moderator's Eye (reading 7/10 posts)
```

### 2.3 Streak + Engagement Level (Unchanged)
Still applies:
- 🔥 Daily streak (votes OR posts OR viewing help topics)
- Engagement level (now requires understanding)
- Unlocks (heatmap, export, etc.)

---

## Part 3: Implementation Plan

### Phase 1: Help Infrastructure (3 days)

#### 1a. Help content & registry
- Create `src/lib/help.ts` — all HELP_TOPICS definitions
- Create help content components:
  - `src/components/help/CompassExplainer.tsx`
  - `src/components/help/BillProcessExplainer.tsx`
  - `src/components/help/AnonymousVotingExplainer.tsx`
  - `src/components/help/MpVotingExplainer.tsx`
  - `src/components/help/DivisionExplainer.tsx`
  - `src/components/help/ModerationExplainer.tsx`
  - `src/components/help/PetitionExplainer.tsx`
  - `src/components/help/VerificationExplainer.tsx`

#### 1b. Help UI components
- `src/components/HelpTrigger.tsx` — reusable [?] icon wrapper
- `src/components/HelpModal.tsx` — modal template with title, content, related topics
- `src/components/AchievementBadge.tsx` — visual achievement display
- `src/lib/useHelpTracking.ts` — hook to track viewed topics

#### 1c. Help tracking (localStorage for now)
```typescript
const HELP_VIEWED_KEY = "democracy.helpViewed"; // Set<string> of topic IDs
export function markHelpViewed(topicId: string) {
  const viewed = new Set(JSON.parse(localStorage.getItem(HELP_VIEWED_KEY) || "[]"));
  viewed.add(topicId);
  localStorage.setItem(HELP_VIEWED_KEY, JSON.stringify([...viewed]));
}
```

**Future:** Migrate to backend as `user_help_views` table if you want persistence/analytics.

### Phase 2: Integrate Help Into Existing Components (2 days)

#### 2a. Dashboard.tsx
- Wrap "Your position" compass with `<HelpTrigger topic="compass">`
- Wrap verification tier label with `<HelpTrigger topic="verification-tiers">`
- Show achievement progress bar below engagement level

#### 2b. BillView.tsx
- Wrap bill stage (e.g., "Committee") with `<HelpTrigger topic="bill-process">`
- Add division count link → `<HelpTrigger topic="divisions">`
- Add "see how your MP voted" → `<HelpTrigger topic="mp-voting">`

#### 2c. VotePanel.tsx
- "Cast ballot" button description includes: `<HelpTrigger topic="anonymous-voting">`

#### 2d. DebatePanel.tsx
- Moderation badge (e.g., "heated-legitimate") → `<HelpTrigger topic="moderation">`
- "Why is this hidden?" link → same

#### 2e. PetitionsPanel.tsx
- Petition header → `<HelpTrigger topic="petitions">`

#### 2f. MyMP.tsx
- "Division voting record" → `<HelpTrigger topic="divisions">`
- "Your alignment" % → `<HelpTrigger topic="mp-voting">`

### Phase 3: Backend + API (2 days)

#### 3a. Schema updates
```sql
-- Track help views
create table if not exists user_help_views (
  user_id bigint not null references users(id),
  topic_id text not null,
  viewed_at timestamptz default now(),
  unique (user_id, topic_id)
);

-- Track achievements
create table if not exists user_achievements (
  user_id bigint not null references users(id),
  achievement_id text not null,
  unlocked_at timestamptz default now(),
  condition_progress jsonb default '{}',  -- {"petitions_voted": 2, "required": 3}
  unique (user_id, achievement_id)
);

-- Update engagement stats
alter table user_engagement_stats add column if not exists
  help_topics_viewed_cumulative int default 0,
  learning_achievements jsonb default '[]';
```

#### 3b. Endpoints
```
GET /api/auth/me/learning
  → {
      helpTopicsViewed: ["compass", "bill-process", ...],
      achievements: [
        { id: "compass-quest", unlockedAt: "2026-06-01", progress: 1 },
        { id: "mp-detective", progress: { compared: 3, required: 5 } }
      ],
      achievementProgress: [
        { id: "bill-process-master", conditions: 4, conditionsRequired: 4 }
      ]
    }

POST /api/auth/me/learning/help-view
  → { topicId: "compass" }  // Records view

GET /api/auth/me/engagement  // Updated to include learning data
```

#### 3c. Nightly worker job (worker-jobs.ts)
Compute:
- `help_topics_viewed_cumulative` (count from user_help_views)
- Unlock achievements:
  - "Compass Quest": viewed "compass" + at least one quiz response
  - "Bill Process Master": viewed all bill-process related topics
  - "MP Detective": viewed "divisions" + "mp-voting" + compared votes to MP (via dashboard view)
  - etc.
- Update engagement_level to require both votes + help_topics_viewed

---

## Part 4: Updated Data Model

### user_engagement_stats
```sql
{
  user_id: 12345,
  period_date: "2026-06-11",
  bills_voted_cumulative: 42,
  debate_posts_cumulative: 8,
  constituencies_explored: 7,
  help_topics_viewed_cumulative: 5,
  current_streak: 12,
  current_engagement_level: "engaged",  -- requires both votes + understanding
  learning_achievements: [
    "compass-quest",
    "bill-process-master",
    "anonymous-sentinel",
    "mp-detective"
  ]
}
```

### GET /api/auth/me (combined view)
```json
{
  "user": {
    "id": 12345,
    "displayName": "Mark Jones",
    "email": "mark@example.com",
    "verificationTier": 1,
    "constituencyId": 42,
    "constituencyName": "Westminster"
  },
  "engagement": {
    "billsVoted": 42,
    "debatePostsCreated": 8,
    "currentStreak": 12,
    "engagementLevel": "engaged",
    "helpTopicsViewed": 5,
    "achievements": [
      { "id": "compass-quest", "unlockedAt": "2026-06-01" },
      { "id": "bill-process-master", "unlockedAt": "2026-06-03" }
    ],
    "nextMilestone": {
      "level": "committed",
      "billsNeeded": 23,
      "billsRemaining": 5,
      "helpTopicsNeeded": 5,
      "helpTopicsRemaining": 2
    }
  }
}
```

---

## Part 5: Updated Engagement Progression

### Engagement Levels (New Requirements)

| Level | Condition | Unlocks | Streak Requirement |
|-------|-----------|---------|-------------------|
| **Curious** | ≥1 vote + ≥1 help topic viewed | Debate history | ≥1 day |
| **Engaged** | ≥6 votes + ≥3 help topics (compass, bill-process, anonymous-voting) | Constituency heatmap, debate export CSV | ≥5 days |
| **Committed** | ≥21 votes + ≥5 help topics (including divisions, mp-voting) | News RSS, early features, compass queries | ≥20 days |
| **Scholar** | ≥50 votes + ≥8 help topics (all major topics) | Custom API access, advanced analytics | ≥50 days |

**Key:** Helps users discover features while learning what they mean.

### Achievement Categories

**Learning Achievements** (understanding-focused):
- Compass Quest
- Bill Process Master
- Anonymous Sentinel
- MP Detective
- Petition Activist
- Moderator's Eye
- Division Reader (viewed divisions + read 5+ division posts)
- Constituency Scholar (explored 10+ constituencies)

**Engagement Achievements** (participation-focused):
- First Voter (cast first ballot)
- Streaker 🔥 (7-day streak)
- Conversationalist (10+ debate posts)
- Petition Signer (vote on 5+ petitions)
- Map Explorer (navigate to 10+ constituencies)

**Combination Achievements** (learning + engagement):
- Informed Voter (20 votes + all major help topics)
- Voice of the People (30+ debate posts with no hidden moderation)
- Balanced Perspective (votes across 5+ different topic areas)

---

## Part 6: Help Placement Map

### Dashboard
- Compass card → [?] icon → Help modal
- Engagement level badge → [?] icon → Tier explanation
- Streak display → [?] icon → Streak mechanics
- Participation metrics → [?] icons for each metric

### Bills
- Bill stage label → Help modal (e.g., "What is Committee Stage?")
- Division count badge → Help modal
- Ballot casting → Inline help "Anonymous ballots"
- Debate section → "Why is this post hidden?" link

### My MP
- Division voting record → "How MPs vote" help
- Alignment % → "How alignment is calculated" help
- Party affiliation → "Party position on compass" help

### Petitions
- Petition status → "How petitions work" help
- Parliament.uk link → "Why Parliament Petitions?" help

### Map
- Constituency hover → "What is a constituency?" help
- Color coding → Legend with [?] icons

### Settings/Profile
- Verification tier section → Full tier explanation
- Delete account → Explanation of what data is kept

---

## Part 7: Content Outline

### Compass Explainer (2–3 min read)
- **What:** Two-axis political spectrum (economic left/right, authoritarian/libertarian)
- **Why:** Bills and MPs have positions on this spectrum. Your votes show where you stand.
- **Visual:** Interactive compass with example positions (you, your MP, party averages)
- **Action:** "Take the compass quiz" button

### Bill Process Explainer (3–4 min)
- **Timeline:** Second Reading → Committee → Report → Third Reading → Division
- **What each stage is:** Debate, amendments, division (vote)
- **Your role:** Anonymous ballots count alongside petitions, constituent feedback
- **Visual:** Timeline animation or flowchart

### Anonymous Voting Explainer (2 min)
- **Why:** Protects you from coercion, prevents vote-selling
- **How:** Your ballot separated from identity; you get receipt for verification
- **Design:** Credential → hashing → anonymous ballot
- **Visual:** Simple diagram

### MP Voting Explainer (2–3 min)
- **What:** Divisions are official recorded votes
- **How MPs vote:** Party line, conscience votes, abstaining
- **Your comparison:** How your votes align with theirs
- **Visual:** Sample division with vote breakdown

### Division Voting Explainer (2 min)
- **What:** Formal parliamentary vote recorded with names
- **Read:** MPs voting for/against, abstaining
- **Your ballot:** Your position on the same issue
- **Link:** Back to Bill Process (divisions are the end stage)

### Moderation Explainer (2–3 min)
- **Policy:** Permissive for heated political speech, restrictive for personal attacks
- **States:** clean, heated-legitimate, hidden, blocked
- **Why:** Balance free speech with safety
- **Your posts:** How to stay visible while being critical

### Petitions Explainer (2 min)
- **What:** Parliament.uk community petitions
- **Threshold:** 100k+ signatures → parliamentary debate
- **Your vote:** Counts separately from your bill ballot
- **Link:** Sign the official petition

### Verification Tier Explainer (2 min)
- **Tier 0:** Anon session, explore only
- **Tier 1:** Registered with postcode, vote on bills
- **Tier 2:** Identity verified, enhanced features (early access, APIs)
- **Why:** Prevent duplicate registration, enable local insights

---

## Part 8: Codebase Integration Summary

### New Files
```
src/
  lib/
    help.ts              # HELP_TOPICS registry
    useHelpTracking.ts   # Hook for marking topics viewed
  components/
    HelpTrigger.tsx      # [?] icon + modal wrapper
    HelpModal.tsx        # Modal template
    AchievementBadge.tsx # Badge display
    help/
      CompassExplainer.tsx
      BillProcessExplainer.tsx
      AnonymousVotingExplainer.tsx
      MpVotingExplainer.tsx
      DivisionExplainer.tsx
      ModerationExplainer.tsx
      PetitionExplainer.tsx
      VerificationExplainer.tsx

server/
  src/
    services/learning.ts  # Backend logic for achievements
```

### Modified Files
```
Dashboard.tsx           # Add help icons, achievement display
BillView.tsx           # Add help triggers for stages/divisions
VotePanel.tsx          # Anonymous voting help
DebatePanel.tsx        # Moderation help
PetitionsPanel.tsx     # Petition help
MyMP.tsx               # Division voting help
routes.ts              # Add /api/auth/me/learning, POST help-view
worker-jobs.ts         # Compute achievements nightly
schema.sql             # Add user_help_views, user_achievements, update engagement stats
```

---

## Part 9: Effort Estimate

| Phase | Task | Days |
|-------|------|------|
| 1a | Help content & registry | 1.5 |
| 1b | Help UI components | 1 |
| 1c | Help tracking (localStorage) | 0.5 |
| 2 | Integrate into existing components | 2 |
| 3a | Schema updates | 0.5 |
| 3b | API endpoints | 1 |
| 3c | Nightly achievements job | 1 |
| 4 | Dashboard + nav updates | 1 |
| 5 | Testing + polish | 1 |
| **Total** | | **9 days** |

---

## Part 10: Expected Data Quality Improvements

### From Learning System
- **Clearer voting:** Users understand bills better before voting → more informed choices
- **Better debate:** Users know moderation policy → higher-quality posts
- **Richer compass:** Users understand the compass axes → more accurate self-positioning

### From Achievement Tracking
- **Consistency:** Achievements reward understanding + engagement → no quick-spam behavior
- **Exploration:** Achievements for exploring constituencies → more regional diversity
- **Longevity:** Streaks + unlocks → repeat visits → longitudinal data

### From Help Placement
- **Self-serve:** Users find answers contextually → less support burden
- **Transparency:** Help explains your design choices → builds trust in privacy, moderation, voting mechanics

---

## Part 11: Design Rationale

### Why This Is Better Than FAQ
- **Contextual:** Users learn about compass when they see the compass
- **Tied to action:** Help directly leads to engagement (e.g., "Take quiz" from compass help)
- **Discoverable:** Users find answers where they need them, not in a separate section
- **Optional:** Not a tutorial wall; users can ignore if they want

### Why Learning Matters for Gamification
- **Data quality:** Understanding voters give better data than confused ones
- **Alignment with values:** "Compass not sentiment" means users should know what the compass is
- **Motivation:** Users engage better when they understand what they're doing
- **Unlocks are functional:** "Early access to news" only makes sense if users know bills have news context

### Why Achievements Matter
- **Visible progress:** Users see they're learning, not just participating
- **Guidance:** Achievements nudge toward breadth (learn about divisions, petitions, etc.)
- **Rewardable moments:** Viewing help is rewarded, not just endured

---

## Part 12: Questions for You

1. **Help placement aggressiveness:** Should help icons be on *every* term or selectively on key terms only? (Every = discoverable but cluttered; selective = cleaner but might miss some)

2. **Help modal size:** Full-page modal, side-drawer, or small popover? (Popover = non-intrusive; modal = more space for content)

3. **Achievement visibility:** Show in dashboard, top nav badge, or both? (Dashboard = discoverable; badge = always visible)

4. **Help video:** Include optional short videos (30s–1min) for key topics, or text+diagrams only? (Videos = engaging; text = faster to load)

5. **Compass quiz incentive:** Should "Compass Quest" achievement require taking the quiz, or just viewing the explainer? (Both = ensures understanding; just viewing = easier unlock)

6. **Timeline:** Implement help first (foundation) or help + gamification together? (Together = cohesive; help first = foundational)
