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
EXPO_PUBLIC_API_URL=http://localhost:4000/api
```

Notes:
- `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` are required.
- The app currently resolves the backend base URL from the Expo host for local development, so `EXPO_PUBLIC_API_URL` is optional for the current setup.

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
npm run ios
npm run web
npm run lint
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

## OAuth Setup Notes

For Google, Facebook, and GitHub login to work:

1. Enable the provider in Supabase Auth.
2. Configure the provider credentials in Supabase.
3. Add mobile redirect URLs in Supabase Auth URL Configuration.

Typical redirect URL during Expo Go development:

```txt
exp://<your-local-ip>:8081/--/auth-callback
```

Typical wildcard allow-list entry:

```txt
exp://**/--/auth-callback
```

The app also supports a custom callback route:

```txt
project://auth-callback
```

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
- confirm Supabase redirect URLs match the current Expo URL
- restart Metro with cache clear:

```bash
npx expo start -c
```

If the app cannot reach the API, verify that your phone and dev machine are on the same network and that port `4000` is reachable.
