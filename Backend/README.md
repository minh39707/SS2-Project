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
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
GEMINI_API_KEY=your_gemini_api_key
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

## Database Reconciliation

If your Supabase database was created from an older schema snapshot, compare it with the current backend expectations before running the app.

Useful files:

- [migrations/20260410_update_habit_log_statuses.sql](./migrations/20260410_update_habit_log_statuses.sql)
- [migrations/20260419_add_gold_change_to_habit_logs.sql](./migrations/20260419_add_gold_change_to_habit_logs.sql)
- [sql_editor_reconcile_backend.sql](./sql_editor_reconcile_backend.sql)
- [DB_RECONCILIATION.md](./DB_RECONCILIATION.md)
