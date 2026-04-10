# Statistics And Analytics Handoff

This document is for agents who need to understand or change the current statistics, dashboard, and analytics behavior.

## 1. Read This First

Primary backend files:

- `Backend/src/routes/dashboard.js`
- `Backend/src/routes/users.js`
- `Backend/src/routes/habits.js`
- `Backend/src/utils/habitProgress.js`
- `Backend/src/utils/userAnalytics.js`
- `Backend/supabase_schema.sql`

Primary frontend consumers:

- `Frontend/src/services/habit.service.js`
- `Frontend/src/services/user.service.js`
- `Frontend/src/screens/home/HomeScreen.jsx`

## 2. Main API Surfaces

### `GET /api/dashboard`

Purpose:

- home screen data
- quick actions for habits
- weekly calendar state
- compact HP / EXP / Streak cards
- daily completion summary

Source:

- habits
- habit logs
- character progress

### `GET /api/users/me/stats`

Purpose:

- lightweight HP / EXP / Streak cards only

Source:

- characters
- global streak derived from habit logs

### `GET /api/users/me/analytics?days=7|30|...`

Purpose:

- richer analytics screen payload
- summary counters
- day-by-day trend
- top habits
- streak habit ranking
- category breakdown
- weekday breakdown
- 26-week heatmap

Source:

- habits
- habit logs
- habit categories
- characters
- users profile

## 3. Database Tables That Actually Matter

### Required tables

#### `users`

Used for:

- profile info in analytics response
- ownership of habits/logs/character

Relevant columns:

- `user_id`
- `username`
- `avatar_url`
- `created_at`
- `updated_at`

#### `characters`

Used for:

- level
- current HP / max HP
- current EXP / EXP to next level

Relevant columns:

- `character_id`
- `user_id`
- `level`
- `current_hp`
- `max_hp`
- `current_exp`
- `exp_to_next_level`

This table is the source of truth for player progression shown in stats.

#### `habits`

Used for:

- which habits belong to the user
- whether a habit is active
- its frequency and schedule
- rewards used when completing

Relevant columns:

- `habit_id`
- `user_id`
- `category_id`
- `title`
- `description`
- `habit_type`
- `target_value`
- `target_unit`
- `frequency_type`
- `frequency_days`
- `hp_reward`
- `exp_reward`
- `streak_bonus_exp`
- `is_active`
- `created_at`
- `updated_at`

Important:

- scheduling is not derived only from `frequency_type` and `frequency_days`
- the start date is also parsed from `description` when present

#### `habit_logs`

Used for:

- completion status per date
- EXP gained history
- HP change history
- streak snapshot at completion time

Relevant columns:

- `log_id`
- `habit_id`
- `user_id`
- `log_date`
- `status`
- `value_recorded`
- `hp_change`
- `exp_change`
- `streak_at_log`
- `source`
- `logged_at`

This is the most important table for analytics because nearly all trend views are derived from it.

#### `habit_streaks`

Used for:

- persisted streak snapshot per habit

Relevant columns:

- `streak_id`
- `habit_id`
- `user_id`
- `current_streak`
- `best_streak`
- `last_completed_at`
- `updated_at`

Important:

- current analytics/dashboard logic does not rely on this table to compute streaks
- streaks are recalculated from `habit_logs`, then this table is synced mainly as a denormalized snapshot

#### `habit_categories`

Used for:

- human-readable category labels
- category breakdown in analytics

Relevant columns:

- `category_id`
- `name`

### Removed table note

#### `analytics_daily`

This table used to exist as an idea for precomputed daily analytics, but it has been removed from the live Supabase database.

Current analytics payload is marked as:

- `source: "derived_from_habits_and_logs"`

Meaning:

- dashboard/stats/analytics are computed on demand from `habits`, `habit_logs`, `characters`, and category labels
- if a future agent wants precomputed analytics, that would be a new architecture change rather than restoring previous behavior

## 4. Core Logic Ownership

### Scheduling logic

Lives in `Backend/src/utils/habitProgress.js`.

Key rules:

- inactive habits are never scheduled
- habit start date comes from description metadata if available, otherwise `created_at`
- `daily` habits are due every day after start date
- `weekly` habits are due only on `frequency_days`
- `monthly` habits are due on the day-of-month matching the habit start date
- if a month has fewer days, the scheduled day is clamped to the last day of that month

### Habit streak logic

There are two streak concepts:

#### Global streak

Definition:

- number of consecutive calendar days ending today or yesterday where the user completed at least one habit

Used by:

- dashboard stats
- `/users/me/stats`
- analytics summary player data
- weekly calendar flame markers

Important:

- global streak ignores habit schedule
- it only cares whether there was any completed log on a date

#### Per-habit streak

Definition:

- consecutive scheduled occurrences completed for one habit

Used by:

- habit cards
- top habits
- streak habits ranking
- completion response payload

Important:

- per-habit streak does respect the habit schedule
- skipped non-scheduled days do not break the streak
- missing a scheduled day breaks the streak

### Progression logic

When a habit is completed:

1. backend checks the habit exists and belongs to the user
2. backend checks the habit is scheduled today
3. backend checks whether a completed log already exists for today
4. backend recalculates the next habit streak from logs
5. backend computes rewards:
   - EXP = `habit.exp_reward`
   - plus `habit.streak_bonus_exp` if next streak is greater than 1
   - HP = `habit.hp_reward`
6. backend inserts a `habit_logs` row
7. backend updates `habit_streaks`
8. backend updates `characters` using `applyCharacterProgress`

When completion is undone:

1. backend deletes today log
2. backend recalculates streak from remaining logs
3. backend subtracts `todayLog.exp_change`
4. backend subtracts `todayLog.hp_change`
5. backend syncs `habit_streaks`
6. backend updates `characters`

Important:

- level-up behavior is handled in `applyCharacterProgress`
- EXP can roll over into the next level
- HP is clamped between `0` and `max_hp`

## 5. How Each Response Is Derived

### Dashboard response

Main derived fields:

- `todayProgress`
  - ratio of completed scheduled habits for today
- `dailySummary.completedCount`
  - number of scheduled habits completed today
- `dailySummary.totalCount`
  - number of habits scheduled today
- `stats`
  - HP / EXP from `characters`
  - Streak from global streak calculation
- `player`
  - compact player summary from `characters` + global streak
- `quickActions`
  - one row per habit with current completion/streak state
- `calendarDays`
  - current week calendar with `done`, `warning`, `missed`, or `empty`

Special normalization:

- onboarding-generated duplicate habits with the same title are deduplicated for dashboard output
- the latest onboarding habit by title wins

### `/users/me/stats` response

Very small payload:

- HP card
- EXP card
- Streak card

No per-day analytics here.

### `/users/me/analytics` response

Main sections:

- `range`
- `summary`
- `player`
- `stats`
- `activityHeatmap`
- `weekdayBreakdown`
- `categoryBreakdown`
- `streakHabits`
- `recentDays`
- `topHabits`
- `generatedAt`
- `source`

The `days` query is normalized:

- default `7`
- minimum `1`
- maximum `90`

## 6. Analytics Breakdown Definitions

### `summary`

Derived across the requested date range:

- `scheduledCount`
- `completedCount`
- `missedCount`
- `totalExpGained`
- `totalHpChange`
- `completionRate`
- `activeDays`
- `activeHabitCount`
- `activeGlobalStreak`
- `bestHabitStreak`
- `dueTodayCount`
- `completedTodayCount`
- `remainingTodayCount`

### `recentDays`

For each day in range:

- how many habits were scheduled
- how many scheduled habits were completed
- how many were missed
- completion rate
- EXP gained
- HP change
- whether the date is in the active global streak

### `topHabits`

Sorted by:

1. `completedCount` descending
2. `completionRate` descending
3. `currentStreak` descending

Each habit includes:

- range completion counts
- current/best streak
- last completion date
- EXP/HP totals within range
- whether it is due today
- whether it is completed today

### `weekdayBreakdown`

Aggregates `recentDays` into Mon-Sun buckets with:

- completed count
- scheduled count
- missed count
- completion rate

### `categoryBreakdown`

Uses:

- category label from `habit_categories`
- fallback label parsed from habit description
- final fallback `"Other"`

Important:

- only completed logs in the requested range are counted
- if there are no completed logs, it falls back to counting existing habits by category so the chart is not empty

### `streakHabits`

Ranks habits by:

1. current streak descending
2. best streak descending

Only habits with some streak history or a last completion date are included.

### `activityHeatmap`

Shows 26 weeks of completed-log density.

Important:

- this is based on number of completed logs per day
- intensity is relative to the max completed count within the 26-week window

## 7. Important Caveats For Future Agents

### `analytics_daily` has been removed

It is not part of the current live data flow.

If you want precomputed analytics later, that is a future architectural change, not the current implementation.

### Description text is part of the data model

The code parses habit metadata from `habits.description`, including:

- category label
- preferred time
- start date
- reminders

So changing description format can accidentally break:

- scheduling
- category fallback logic
- serialized habit metadata

### Time-based habits still end in normal completion logs

The focus timer UX is different on the frontend, but after the timer finishes the backend still records completion through the habit completion flow.

### Global streak is not "all habits done"

It means:

- at least one completed habit on consecutive calendar days

If another agent assumes it means full daily completion, they will change behavior incorrectly.

### Per-habit streak is schedule-aware

This is easy to miss.

Example:

- a weekly Monday habit does not lose streak on Tuesday
- it loses streak only when a scheduled Monday is missed

### Dashboard and analytics are derived live

Habit completion or undo invalidates frontend caches for:

- dashboard
- habit list/detail
- user profile
- user stats
- common analytics ranges

This is why the UI refreshes after completion.

## 8. Recommended Read Order For Another Agent

1. Read `Backend/src/utils/habitProgress.js`
2. Read `Backend/src/routes/habits.js`
3. Read `Backend/src/routes/dashboard.js`
4. Read `Backend/src/utils/userAnalytics.js`
5. Read `Backend/src/routes/users.js`
6. Read `Frontend/src/services/habit.service.js`
7. Read `Frontend/src/services/user.service.js`
8. Read `Frontend/src/screens/home/HomeScreen.jsx`

## 9. If You Need To Change Something

### Change a formula or streak rule

Start in:

- `Backend/src/utils/habitProgress.js`

### Change analytics payload shape

Start in:

- `Backend/src/utils/userAnalytics.js`
- `Backend/src/routes/users.js`

### Change dashboard card content

Start in:

- `Backend/src/routes/dashboard.js`
- `Frontend/src/screens/home/HomeScreen.jsx`

### Change reward effects after completion

Start in:

- `Backend/src/routes/habits.js`
- `Backend/src/utils/habitProgress.js`

## 10. Fast Mental Model

If another agent wants the shortest possible explanation:

- `habits` says what should happen
- `habit_logs` says what actually happened
- `habitProgress.js` decides due/missed/streak/progress
- `characters` stores HP/EXP/level
- `habits.js` mutates logs and character progress
- `dashboard.js` builds home-screen stats
- `userAnalytics.js` builds analytics screen data
- `analytics_daily` was removed; analytics are derived live today

## 11. Useful Debug SQL

Replace `:user_id` and `:habit_id` with real UUID values.

### Inspect the user's current habit set

```sql
select
  habit_id,
  title,
  is_active,
  frequency_type,
  frequency_days,
  target_value,
  target_unit,
  hp_reward,
  exp_reward,
  streak_bonus_exp,
  created_at
from public.habits
where user_id = :user_id
order by created_at desc;
```

### Inspect habit logs in date order

```sql
select
  log_id,
  habit_id,
  log_date,
  status,
  value_recorded,
  hp_change,
  exp_change,
  streak_at_log,
  source,
  logged_at
from public.habit_logs
where user_id = :user_id
order by log_date asc, logged_at asc;
```

### Inspect one habit's streak snapshot and log history together

```sql
select
  hs.habit_id,
  hs.current_streak,
  hs.best_streak,
  hs.last_completed_at,
  hs.updated_at
from public.habit_streaks hs
where hs.user_id = :user_id
  and hs.habit_id = :habit_id;

select
  log_date,
  status,
  hp_change,
  exp_change,
  streak_at_log
from public.habit_logs
where user_id = :user_id
  and habit_id = :habit_id
order by log_date asc;
```

### Inspect current player progression

```sql
select
  character_id,
  level,
  current_hp,
  max_hp,
  current_exp,
  exp_to_next_level,
  updated_at
from public.characters
where user_id = :user_id;
```

### Inspect category labels used by analytics

```sql
select
  h.habit_id,
  h.title,
  h.category_id,
  hc.name as category_name
from public.habits h
left join public.habit_categories hc
  on hc.category_id = h.category_id
where h.user_id = :user_id
order by h.created_at desc;
```

## 12. Quick Manual Checks After A Change

- complete a due habit and confirm a new `habit_logs` row is inserted
- undo that completion and confirm the row is deleted
- confirm `characters.current_exp` and `characters.current_hp` move with the log changes
- confirm `habit_streaks` syncs after complete and undo
- confirm `/api/dashboard` and `/api/users/me/stats` show the same HP / EXP / global streak values
- confirm `/api/users/me/analytics?days=7` and `?days=30` still return valid summary/top habits/category breakdown payloads
