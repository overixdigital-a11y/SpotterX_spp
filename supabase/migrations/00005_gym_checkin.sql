-- ============================================================
-- SpotterX - Pulido alumnos: Mi gimnasio + Kiosk de acceso
-- Ejecutar en SQL Editor de Supabase (despues de 00004)
-- ============================================================

-- 1) gym_memberships: precio de la cuota guardado en la membresia
--    (el alumno siempre ve la cifra aunque el plan se borre/edite)
alter table public.gym_memberships add column if not exists price numeric;

-- 2) notifications: permitir tipo 'checkin' + referencia al gym
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in ('pulse', 'comment', 'follow', 'message', 'checkin'));
alter table public.notifications add column if not exists gym_id uuid
  references public.gyms (id) on delete set null;
create index if not exists idx_notifs_gym on public.notifications (user_id, gym_id, read);

-- 3) Trigger: aviso al gym cuando un alumno registra INGRESO
create or replace function public.notify_gym_checkin()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if new.type = 'ingreso' then
    insert into public.notifications (user_id, actor_id, type, gym_id)
    select g.owner_id, new.user_id, 'checkin', new.gym_id
    from public.gyms g
    where g.id = new.gym_id
      and g.owner_id <> new.user_id;
  end if;
  return new;
end;
$$;
drop trigger if exists trg_notify_gym_checkin on public.gym_access_logs;
create trigger trg_notify_gym_checkin after insert on public.gym_access_logs
  for each row execute procedure public.notify_gym_checkin();

-- 4) Realtime: kiosk en vivo (ingresos del gym) + campanita de notificaciones
do $$
begin
  begin
    alter publication supabase_realtime add table public.gym_access_logs;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.notifications;
  exception when duplicate_object then null;
  end;
end;
$$;