# SS2 Project

This repository contains two applications:

- `Frontend/`: Expo React Native mobile app
- `Backend/`: Express API server

## Project Structure

```txt
Frontend/
Backend/
```

## Frontend

The frontend is built with Expo Router and React Native.

Useful commands:

```bash
cd Frontend
npm install
npm start
```

## Backend

The backend is built with Express and Supabase.

Useful commands:

```bash
cd Backend
npm install
npm run dev
```

## Notes

- Frontend and backend each keep their own dependencies and environment files
- Create these environment files before running the apps:
  - `Frontend/.env` for Expo public variables such as Supabase keys
  - `Backend/.env` for server variables such as `PORT`, `SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY`
- `Frontend/.env.local` is optional for machine-specific LAN overrides and is ignored by git
- See `Frontend/README.md` and `Backend/README.md` for app-specific details
