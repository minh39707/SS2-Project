# Project Handoff

This file is the fastest way for a new agent to understand the current state of the repository, run the app locally, and continue work safely.

## 1. Repository Overview

- Repo type: monorepo
- Root path: `d:\Another project`
- Remote: `origin` -> `https://github.com/minh39707/SS2-Project.git`
- Main apps:
  - `Frontend/`: Expo Router + React Native mobile app
  - `Backend/`: Express API server
- Primary backend/data provider: Supabase

## 2. Current Product Scope

This project is a habit-tracking mobile app with:

- onboarding flow
- authentication with Supabase
- home dashboard
- habit creation and management
- streak / EXP / HP / level progression
- focus timer flow for time-based habits
- floating AI coach bubble

## 3. Important Current State

These behaviors are already implemented and should be preserved unless intentionally changed:

- Habit completion is wired end-to-end from frontend to backend.
- Streak, EXP, HP, and level updates are calculated on the backend.
- Time-based habits use a focus-timer flow instead of instant completion.
- Home no longer limits `Your Habits` to 4 items.
- The floating coach bubble is compact, draggable, and icon-only.
- Frontend lint had been cleaned up and should stay clean.

## 4. Repo Structure

### Frontend

- Entry/routing:
  - `Frontend/app/_layout.jsx`
  - `Frontend/app/(tabs)/_layout.jsx`
  - `Frontend/app/auth-callback.jsx`
  - `Frontend/app/habit-focus.jsx`
- Screens:
  - `Frontend/src/screens/home/HomeScreen.jsx`
  - `Frontend/src/screens/habits/ManageHabitsScreen.jsx`
  - `Frontend/src/screens/habits/CreateHabitScreen.jsx`
  - `Frontend/src/screens/habits/HabitFocusScreen.jsx`
- Services:
  - `Frontend/src/services/api.js`
  - `Frontend/src/services/habit.service.js`
  - `Frontend/src/services/user.service.js`
  - `Frontend/src/services/onboardingApi.js`
  - `Frontend/src/services/supabaseAuth.js`
  - `Frontend/src/services/onboardingStorage.js`
  - `Frontend/src/services/resourceCache.js`
- Shared utilities:
  - `Frontend/src/utils/habitActions.js`
  - `Frontend/src/utils/habitTimer.js`
- Coach bubble:
  - `Frontend/src/components/layout/AssistantChat.jsx`

### Backend

- Server entry:
  - `Backend/src/index.js`
- Routes:
  - `Backend/src/routes/auth.js`
  - `Backend/src/routes/onboarding.js`
  - `Backend/src/routes/users.js`
  - `Backend/src/routes/dashboard.js`
  - `Backend/src/routes/habits.js`
- Utilities:
  - `Backend/src/utils/habitProgress.js`

## 5. How To Run Locally

### Backend

Create `Backend/.env`:

```env
PORT=4000
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

Run:

```bash
cd Backend
npm install
npm run dev
```

Health check:

```txt
http://localhost:4000/api/health
```

### Frontend

Create `Frontend/.env`:

```env
EXPO_PUBLIC_SUPABASE_URL=your_supabase_project_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Optional machine-specific override in `Frontend/.env.local`:

```env
EXPO_PUBLIC_API_HOST=192.168.1.10
EXPO_PUBLIC_API_PORT=4000
EXPO_PUBLIC_API_SCHEME=http
```

Run:

```bash
cd Frontend
npm install
npx expo start -c
```

Useful commands:

```bash
npm run android
npm run android:emulator
npm run android:lan
npm run lint
```

## 6. Backend URL Resolution

Frontend backend resolution lives in `Frontend/src/services/api.js`.

It supports:

- explicit `EXPO_PUBLIC_API_URL`
- `EXPO_PUBLIC_API_HOST` + port + scheme
- Expo/LAN inference
- Android emulator aliases:
  - `10.0.2.2`
  - `10.0.3.2`

The frontend probes `/api/health` and uses the first healthy backend candidate.

## 7. Supabase / OAuth Notes

- Expo app scheme is `project`.
- Frontend OAuth callback logic lives in `Frontend/src/services/supabaseAuth.js`.
- Callback route is `auth-callback`.
- Current mobile callback expectation:

```txt
project://auth-callback
```

For Supabase Auth URL Configuration, the minimal required setting is:

```txt
Site URL: project://auth-callback
```

Important note:

- `Frontend/app/auth-callback.jsx` may contain local-only user edits.
- Do not automatically include or commit that file unless explicitly confirmed.

## 8. Key Frontend Architecture Notes

### API and data layer

- `api.js` is the shared fetch client and backend URL resolver.
- `habit.service.js` wraps habit/dashboard HTTP calls and cache invalidation.
- `user.service.js` wraps user profile/stat requests and cache updates.
- `resourceCache.js` is a lightweight in-memory cache helper.
- `onboardingStorage.js` stores onboarding state in AsyncStorage.

### Habit actions

Habit action logic was intentionally centralized to reduce duplication:

- `habitActions.js`
  - determines whether a habit should `Start`, `Complete`, `Undo`, or `Open`
  - routes time-based habits into focus mode
- `habitTimer.js`
  - normalizes time units
  - supports common variants like:
    - `seconds`, `second`, `sec`, `s`
    - `minutes`, `minute`, `min`, `m`
    - `hours`, `hour`, `hr`, `h`

### Habit creation UI

`CreateHabitScreen.jsx` currently supports direct numeric input and built-in units:

- `times`
- `steps`
- `cal`
- `kcal`
- `seconds`
- `minutes`
- `hours`
- `g`
- `kg`
- `mL`
- `L`
- `m`
- `km`
- `Custom`

## 9. Key Backend Architecture Notes

### Route map

Mounted in `Backend/src/index.js`:

- `/api/auth`
- `/api/onboarding`
- `/api/users`
- `/api/dashboard`
- `/api/habits`
- `/api/health`

### Business logic ownership

Backend is the source of truth for:

- habit completion rules
- streak calculation
- EXP / HP / level progression
- dashboard aggregation
- profile persistence
- onboarding habit sync

### Refactor status

Recent cleanup already moved repeated logic into helpers, especially in:

- `Backend/src/routes/habits.js`
- `Backend/src/routes/dashboard.js`
- `Backend/src/routes/auth.js`
- `Backend/src/routes/users.js`
- `Backend/src/routes/onboarding.js`

If editing those files, prefer extending the shared helpers rather than reintroducing repeated payload or response builders.

## 10. Core Flows To Preserve

### Normal habit completion

1. User taps action in Home or Manage Habits.
2. Frontend service calls backend habit endpoint.
3. Backend validates due status and existing completion.
4. Backend writes habit log and recalculates progression.
5. Frontend refreshes dashboard/habit state.

### Time-based habit completion

1. Habit unit resolves to a time unit.
2. UI action label should be `Start`, not `Complete`.
3. User enters `Focus Mode`.
4. Countdown runs in `HabitFocusScreen`.
5. Completion is applied after timer completion, not immediately on tap.

### OAuth

1. App starts provider auth via Supabase.
2. Callback returns into `auth-callback`.
3. Frontend completes OAuth session handoff.
4. App redirects into main tabs once auth is resolved.

## 11. Recommended Regression Checks

After making changes, verify these manually:

- backend starts and `/api/health` responds
- frontend starts on emulator or LAN
- email auth still works
- OAuth still returns to `auth-callback`
- creating a normal habit still works
- creating a time-based habit still works
- time-based habit enters focus mode
- normal habit can complete and undo
- time-based habit does not instantly complete on first tap
- Home shows all habits, not only 4
- coach bubble still opens and can be dragged

## 12. Known Local-Only Caveat

At the time this handoff file was created:

- `Frontend/app/auth-callback.jsx` was intentionally treated as a user-local change.
- Agents should inspect it before staging or rewriting it.
- If making broad repo commits, exclude that file unless the user explicitly asks to include it.

## 13. Suggested Next Work Areas

Reasonable next tasks for a new agent:

- add seed / fixture data for easier testing
- add a documented test checklist or smoke test script
- improve UI polish for focus mode and reward feedback
- add stronger backend validation around habit units and target values
- add dedicated tests if the repo later adopts a test runner

## 14. Working Style Recommendation For Future Agents

- Preserve the current split of responsibilities:
  - frontend services for client concerns
  - backend routes/utils for business rules
- Avoid duplicating habit action logic between screens.
- Avoid reintroducing ad-hoc backend URL logic outside `api.js`.
- Be careful with `auth-callback.jsx` because it may contain user-only local edits.
- Prefer small cohesive helpers when reducing duplication, but keep file count reasonable.
