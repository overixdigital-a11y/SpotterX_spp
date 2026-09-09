-- ============================================================
-- SpotterX - 00020: Dietas por alumno (planes de alimentación
-- estructurados con asignación al alumno).
-- assigned_at null = borrador (invisible para el alumno).
-- with fecha = asignada (visible).
-- trainer_plan_items.data jsonb: { meal, qty, unit, kcal,
-- protein_g, fat_g, carbs_g }.
-- Después de 00019. Ejecutar en SQL Editor de Supabase.
-- ============================================================

alter table public.trainer_plans add column if not exists assigned_at timestamptz;

alter table public.trainer_plan_items add column if not exists data jsonb;

create index if not exists trainer_plans_assigned_idx on public.trainer_plans (assigned_at);

-- Planes no-plantilla existentes quedan asignados para no romper la vista actual.
update public.trainer_plans
set assigned_at = now()
where assigned_at is null
  and coalesce(is_template, false) = false;