# Backend DB Reconciliation

This note helps reconcile an existing Supabase database with what the current backend code expects.

## Current Result

Based on the current backend code and the schema snapshot you shared:

- No table or column needs to be deleted right now.
- The main thing to ensure is that `habit_logs` matches the current backend expectations.

## Required Checks

The current backend expects:

1. `public.characters.gold_coins`
2. `public.habit_logs.gold_change`
3. unique constraint on `public.habit_logs (habit_id, log_date)`
4. `habit_logs.status` values compatible with:
   - `completed`
   - `missed`
   - `punished`
   - `avoided`
   - `failed`

From your schema snapshot:

- `characters.gold_coins`: already present
- `habit_logs.gold_change`: missing in the original schema
- unique `(habit_id, log_date)`: not present in the original schema you shared

## What To Run In Supabase SQL Editor

### 1. Quick verification

Run [sql_editor_reconcile_backend.sql](./sql_editor_reconcile_backend.sql).

That file includes:

- a preflight check query
- an idempotent add for `habit_logs.gold_change`
- an idempotent add for the unique constraint

### 2. Older `habit_logs.status` schema

If your database still uses an older `habit_logs.status` definition, run:

- [migrations/20260410_update_habit_log_statuses.sql](./migrations/20260410_update_habit_log_statuses.sql)

That migration:

- validates existing status values
- stops if duplicate `(habit_id, log_date)` rows exist
- migrates status to the current supported enum
- adds the unique constraint

### 3. Gold support

If `gold_change` is missing, run:

- [migrations/20260419_add_gold_change_to_habit_logs.sql](./migrations/20260419_add_gold_change_to_habit_logs.sql)

## No Delete Step Needed

At the moment, I do not recommend dropping any tables, columns, or constraints for compatibility with the current backend.

If you want to clean unused legacy DB objects later, do that as a separate pass after verifying the app is stable.
