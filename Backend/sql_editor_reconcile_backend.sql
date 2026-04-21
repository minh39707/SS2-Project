-- Run this in Supabase SQL Editor to verify and reconcile the current backend schema.
-- Safe to re-run. It only adds missing pieces that the current backend expects.

-- 1. Preflight checks
select
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'habit_logs'
      and column_name = 'gold_change'
  ) as has_habit_logs_gold_change,
  exists (
    select 1
    from pg_constraint
    where connamespace = 'public'::regnamespace
      and conname = 'habit_logs_habit_id_log_date_key'
  ) as has_habit_logs_unique_key,
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'characters'
      and column_name = 'gold_coins'
  ) as has_characters_gold_coins;

-- 2. Reconcile required schema pieces
begin;

alter table public.habit_logs
add column if not exists gold_change integer not null default 0;

do $$
begin
  if exists (
    select 1
    from public.habit_logs
    group by habit_id, log_date
    having count(*) > 1
  ) then
    raise exception
      'habit_logs contains duplicate (habit_id, log_date) rows. Resolve duplicates before adding the unique constraint.';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where connamespace = 'public'::regnamespace
      and conname = 'habit_logs_habit_id_log_date_key'
  ) then
    alter table public.habit_logs
      add constraint habit_logs_habit_id_log_date_key
      unique (habit_id, log_date);
  end if;
end $$;

commit;
