-- ============================================================
-- SpotterX Platform - Schema inicial (Fase 1)
-- Ejecutar en el proyecto Supabase nuevo: SQL Editor > New query
-- ============================================================

-- Extensión para UUID v4
create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- Roles y perfil de usuario
-- "El registro define la vista": los roles son combinables.
-- El rol principal se guarda en profiles.role; podemos
-- agregar sub-roles/vínculos en tablas de cada módulo.
-- ------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  username text unique,
  full_name text,
  role text not null default 'alumno'
    check (role in ('gym', 'profesor', 'alumno')),
  avatar_url text,
  bio text,
  location text,
  created_at timestamptz not null default now()
);

-- Trigger: crear perfil al registrarse
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, username, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'full_name',
    coalesce(new.raw_user_meta_data ->> 'role', 'alumno')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ------------------------------------------------------------
-- MÓDULO SOCIAL
-- ------------------------------------------------------------
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  media_url text,
  media_type text check (media_type in ('video', 'image')),
  caption text,
  category text,
  created_at timestamptz not null default now()
);

create table if not exists public.post_pulses (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (post_id, user_id)
);

create table if not exists public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.follows (
  follower_id uuid not null references public.profiles (id) on delete cascade,
  following_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id)
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete cascade,
  type text not null check (type in ('pulse', 'comment', 'follow', 'message')),
  post_id uuid references public.posts (id) on delete cascade,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- MÓDULO GIMNASIO (Fase 4) - preparado sin fricción
-- ------------------------------------------------------------
create table if not exists public.gyms (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  address text,
  city text,
  latitude double precision,
  longitude double precision,
  capacity int,
  created_at timestamptz not null default now()
);

-- Membresía/profesor de un gym (staff)
create table if not exists public.gym_staff (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null check (role in ('admin', 'profesor_invitado')),
  authorized boolean not null default false,
  created_at timestamptz not null default now(),
  unique (gym_id, user_id)
);

-- Membresía de alumno (plan + vigencia)
create table if not exists public.gym_memberships (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  plan_name text not null,
  price numeric,
  starts_on date not null default current_date,
  expires_on date,
  status text not null default 'activa'
    check (status in ('activa', 'inactiva', 'vencida')),
  created_at timestamptz not null default now()
);

-- Registro de acceso (entrada/salida; horas del profe)
create table if not exists public.gym_access_logs (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null check (type in ('ingreso', 'egreso')),
  created_at timestamptz not null default now()
);

-- Cobro de cuota (Fase 5)
create table if not exists public.gym_payments (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms (id) on delete cascade,
  membership_id uuid not null references public.gym_memberships (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  amount numeric not null,
  method text check (method in ('manual', 'mercadopago', 'stripe')),
  paid_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- MÓDULO TRAINING (Fase 3) - preparado
-- ------------------------------------------------------------
create table if not exists public.trainer_students (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references public.profiles (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  source text check (source in ('gym', 'propio')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (trainer_id, student_id)
);

-- ------------------------------------------------------------
-- RLS: accesos básicos (ajustar por módulo en fases siguientes)
-- ------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.posts enable row level security;

create policy "Profiles: lectura pública"
  on public.profiles for select using (true);
create policy "Profiles: edición propia"
  on public.profiles for update using (auth.uid() = id);

create policy "Posts: lectura autenticada"
  on public.posts for select using (auth.role() = 'authenticated');
create policy "Posts: creación propia"
  on public.posts for insert with check (auth.uid() = user_id);

-- ------------------------------------------------------------
-- Índices
-- ------------------------------------------------------------
create index if not exists idx_posts_user on public.posts (user_id);
create index if not exists idx_notifications_user on public.notifications (user_id);
create index if not exists idx_access_logs_gym on public.gym_access_logs (gym_id, created_at desc);
create index if not exists idx_memberships_gym on public.gym_memberships (gym_id);

-- ------------------------------------------------------------
-- Triggers de notificaciones (red social)
-- ------------------------------------------------------------
-- Pulse
create or replace function public.notify_pulse()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.notifications (user_id, actor_id, type, post_id)
  select p.user_id, new.user_id, 'pulse', new.post_id
  from public.posts p where p.id = new.post_id and p.user_id <> new.user_id;
  return new;
end;
$$;
drop trigger if exists trg_notify_pulse on public.post_pulses;
create trigger trg_notify_pulse after insert on public.post_pulses
  for each row execute procedure public.notify_pulse();

-- Comment
create or replace function public.notify_comment()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.notifications (user_id, actor_id, type, post_id)
  select p.user_id, new.user_id, 'comment', new.post_id
  from public.posts p where p.id = new.post_id and p.user_id <> new.user_id;
  return new;
end;
$$;
drop trigger if exists trg_notify_comment on public.post_comments;
create trigger trg_notify_comment after insert on public.post_comments
  for each row execute procedure public.notify_comment();

-- Follow
create or replace function public.notify_follow()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.notifications (user_id, actor_id, type)
  select new.following_id, new.follower_id, 'follow'
  where new.following_id <> new.follower_id;
  return new;
end;
$$;
drop trigger if exists trg_notify_follow on public.follows;
create trigger trg_notify_follow after insert on public.follows
  for each row execute procedure public.notify_follow();

-- RLS restantes (módulos: publicaciones de los módulos en fases siguientes)
alter table public.post_pulses enable row level security;
alter table public.post_comments enable row level security;
alter table public.follows enable row level security;
alter table public.notifications enable row level security;

create policy "Pulses: lectura" on public.post_pulses for select using (true);
create policy "Pulses: insert/delete propio" on public.post_pulses
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Comments: lectura" on public.post_comments for select using (true);
create policy "Comments: creación propia" on public.post_comments
  for insert with check (auth.uid() = user_id);

create policy "Follows: lectura" on public.follows for select using (true);
create policy "Follows: gestión propia" on public.follows
  for all using (auth.uid() = follower_id) with check (auth.uid() = follower_id);

create policy "Notifs: solo el dueño" on public.notifications
  for select using (auth.uid() = user_id);
