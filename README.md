# SS2 Project

This repository contains two apps:

- `Frontend/`: Expo React Native mobile app
- `Backend/`: Express API server

## Quick Start

1. Clone the repo and install dependencies for both apps:

```bash
git clone <your-repo-url>
cd SS2-Project

cd Backend
npm install

cd ../Frontend
npm install
```

2. Create the required environment files.

Backend: create `Backend/.env`

```env
PORT=4000
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

Frontend: create `Frontend/.env`

```env
EXPO_PUBLIC_SUPABASE_URL=your_supabase_project_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Optional: create `Frontend/.env.local` if you want to pin the frontend to a fixed backend host.

```env
EXPO_PUBLIC_API_HOST=192.168.1.10
EXPO_PUBLIC_API_PORT=4000
EXPO_PUBLIC_API_SCHEME=http
```

3. Start the backend first:

```bash
cd Backend
npm run dev
```

The API will run at:

```txt
http://localhost:4000/api
```

4. Start the frontend:

```bash
cd Frontend
npx expo start
```

Useful frontend commands:

```bash
npm run android
npm run android:lan
npm run android:emulator
npm run lint
```

## Supabase URL Configuration

For this app, the Expo scheme is `project`, so in Supabase Auth > URL Configuration set:

```txt
Site URL: project://auth-callback
```

That is the minimum mobile callback URL this app expects.

## Run Order

- Start `Backend` first
- Then start `Frontend`
- If you change `.env` or `.env.local`, restart Expo with cache clear:

```bash
cd Frontend
npx expo start -c
```

## Notes

- Frontend and backend keep separate dependencies and `.env` files.
- `Frontend/.env.local` is machine-specific and should stay out of git.
- More app-specific details are in `Frontend/README.md` and `Backend/README.md`.
