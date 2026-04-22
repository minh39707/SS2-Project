# HabitForge API

Express + Supabase backend for the HabitForge mobile app.

This backend currently handles:
- auth and OAuth sync
- users and profile stats
- dashboard aggregation
- habit creation and completion
- streak / EXP / HP / level progression
- analytics payloads
- Ollama-powered local AI chat/check-in plus Gemini-powered analytics PDF reports

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create `Backend/.env`

```env
PORT=4000
APP_TIME_ZONE=Asia/Ho_Chi_Minh
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
AI_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=qwen3:8b
OLLAMA_KEEP_ALIVE=10m
OLLAMA_THINK=false
LOCAL_AI_TIMEOUT_MS=180000
GEMINI_API_KEY=your_gemini_api_key
GEMINI_REPORT_MODEL=gemini-2.0-flash
GEMINI_REPORT_TIMEOUT_MS=60000
```

## Backend Env

`Backend/.env` variables:

- `PORT`: local Express port, usually `4000`
- `APP_TIME_ZONE`: timezone used for habit dates, streaks, AI check-ins, and analytics date ranges; defaults to `Asia/Ho_Chi_Minh`
- `SUPABASE_URL`: Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY`: backend admin key for database operations
- `AI_PROVIDER`: local AI provider; this backend uses `ollama`
- `LOCAL_AI_TIMEOUT_MS`: optional Ollama timeout in milliseconds, default `60000`
- `OLLAMA_BASE_URL`: Ollama base URL, default `http://localhost:11434`
- `OLLAMA_MODEL`: Ollama model name, default `qwen3:8b`
- `OLLAMA_CHAT_MODEL`: optional Ollama model override for chat
- `OLLAMA_TASK_MODEL`: optional Ollama model override for quest generation and analytics insight
- `OLLAMA_KEEP_ALIVE`: optional duration to keep the Ollama model loaded, default `10m`
- `OLLAMA_THINK`: set `true` to enable thinking output for compatible Ollama models; default is disabled for JSON reliability
- `GEMINI_API_KEY`: Gemini key used only for analytics PDF report generation
- `GEMINI_REPORT_MODEL`: optional Gemini model for PDF report analysis, default `gemini-2.0-flash`
- `GEMINI_REPORT_TIMEOUT_MS`: optional Gemini report timeout in milliseconds, default `45000`

Notes:

- keep all backend secrets only in `Backend/.env`
- run Ollama locally before using AI routes

```env
AI_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=qwen3:8b
OLLAMA_KEEP_ALIVE=10m
OLLAMA_THINK=false
LOCAL_AI_TIMEOUT_MS=180000
GEMINI_API_KEY=your_gemini_api_key
GEMINI_REPORT_MODEL=gemini-2.0-flash
GEMINI_REPORT_TIMEOUT_MS=60000
```

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
