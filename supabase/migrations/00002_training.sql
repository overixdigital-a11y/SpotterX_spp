-- ============================================================
-- SpotterX - Fase 3: Gestión de Alumnos del Profesor
-- Ejecutar en SQL Editor de Supabase (despues de 00001)
-- ============================================================

-- Planes de entrenamiento/alimentacion que un profe asigna a un alumno
create table if not exists public.trainer_plans (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references public.profiles (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  kind text not null check (kind in ('entrenamiento', 'alimentacion', 'general')),
  content text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Rutinas (items dentro de un plan/programa)
create table if not exists public.trainer_routines (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references public.profiles (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  plan_id uuid references public.trainer_plans (id) on delete cascade,
  title text not null,
  description text,
  done boolean not null default false,
  due_on date,
  created_at timestamptz not null default now()
);

-- Chat directo profe - alumno (1:1)
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles (id) on delete cascade,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  content text not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

-- Gimnasios donde trabaja el profe (geoposicionamiento)
-- Se vincula al gym (módulo de gimnasios) o se crea referencia libre
create table if not exists public.trainer_gyms (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references public.profiles (id) on delete cascade,
  gym_id uuid references public.gyms (id) on delete cascade,
  name text,
  city text,
  address text,
  latitude double precision,
  longitude double precision,
  created_at timestamptz not null default now(),
  unique (trainer_id, gym_id)
);

-- RLS
alter table public.trainer_plans enable row level security;
alter table public.trainer_routines enable row level security;
alter table public.messages enable row level security;
alter table public.trainer_gyms enable row level security;

-- Plans: profe dueño o alumno involucrado pueden ver; profe edita
create policy "Plans: lectura involucrados" on public.trainer_plans
  for select using (auth.uid() in (trainer_id, student_id));
create policy "Plans: profe gestiona" on public.trainer_plans
  for all using (auth.uid() = trainer_id) with check (auth.uid() = trainer_id);

create policy "Rutinas: lectura involucrados" on public.trainer_routines
  for select using (auth.uid() in (trainer_id, student_id));
create policy "Rutinas: profe gestiona" on public.trainer_routines
  for all using (auth.uid() = trainer_id) with check (auth.uid() = trainer_id);
create policy "Rutinas: alumno marca done" on public.trainer_routines
  for update using (auth.uid() = student_id) with check (auth.uid() in (student_id, trainer_id));

-- Messages: cada uno solo lee los suyos
create policy "Messages: lectura propia" on public.messages
  for select using (auth.uid() in (sender_id, recipient_id));
create policy "Messages: envio propio" on public.messages
  for insert with check (auth.uid() = sender_id);

-- Trainer gyms (zona del profe)
create policy "TrainerGyms: lectura publica" on public.trainer_gyms for select using (true);
create policy "TrainerGyms: profe gestiona" on public.trainer_gyms
  for all using (auth.uid() = trainer_id) with check (auth.uid() = trainer_id);

-- trainer_students (de 00001) - RLS
alter table public.trainer_students enable row level security;
create policy "TS: lectura involucrados" on public.trainer_students
  for select using (auth.uid() in (trainer_id, student_id));
create policy "TS: profe gestiona" on public.trainer_students
  for all using (auth.uid() = trainer_id) with check (auth.uid() = trainer_id);

create index if not exists idx_plans_student on public.trainer_plans (student_id);
create index if not exists idx_routines_student on public.trainer_routines (student_id);
create index if not exists idx_messages_thread on public.messages (sender_id, recipient_id, created_at);
create index if not exists idx_tg_trainer on public.trainer_gyms (trainer_id);
