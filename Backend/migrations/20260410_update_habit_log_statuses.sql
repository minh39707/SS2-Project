begin;

do $$
declare
  v_schema_name text := 'public';
  v_table_name text := 'habit_logs';
  v_column_name text := 'status';
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = v_schema_name
      and table_name = v_table_name
      and column_name = v_column_name
  ) then
    if exists (
      select 1
      from public.habit_logs
      where status::text not in ('completed', 'missed', 'punished', 'avoided', 'failed')
    ) then
      raise exception
        'habit_logs.status contains values outside the supported migration set.';
    end if;

    if exists (
      select 1
      from public.habit_logs
      group by habit_id, log_date
      having count(*) > 1
    ) then
      raise exception
        'habit_logs contains duplicate (habit_id, log_date) rows. Resolve duplicates before applying the unique constraint.';
    end if;

    if not exists (
      select 1
      from pg_type
      where typnamespace = 'public'::regnamespace
        and typname = 'habit_log_status_enum_v2'
    ) then
      create type public.habit_log_status_enum_v2 as enum (
        'completed',
        'missed',
        'punished',
        'avoided',
        'failed'
      );
    end if;

    if not exists (
      select 1
      from information_schema.columns
      where table_schema = v_schema_name
        and table_name = v_table_name
        and column_name = 'status_v2'
    ) then
      alter table public.habit_logs
        add column status_v2 public.habit_log_status_enum_v2;
    end if;

    update public.habit_logs
    set status_v2 = status::text::public.habit_log_status_enum_v2
    where status_v2 is null;

    alter table public.habit_logs
      alter column status_v2 set not null;

    alter table public.habit_logs
      drop column status;

    alter table public.habit_logs
      rename column status_v2 to status;

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
  end if;
end $$;

commit;
