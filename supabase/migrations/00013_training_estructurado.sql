-- ============================================================
-- SpotterX - Fase A: Training estructurado
-- Items de plan (día/ejercicio/series/reps/descanso), historial
-- de rutinas (completed_at), chat con "leídos" y realtime.
-- Ejecutar en SQL Editor de Supabase (despues de 00012)
-- ============================================================

-- Ejercicios estructurados dentro de un plan (división por días)
create table if not exists public.trainer_plan_items (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.trainer_plans (id) on delete cascade,
  day integer,
  exercise text not null,
  sets integer,
  reps text,
  rest_seconds integer,
  notes text,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.trainer_plan_items enable row level security;

create policy "Plan items: lectura involucrados" on public.trainer_plan_items
  for select using (
    exists (
      select 1 from public.trainer_plans tp
      where tp.id = plan_id and auth.uid() in (tp.trainer_id, tp.student_id)
    )
  );
create policy "Plan items: profe gestiona" on public.trainer_plan_items
  for all using (
    exists (
      select 1 from public.trainer_plans tp
      where tp.id = plan_id and auth.uid() = tp.trainer_id
    )
  ) with check (
    exists (
      select 1 from public.trainer_plans tp
      where tp.id = plan_id and auth.uid() = tp.trainer_id
    )
  );

create index if not exists idx_plan_items on public.trainer_plan_items (plan_id, position);

-- Historial de cumplimiento: cuándo se marcó una rutina como hecha
alter table public.trainer_routines
  add column if not exists completed_at timestamptz;

-- Chat: el receptor puede marcar los mensajes como leídos
create policy "Messages: marca leido" on public.messages
  for update using (auth.uid() = recipient_id) with check (auth.uid() = recipient_id);

-- Realtime del módulo training (planes, items, rutinas y mensajes)
do $$
begin
  begin
    alter publication supabase_realtime add table public.trainer_plans;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.trainer_plan_items;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.trainer_routines;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.messages;
  exception when duplicate_object then null;
  end;
end;
$$;