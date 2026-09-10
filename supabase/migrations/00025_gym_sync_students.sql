-- SpotterX - 00025: sync automático de alumnos del gym a trainer_students (source='gym')
-- Ejecutar en SQL Editor.

-- 1) Cuando se agrega un miembro al gym, linkearlo con cada profe autorizado del gym
create or replace function public.sync_ts_on_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.trainer_students (trainer_id, student_id, source, active)
  select gs.user_id, NEW.user_id, 'gym', true
  from public.gym_staff gs
  where gs.gym_id = NEW.gym_id
    and gs.authorized = true
    and gs.role = 'profesor_invitado'
    and gs.user_id <> NEW.user_id
  on conflict (trainer_id, student_id) do nothing;
  return NEW;
end;
$$;

drop trigger if exists trg_sync_ts_on_membership on public.gym_memberships;
create trigger trg_sync_ts_on_membership
  after insert on public.gym_memberships
  for each row execute function public.sync_ts_on_membership();

-- 2) Cuando un profe es autorizado al gym, linkearlo con todos los miembros activos
create or replace function public.sync_ts_on_staff()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if NEW.authorized then
    insert into public.trainer_students (trainer_id, student_id, source, active)
    select NEW.user_id, gm.user_id, 'gym', true
    from public.gym_memberships gm
    where gm.gym_id = NEW.gym_id
      and gm.status = 'activa'
      and gm.user_id <> NEW.user_id
    on conflict (trainer_id, student_id) do nothing;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_sync_ts_on_staff on public.gym_staff;
create trigger trg_sync_ts_on_staff
  after insert or update of authorized on public.gym_staff
  for each row execute function public.sync_ts_on_staff();

-- 3) Backfill: cubre lo existente por si quedaron huecos
insert into public.trainer_students (trainer_id, student_id, source, active)
select gs.user_id, gm.user_id, 'gym', true
from public.gym_memberships gm
join public.gym_staff gs on gs.gym_id = gm.gym_id
where gs.authorized = true
  and gs.role = 'profesor_invitado'
  and gm.status = 'activa'
  and gs.user_id <> gm.user_id
on conflict (trainer_id, student_id) do nothing;
