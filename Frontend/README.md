# HabitForge Frontend

Frontend mobile app for HabitForge, built with Expo Router and React Native.

This app covers:
- onboarding flow for choosing a habit and schedule
- authentication with email and OAuth
- Supabase session handling on mobile
- dashboard experience for the signed-in user

## Tech Stack

- Expo SDK 54
- React Native 0.81
- Expo Router
- Supabase Auth
- AsyncStorage

## Supported Auth Methods

- Email / password
- Google
- Facebook
- GitHub

OAuth is handled with Supabase plus `expo-web-browser` and a mobile callback route at `auth-callback`.

## Project Structure

```txt
app/
  (auth)/              Auth routes
  (onboarding)/        Onboarding routes
  (tabs)/              Main app tabs
  auth-callback.jsx    OAuth callback screen
src/
  components/          Reusable UI
  constants/           Theme and onboarding constants
  hooks/               App hooks
  screens/             Screen implementations
  services/            API, Supabase, auth, storage
  store/               Global onboarding/auth state
  utils/               Helpers
```

## Environment Variables

Create `Frontend/.env` with:

```env
EXPO_PUBLIC_SUPABASE_URL=your_supabase_project_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Notes:
- `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` are required.
- The app resolves the backend base URL from the Expo host for local LAN development, so `EXPO_PUBLIC_API_URL` is optional and should usually be left unset in Expo Go.
- Optional overrides for a fixed local backend:

```env
# Exact backend URL override
EXPO_PUBLIC_API_URL=http://192.168.1.10:4000/api

# Or compose it from host/port
EXPO_PUBLIC_API_HOST=192.168.1.10
EXPO_PUBLIC_API_PORT=4000
EXPO_PUBLIC_API_SCHEME=http
```

## Local Development

Install dependencies:

```bash
npm install
```

Start the frontend:

```bash
npx expo start
```

Useful shortcuts:

```bash
npm run android
npm run android:lan
npm run ios
npm run web
npm run lint
npm run start:lan
```

## Backend Requirement

This frontend expects the local backend to be running on port `4000`.

From the `Backend` folder:

```bash
npm install
npm run dev
```

Default backend URL assumptions in the app:
- Expo device on LAN: `http://<your-dev-machine-ip>:4000/api`
- Android emulator: `http://10.0.2.2:4000/api`
- iOS simulator / local web: `http://localhost:4000/api`

Recommended startup order:

1. Start the backend
2. Start the frontend
3. If you change `.env` or `.env.local`, restart Expo with `npx expo start -c`

Recommended setup for multiple devices on the same Wi-Fi:
- Run `npm run start:lan` to auto-detect your current LAN IP and write it to `.env.local`.
- This generated `.env.local` is ignored by git, so each developer or machine can keep its own network config.
- Keep the backend running on your dev machine at port `4000`.
- Only set `EXPO_PUBLIC_API_URL` or `EXPO_PUBLIC_API_HOST` when you need to point every device to a fixed backend host manually.

Example:

```bash
cd Frontend
npm run start:lan
```

Or, if Expo is already running:

```bash
npm run configure:lan
```

## Supabase Auth URL Configuration

This app uses the Expo scheme `project`, so in Supabase Auth > URL Configuration set:

```txt
Site URL: project://auth-callback
```

That is the base mobile callback this app expects when handling OAuth.

## Current App Behavior

- onboarding state is stored locally per account scope
- signed-in sessions are persisted with Supabase
- onboarding habit sync is sent to the backend after authentication when needed
- dashboard requests use the authenticated access token

## Lint Status

`npm run lint` currently passes with warnings only. Some warnings are older repo-level cleanup items such as BOM markers and a few unused variables in unrelated files.

## Troubleshooting

If OAuth seems stuck or returns to the wrong place:

- make sure the backend is running
- confirm `.env` has valid Supabase values
- confirm Supabase `Site URL` is `project://auth-callback`
- restart Metro with cache clear:

```bash
npx expo start -c
```

If the app cannot reach the API, verify that your phone and dev machine are on the same network and that port `4000` is reachable.

If you switch between emulator and real devices often:
- Prefer `npm run start:lan` for Expo Go on LAN.
- Use `EXPO_PUBLIC_API_URL=http://10.0.2.2:4000/api` only for Android emulator-specific sessions.
