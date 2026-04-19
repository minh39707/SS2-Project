# HabitForge API

Express + Supabase backend for the HabitForge mobile app.

This backend currently handles:
- auth and OAuth sync
- users and profile stats
- dashboard aggregation
- habit creation and completion
- streak / EXP / HP / level progression
- analytics payloads
- Gemini-powered AI chat, quest draft, and analytics insight routes

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create `Backend/.env`

```env
PORT=4000
SUPABASE_URL=https://kadvjcymfgtevqmjkvjv.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImthZHZqY3ltZmd0ZXZxbWprdmp2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDIwNTA0MywiZXhwIjoyMDg5NzgxMDQzfQ.H6JvlHmO0YL4XDTRH_f--ZGv8Mf_BzkXiT9MSRgba4w
GEMINI_API_KEY=AIzaSyC-VHWfAyxtU-LnehGbnmb8epdxx74WR48
GEMINI_MODEL=gemini-2.5-flash
GEMINI_CHAT_MODEL=gemini-2.5-flash
GEMINI_TASK_MODEL=gemini-2.5-flash
```

## Backend Env

`Backend/.env` variables:

- `PORT`: local Express port, usually `4000`
- `SUPABASE_URL`: Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY`: backend admin key for database operations
- `GEMINI_API_KEY`: backend-only key used for `/api/ai/chat`, `/api/ai/quest/generate`, and `/api/ai/insight`
- `GEMINI_MODEL`: default Gemini model
- `GEMINI_CHAT_MODEL`: optional override for chat
- `GEMINI_TASK_MODEL`: optional override for quest generation and analytics insight

Notes:

- keep all backend secrets only in `Backend/.env`
- do not place Gemini secrets in frontend env files
- Gemini free-tier access depends on your Google AI Studio account and current quota

## Run Locally

Start the API:

```bash
npm run dev
```

Or production-style:

```bash
npm start
```

Health check:

```txt
http://localhost:4000/api/health
```

## Main Routes

Mounted from `src/index.js`:

- `/api/auth`
- `/api/onboarding`
- `/api/users`
- `/api/dashboard`
- `/api/habits`
- `/api/ai`
- `/api/health`

AI routes:

- `POST /api/ai/chat`
- `POST /api/ai/quest/generate`
- `POST /api/ai/insight`

## Frontend Note

The frontend has its own separate env files:

- `Frontend/.env`
- `Frontend/.env.local`

Those are documented in [Frontend/README.md](../Frontend/README.md).
