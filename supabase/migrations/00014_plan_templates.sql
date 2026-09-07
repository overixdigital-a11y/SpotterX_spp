-- ============================================================
-- SpotterX - Fase A: plantillas reutilizables de planes
-- Un plan del profe se puede marcar como plantilla y copiarlo
-- (con sus ejercicios) a cualquier alumno.
-- Ejecutar en SQL Editor de Supabase (despues de 00013)
-- ============================================================

-- Marca un trainer_plans como plantilla reutilizable (queda como
-- referencia del profe; en el listado del alumno se oculta)
alter table public.trainer_plans
  add column if not exists is_template boolean not null default false;

create index if not exists idx_plans_templates on public.trainer_plans (trainer_id, is_template);