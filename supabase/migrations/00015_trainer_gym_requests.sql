-- ============================================================
-- SpotterX - Fase A: vinculación bidireccional profe <-> gym
-- El profe se postula a un gym (el dueño autoriza), disponibles
-- para postularse desde /entrenamiento/zona. Suma disponibilidad
-- de horarios del profe por gym y notificaciones tipo solicitud.
-- Ejecutar en SQL Editor de Supabase (despues de 00014)
-- ============================================================

-- Solicitudes de postulación de un profe a un gym
create table if not exists public.trainer_gym_requests (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references public.profiles (id) on delete cascade,
  gym_id uuid not null references public.gyms (id) on delete cascade,
  message text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  unique (trainer_id, gym_id)
);

alter table public.trainer_gym_requests enable row level security;

-- Profe: crea y ve sus propias solicitudes (el estado lo cambia el dueño)
create policy "Solicitudes: profe crea" on public.trainer_gym_requests
  for insert with check (auth.uid() = trainer_id);
create policy "Solicitudes: profe lee" on public.trainer_gym_requests
  for select using (auth.uid() = trainer_id);
-- Dueño del gym: ve y aprueba/rechaza las de su gym
create policy "Solicitudes: owner gestiona" on public.trainer_gym_requests
  for all using (
    exists (select 1 from public.gyms g where g.id = gym_id and g.owner_id = auth.uid())
  ) with check (
    exists (select 1 from public.gyms g where g.id = gym_id and g.owner_id = auth.uid())
  );

-- Disponibilidad/horarios del profe en cada gym (se muestra al alumno)
alter table public.trainer_gyms
  add column if not exists availability text;

-- Nuevos tipos de notificación: solicitud al dueño y aprobación al profe
alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check check (
    type in ('pulse', 'comment', 'follow', 'message', 'checkin', 'vencimiento', 'solicitud_staff', 'staff_aprobado')
  );

-- Notificación al dueño cuando un profe se postula
create or replace function public.notify_gym_solicitud()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.notifications (user_id, actor_id, type, gym_id)
  select g.owner_id, new.trainer_id, 'solicitud_staff', new.gym_id
  from public.gyms g where g.id = new.gym_id;
  return new;
end;
$$;
drop trigger if exists trg_notify_gym_solicitud on public.trainer_gym_requests;
create trigger trg_notify_gym_solicitud after insert on public.trainer_gym_requests
  for each row execute procedure public.notify_gym_solicitud();

-- Notificación al profe cuando el dueño aprueba su postulación
create or replace function public.notify_staff_aprobado()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if new.status = 'approved' and old.status is distinct from 'approved' then
    insert into public.notifications (user_id, actor_id, type, gym_id)
    select new.trainer_id, g.owner_id, 'staff_aprobado', new.gym_id
    from public.gyms g where g.id = new.gym_id;
  end if;
  return new;
end;
$$;
drop trigger if exists trg_notify_staff_aprobado on public.trainer_gym_requests;
create trigger trg_notify_staff_aprobado after update on public.trainer_gym_requests
  for each row execute procedure public.notify_staff_aprobado();

-- Realtime: el panel del dueño ve las solicitudes que llegan
do $$
begin
  begin
    alter publication supabase_realtime add table public.trainer_gym_requests;
  exception when duplicate_object then null;
  end;
end;
$$;