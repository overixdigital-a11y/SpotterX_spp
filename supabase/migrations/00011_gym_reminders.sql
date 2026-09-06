-- ============================================================
-- SpotterX - Etapa 3: Recordatorios de vencimiento de membresia
-- Ejecutar en SQL Editor de Supabase (despues de 00010)
-- ============================================================

-- 1) Notificaciones: habilitar tipo 'vencimiento'
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in ('pulse', 'comment', 'follow', 'message', 'checkin', 'vencimiento'));
create index if not exists idx_notifs_vencimiento
  on public.notifications (user_id, type, read);

-- 2) Funcion: avisar que la membresia vence en 3 dias
create or replace function public.notify_upcoming_expiry()
returns void language plpgsql security definer set search_path = public
as $$
declare
  mm record;
begin
  for mm in
    select m.id, m.gym_id, m.user_id, m.plan_name, m.expires_on, g.owner_id
    from public.gym_memberships m
    join public.gyms g on g.id = m.gym_id
    where m.status = 'activa'
      and m.expires_on is not null
      and m.expires_on = (current_date + interval '3 days')::date
      and m.pay_status in ('pagado', 'promo')
  loop
    if not exists (
      select 1 from public.notifications n
      where n.user_id = mm.user_id
        and n.gym_id = mm.gym_id
        and n.type = 'vencimiento'
        and n.created_at::date = current_date
    ) then
      insert into public.notifications (user_id, actor_id, type, gym_id)
      values (mm.user_id, mm.owner_id, 'vencimiento', mm.gym_id);
    end if;
  end loop;
end;
$$;

-- 3) Job diario a las 09:00 (pg_cron)
CREATE EXTENSION IF NOT EXISTS pg_cron;
select cron.schedule(
  'notify-upcoming-expiry',
  '0 9 * * *',
  'select public.notify_upcoming_expiry();'
);