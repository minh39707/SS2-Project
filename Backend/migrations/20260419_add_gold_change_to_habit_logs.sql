ALTER TABLE public.habit_logs
ADD COLUMN IF NOT EXISTS gold_change integer NOT NULL DEFAULT 0;
