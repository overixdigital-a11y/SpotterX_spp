-- ============================================================
-- SpotterX - 00017: constraint único para el upsert de logs.
-- El alumno guarda 1 log por (item, día) — `saveLogs` usa
-- upsert onConflict("item_id,log_date").
-- Ejecutar en SQL Editor de Supabase (despues de 00016)
-- ============================================================

alter table public.trainer_routine_logs
  add constraint trainer_routine_logs_item_date_unique unique (item_id, log_date);