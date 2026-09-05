-- ============================================================
-- SpotterX - Ficha de datos del miembro (alumno/profesor) por gym
-- Ejecutar en SQL Editor de Supabase (despues de 00007)
-- ============================================================

-- Tabla 1:1 (gym_id, user_id) con los datos extra cargados por el dueño del gym.
-- Aplica tanto a alumnos (gym_memberships) como a profesores (gym_staff).
create table if not exists public.gym_member_details (
  gym_id uuid not null references public.gyms (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  phone text,
  address text,
  city text,
  obra_social text,
  birth_date date,
  dni text,
  emergency_name text,
  emergency_phone text,
  notes text,
  updated_at timestamptz not null default now(),
  primary key (gym_id, user_id)
);

alter table public.gym_member_details enable row level security;

-- El owner del gym lee y gestiona las fichas de sus miembros
create policy "Member details: owner gestiona" on public.gym_member_details
  for all using (
    exists (select 1 from public.gyms g where g.id = gym_id and g.owner_id = auth.uid())
  ) with check (
    exists (select 1 from public.gyms g where g.id = gym_id and g.owner_id = auth.uid())
  );

-- El propio miembro ve su ficha
create policy "Member details: propia" on public.gym_member_details
  for select using (user_id = auth.uid());
