-- ============================================================
-- SpotterX - 00042: Comunicados y promos del gym (gym_announcements)
-- Ejecutar en SQL Editor de Supabase (despues de 00041)
-- ============================================================

-- 1) Tabla: publicaciones (comunicado / promo) del gym hacia sus alumnos
create table if not exists public.gym_announcements (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms (id) on delete cascade,
  creator_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null default 'comunicado' check (kind in ('comunicado', 'promo')),
  title text not null,
  body text,
  image_url text,
  product_id uuid references public.market_products (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_gym_announcements_gym on public.gym_announcements (gym_id, created_at desc);
create index if not exists idx_gym_announcements_creator on public.gym_announcements (creator_id);

-- 2) RLS (espejo de gym_plans): lectura autenticada, el owner gestiona
alter table public.gym_announcements enable row level security;

drop policy if exists "Anuncios gym: lectura" on public.gym_announcements;
create policy "Anuncios gym: lectura" on public.gym_announcements
  for select using (auth.role() = 'authenticated');

drop policy if exists "Anuncios gym: owner gestiona" on public.gym_announcements;
create policy "Anuncios gym: owner gestiona" on public.gym_announcements
  for all using (
    exists (select 1 from public.gyms g where g.id = gym_id and g.owner_id = auth.uid())
  ) with check (
    exists (select 1 from public.gyms g where g.id = gym_id and g.owner_id = auth.uid())
  );

-- 3) Realtime: la vista del alumno muestra el post nuevo en vivo
do $$
begin
  begin
    alter publication supabase_realtime add table public.gym_announcements;
  exception when duplicate_object then null;
  end;
end;
$$;