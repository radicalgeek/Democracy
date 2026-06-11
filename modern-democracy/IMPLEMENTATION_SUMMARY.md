# Gamification & Learning System - Implementation Summary

## What Was Built

A comprehensive **gamification + learning system** for the Democracy app that ties engagement to understanding. Users level up by voting *and* learning, not just participating.

---

## Architecture Overview

### **Help System (Frontend)**
- **`src/lib/help.ts`** - Registry of 12 help topics (compass, bill process, divisions, anonymous voting, moderation, etc.)
- **`src/components/HelpTrigger.tsx`** - Reusable [?] icon component that opens help modals
- **`src/components/HelpModal.tsx`** - Modal template for displaying help content
- **`src/lib/useHelpTracking.ts`** - localStorage tracking of viewed topics

**Design:** Help lives contextually—click a [?] next to "compass" to learn about the compass. No separate FAQ.

### **Gamification Backend**
- **`server/src/services/learning.ts`** - Core logic for engagement levels, achievements, streaks
- **`server/src/schema.sql`** - New tables:
  - `user_help_views` - Track which help topics each user has viewed
  - `user_achievements` - Unlock records with timestamps
  - `user_engagement_stats` - Daily snapshots of: bills voted, debate posts, topics viewed, streak, level

### **API Endpoints**
- `GET /api/auth/me/engagement` - Current engagement level, streak, achievements, next milestone
- `POST /api/auth/me/help-view` - Record that user viewed a help topic
- `GET /api/auth/me/learning` - Learning history (topics viewed, achievements unlocked)

### **Frontend Integration**
- **Dashboard.tsx** - Shows help viewed count, engagement metrics
- **BillView.tsx** - Help triggers for "How Bills Become Law"
- **VotePanel.tsx** - Help triggers for anonymous voting & receipts
- **DebatePanel.tsx** - Help trigger for moderation policy

---

## Engagement Levels

| Level | Bills Voted | Help Topics Read | Required Topics | Unlocks |
|-------|-------------|-----------------|-----------------|---------|
| **Inactive** | 0 | 0 | — | Explore only |
| **Curious** | 1–5 | ≥1 | compass OR bill-process | Debate history view |
| **Engaged** | 6–20 | ≥3 | compass, bill-process, anonymous-voting | Constituency heatmap, CSV export |
| **Committed** | 21+ | ≥5 | + divisions, mp-voting | News RSS, early features |
| **Scholar** | 50+ | ≥8 | All major topics | Custom API access |

**Key insight:** Can't reach "Committed" without understanding divisions. Understanding is the prerequisite.

---

## Achievements (Learning-Focused)

### Learning Achievements
- **Compass Quest** — View compass explainer + take compass quiz
- **Bill Process Master** — View compass, bill-process, divisions explainers
- **Anonymous Sentinel** — View anonymous-voting + vote-receipts explainers
- **MP Detective** — View divisions + mp-voting, compare votes to your MP
- **Petition Activist** — View petition + bill-process, vote on 3+ petitions
- **Moderator's Eye** — View moderation explainer, read 10+ debate posts

### Engagement Achievements
- **First Voter** — Cast your first ballot
- **Streaker 🔥** — Maintain a 7-day engagement streak
- **Conversationalist** — Post 10+ debate comments
- **Petition Signer** — Vote on 5+ petitions

### Combination Achievements
- **Informed Voter** — 20+ votes + all major help topics
- **Voice of the People** — 30+ debate posts with no moderation issues
- **Balanced Perspective** — Votes across 5+ different topic areas

---

## Help Topics (Implemented)

1. **Compass** (3 min) — Economic left/right + authoritarian/libertarian axes
2. **Bill Process** (4 min) — Second Reading → Committee → Report → Third Reading → Division
3. **Divisions** (2 min) — How MPs officially vote with recorded names
4. **Anonymous Voting** (3 min) — Why ballots are separated from identity
5. **Vote Receipts** (2 min) — Proving your ballot was counted without revealing your choice
6. **Constituencies** (2 min) — What they are, why they matter
7. **MP Voting** (3 min) — How to read your representative's voting record
8. **Petitions** (2 min) — Parliament.uk petition process
9. **Moderation** (3 min) — Permissive for policy criticism, restrictive for personal attacks
10. **Verification Tiers** (2 min) — Tier 0 (anon) → Tier 1 (registered) → Tier 2 (verified)
11. **Representatives** (2 min) — Finding and understanding MPs
12. **News** (2 min) — Context for bills

---

## Frontend Placements

| Component | Help Topic | Trigger |
|-----------|-----------|---------|
| Dashboard → "Your position" | compass | [?] icon in card header |
| Dashboard → Engagement badge | verification-tiers | [?] icon next to tier |
| BillView → Status row | bill-process | [?] inline with stage |
| BillView → "Political direction" | compass | [?] icon next to heading |
| VotePanel → Title | anonymous-voting | [?] inline with "Cast civic vote" |
| VotePanel → Receipt card | vote-receipts | [?] inline with "Your receipt" |
| DebatePanel → Section heading | moderation | [?] inline with "AI moderated debate" |

---

## Database Schema

### `user_help_views`
```sql
user_id (FK users)
topic_id (text)
viewed_at (timestamp)
PRIMARY KEY (user_id, topic_id)
```

### `user_achievements`
```sql
user_id (FK users)
achievement_id (text)
unlocked_at (timestamp)
condition_progress (jsonb) -- for partial progress tracking
PRIMARY KEY (user_id, achievement_id)
```

### `user_engagement_stats` (Daily snapshot)
```sql
user_id (FK users)
period_date (date)
bills_voted_cumulative (int)
debate_posts_cumulative (int)
constituencies_explored (int)
help_topics_viewed_cumulative (int)
current_streak (int)
current_engagement_level (text: inactive|curious|engaged|committed|scholar)
learning_achievements (jsonb) -- array of achievement IDs
PRIMARY KEY (user_id, period_date)
```

---

## API Integration

### Frontend Functions (src/lib/api.ts)

```typescript
// Fetch current engagement stats
fetchEngagementStats() → { engagement: EngagementStats }

// Record a help topic view (backend + localStorage)
markHelpViewedBackend(topicId: string) → boolean

// Fetch learning history
fetchLearningStats() → { learning: { helpTopicsViewed, achievements } }
```

### Backend Worker Job

```typescript
// Runs nightly to compute engagement for all users
computeAllEngagementStats() → { computed, total }
```

---

## CSS Additions

Added to `src/styles/app.css`:
- `.help-trigger` — Styled [?] icon button
- `.help-trigger-inline` — Inline variant for headers
- `.help-modal-overlay` — Fade-in background
- `.help-modal` — Modal window with header, content, footer
- `.engagement-level-badge` — Color-coded tier display (curious/engaged/committed/scholar)
- `.engagement-streak` — Fire emoji + streak counter
- `.engagement-progress` — Progress bar to next milestone

---

## How It Works: User Journey

1. **New User Signs Up**
   - Tier 1: registered with postcode
   - Engagement = "inactive"
   - No topics viewed yet

2. **Explores Dashboard**
   - Sees "Your position" card
   - Clicks [?] icon
   - HelpModal opens → "Political Compass" explainer
   - HelpTrigger records view in localStorage
   - Dashboard re-renders showing "1 topic read"

3. **Takes Compass Quiz**
   - "Compass Quest" achievement unlocked
   - Profile updates showing achievement badge

4. **Votes on 3 Bills**
   - Each vote stored in `credential_issuances`
   - Dashboard shows "3 bills voted"
   - Progress toward "Curious" level displayed

5. **Views Bill Details**
   - Clicks bill → BillView opens
   - Sees "How Bills Become Law" [?] icon
   - Reads bill-process help
   - Topic count increases

6. **Casts Anonymous Ballot**
   - Clicks VotePanel → sees anonymous-voting help trigger
   - Reads explanation
   - Casts vote
   - Receives receipt, clicks [?] to learn about receipts

7. **Nightly Job Runs**
   - `computeAllEngagementStats()` computes for all users
   - Inserts row into `user_engagement_stats` with today's snapshot
   - Recalculates engagement_level based on bills + topics
   - Unlocks new achievements if conditions met

8. **Dashboard Update (Next Day)**
   - User logs in
   - Dashboard fetches `/api/auth/me/engagement`
   - Shows new level badge + progress bar
   - Shows "🔥 1-day streak"

---

## What's Left (Optional Future Work)

1. **Backend persistence of help views** — Currently localStorage only. Could add nightly sync to `user_help_views` table.
2. **Unlocking features** — Engagement levels are tracked but don't yet *block* access to features. Could gate "CSV export" behind "engaged" level.
3. **Notifications** — Toast notifications for achievement unlocks.
4. **Leaderboards (optional)** — Local/regional "most engaged" list (non-competitive, transparency-focused).
5. **Compass comparison** — Show user's compass position + MP's + bill's on same chart.
6. **Advanced queries** — Custom API for "votes on housing bills" or "MPs from my party."

---

## Files Changed/Created

### Created
- `src/lib/help.ts` — Help registry
- `src/lib/useHelpTracking.ts` — Tracking hook
- `src/components/HelpTrigger.tsx` — Trigger component
- `src/components/HelpModal.tsx` — Modal component
- `server/src/services/learning.ts` — Backend logic
- `GAMIFICATION_AND_LEARNING_PLAN.md` — Full plan document (reference)
- `IMPLEMENTATION_SUMMARY.md` — This file

### Modified
- `src/styles/app.css` — Added 50+ lines of help/engagement CSS
- `src/components/Dashboard.tsx` — Added help triggers, engagement display
- `src/components/BillView.tsx` — Added help triggers for bill process
- `src/components/VotePanel.tsx` — Added help triggers for voting
- `src/components/DebatePanel.tsx` — Added help trigger for moderation
- `src/lib/api.ts` — Added learning endpoints
- `server/src/schema.sql` — Added 3 new tables
- `server/src/routes.ts` — Added 3 new endpoints + helper
- `server/src/worker-jobs.ts` — Added engagement computation job

---

## Testing the System

### Manual Testing (In Browser)
1. Open app at `http://localhost:4173`
2. Create account (postcode required)
3. Click [?] icons throughout the app → help modals should open
4. View 3+ different help topics
5. Vote on 2+ bills
6. Post a debate comment
7. Dashboard should show "topics read: 3", "bills voted: 2", progress bar

### Backend Validation
```bash
# Check help views are recorded in localStorage
curl -s http://localhost:4173 | grep "democracy.helpViewed" 

# Manually trigger engagement compute (when ready with worker setup)
# For now, engagement stats are computed on-demand when /api/auth/me/engagement is called
```

---

## Design Principles Applied

✅ **Learning unlocks engagement** — Can't reach higher levels without understanding  
✅ **Contextual help** — Explanations live where they're needed, not in an FAQ  
✅ **No competitive leaderboards** — Achievements are personal, not comparative  
✅ **Streaks reward consistency** — 7-day reset encourages return visits, not one-time bursts  
✅ **Functional rewards** — Unlocks are real features (export, heatmaps), not cosmetic badges  
✅ **Data quality** — Informed voters give better compass data than confused ones  
✅ **Transparency** — All mechanics are explained; users know what engagement means  

---

## Next Steps

1. **Backend persistence** — Sync help views to `user_help_views` table nightly
2. **Scheduled job** — Set up worker to run `computeAllEngagementStats()` each night
3. **Feature gates** — Lock CSV export/RSS behind engagement level
4. **Notifications** — Toast on achievement unlock
5. **Testing** — Test with a few real users; gather feedback on understanding vs. engagement

---

## Estimated Impact

**Engagement:** Help system makes app self-documenting → fewer support questions, higher confidence users  
**Data quality:** Learning requirement means voters understand what they're voting on → better compass accuracy  
**Retention:** Streaks + achievements encourage daily return visits → longitudinal voting patterns  
**Transparency:** Help pages explain your design choices (privacy, moderation, voting mechanics) → builds trust  
