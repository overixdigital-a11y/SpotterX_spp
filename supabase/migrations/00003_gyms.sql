-- ============================================================
-- SpotterX - Fase 4: Control de Acceso del Gimnasio
-- Ejecutar en SQL Editor de Supabase (despues de 00002)
-- ============================================================

-- Codigo unico del gym para el QR publico (ej: SPX-XXXXXX)
alter table public.gyms add column if not exists qr_code text unique;
alter table public.gyms add column if not exists cover_url text;

-- Planes que define un gym (nombre, precio, duracion en meses/dias)
create table if not exists public.gym_plans (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms (id) on delete cascade,
  name text not null,
  price numeric not null default 0,
  duration_days int not null default 30,
  created_at timestamptz not null default now()
);

-- Vistas/helpers: aforo (ingresos sin egreso) y horas de profesor
-- Se usa una vista para contar "esta adentro ahora"
create or replace view public.gym_presence as
select
  a.gym_id,
  a.user_id,
  max(a.created_at) as last_in,
  count(*) filter (where a.type = 'ingreso') as ingresos,
  count(*) filter (where a.type = 'egreso') as egresos
from public.gym_access_logs a
group by a.gym_id, a.user_id
having count(*) filter (where a.type = 'ingreso') > count(*) filter (where a.type = 'egreso');

-- Funcion: asistencia del dia (cuantas entradas un dia)
create or replace function public.gym_attendance_today(p_gym uuid)
returns bigint
language sql stable security definer set search_path = public
as $$
  select count(*) from public.gym_access_logs
  where gym_id = p_gym and type = 'ingreso'
    and created_at::date = current_date;
$$;

-- RLS: gyms, gym_staff, gym_plans, gym_memberships, gym_access_logs
alter table public.gyms enable row level security;
alter table public.gym_staff enable row level security;
alter table public.gym_plans enable row level security;
alter table public.gym_memberships enable row level security;
alter table public.gym_access_logs enable row level security;

-- gyms: lectura publica (para QR/checkin), edicion solo owner
create policy "Gyms: lectura publica" on public.gyms for select using (true);
create policy "Gyms: owner edita" on public.gyms
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- gym_staff: solo lectura segun rol de la fila (la usa el profe para ver su gym)
drop policy if exists "Staff: lectura" on public.gym_staff;
create policy "Staff: lectura propia" on public.gym_staff
  for select using (auth.uid() = user_id);

-- gym_plans: owner gestiona; lectura autenticada
create policy "Plans gym: lectura" on public.gym_plans for select using (auth.role() = 'authenticated');
create policy "Plans gym: owner gestiona" on public.gym_plans
  for all using (
    exists (select 1 from public.gyms g where g.id = gym_id and g.owner_id = auth.uid())
  ) with check (
    exists (select 1 from public.gyms g where g.id = gym_id and g.owner_id = auth.uid())
  );

-- gym_memberships: owner gym gestiona; miembro ve la suya
create policy "Memberships: lectura" on public.gym_memberships for select using (
  auth.role() = 'authenticated' and (
    user_id = auth.uid() or
    exists (select 1 from public.gyms g where g.id = gym_id and g.owner_id = auth.uid())
  )
);
create policy "Memberships: owner gestiona" on public.gym_memberships
  for all using (
    exists (select 1 from public.gyms g where g.id = gym_id and g.owner_id = auth.uid())
  ) with check (
    exists (select 1 from public.gyms g where g.id = gym_id and g.owner_id = auth.uid())
  );

-- gym_access_logs: registra quien esta autenticado y es miembro; lee el owner o el propio
create policy "Access: lectura" on public.gym_access_logs for select using (
  auth.role() = 'authenticated' and (
    user_id = auth.uid() or
    exists (select 1 from public.gyms g where g.id = gym_id and g.owner_id = auth.uid())
  )
);
create policy "Access: registro autenticado" on public.gym_access_logs
  for insert with check (
    auth.role() = 'authenticated' and auth.uid() = user_id
  );
-- el owner puede insertar en nombre del miembro (check-in manual)
create policy "Access: owner registra" on public.gym_access_logs
  for insert with check (
    exists (select 1 from public.gyms g where g.id = gym_id and g.owner_id = auth.uid())
  );

create index if not exists idx_access_gym_user on public.gym_access_logs (gym_id, user_id, created_at desc);
create index if not exists idx_membership_gym_user on public.gym_memberships (gym_id, user_id);
create index if not exists idx_gymplans_gym on public.gym_plans (gym_id);
