-- SpotterX - 00044: membresia / cuota mensual del alumno con su profesor
-- Cobro MANUAL (como el gym: el profe marca "Pagó" y se extiende el vencimiento)
-- + recordatorio automatico in-app con pg_cron.
-- Reusa el patron de gym_memberships / gym_payments / notify_upcoming_expiry (00011).

-- 1) Membresia del alumno con el profe
create table if not exists public.trainer_memberships (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references public.profiles (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  plan_name text not null default 'Mensualidad',
  price numeric,
  duration_months int not null default 1,
  starts_on date not null default current_date,
  expires_on date,
  pay_status text not null default 'pendiente'
    check (pay_status in ('pagado', 'pendiente', 'promo')),
  status text not null default 'activa'
    check (status in ('activa', 'inactiva')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (trainer_id, student_id)
);

-- 2) Historial de pagos
create table if not exists public.trainer_membership_payments (
  id uuid primary key default gen_random_uuid(),
  membership_id uuid not null references public.trainer_memberships (id) on delete cascade,
  trainer_id uuid not null references public.profiles (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  amount numeric,
  method text not null default 'manual'
    check (method in ('manual', 'transferencia', 'otro')),
  period_from date,
  period_to date,
  note text,
  paid_at timestamptz not null default now()
);

-- 3) Indices
create index if not exists idx_tm_trainer on public.trainer_memberships (trainer_id, status);
create index if not exists idx_tm_due on public.trainer_memberships (expires_on);
create index if not exists idx_tmp_membership on public.trainer_membership_payments (membership_id, paid_at desc);

-- 4) RLS (espejo de trainer_plans: 00002)
alter table public.trainer_memberships enable row level security;
alter table public.trainer_membership_payments enable row level security;

drop policy if exists "TM: lectura involucrados" on public.trainer_memberships;
create policy "TM: lectura involucrados" on public.trainer_memberships
  for select using (auth.uid() in (trainer_id, student_id));
drop policy if exists "TM: profe gestiona" on public.trainer_memberships
  for all using (auth.uid() = trainer_id) with check (auth.uid() = trainer_id);
drop policy if exists "Admin: lectura global" on public.trainer_memberships;
create policy "Admin: lectura global" on public.trainer_memberships
  for select using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin)
  );

drop policy if exists "TMP: lectura involucrados" on public.trainer_membership_payments;
create policy "TMP: lectura involucrados" on public.trainer_membership_payments
  for select using (auth.uid() in (trainer_id, student_id));
drop policy if exists "TMP: profe gestiona" on public.trainer_membership_payments
  for all using (auth.uid() = trainer_id) with check (auth.uid() = trainer_id);

-- 5) Marcar pagado: transaccional (patron gym_cobros)
create or replace function public.trainer_mark_membership_paid(
  p_membership_id uuid,
  p_amount numeric default null,
  p_note text default null
)
returns date
language plpgsql
security definer
set search_path = public
as $$
declare
  m public.trainer_memberships;
  v_base date;
  v_to date;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;

  select * into m from public.trainer_memberships
   where id = p_membership_id and trainer_id = auth.uid()
   for update;
  if not found then raise exception 'No autorizado'; end if;

  v_base := greatest(coalesce(m.expires_on, current_date), current_date);
  v_to := (v_base + make_interval(months => m.duration_months))::date;

  insert into public.trainer_membership_payments
    (membership_id, trainer_id, student_id, amount, method, period_from, period_to, note)
  values
    (m.id, m.trainer_id, m.student_id, coalesce(p_amount, m.price), 'manual', v_base, v_to, p_note);

  update public.trainer_memberships
     set pay_status = 'pagado',
         expires_on = v_to,
         status = 'activa',
         updated_at = now()
   where id = m.id;

  insert into public.notifications (user_id, actor_id, type, ref_id, message)
  values (m.student_id, m.trainer_id, 'cuota_profe', m.id,
          'Tu mensualidad con tu profe quedo al dia hasta el ' || to_char(v_to, 'DD/MM/YYYY'));

  return v_to;
end;
$$;

-- 6) Notificaciones: nuevo tipo con la lista ACUMULATIVA COMPLETA
-- (leccion 00024/00035/00038: nunca recrear con una lista parcial)
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in ('pulse', 'comment', 'follow', 'message', 'checkin', 'vencimiento',
    'solicitud_staff', 'staff_aprobado', 'orden', 'pago_publicacion', 'cuota_profe'));

create index if not exists idx_notifs_ref on public.notifications (ref_id, type);

-- 7) Recordatorio automatico: 3 dias antes, el dia del vencimiento, y vencido
--    como maximo 1 vez por semana. Solo si el vinculo sigue activo.
create or replace function public.notify_trainer_membership_due()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  mm record;
begin
  for mm in
    select m.id, m.trainer_id, m.student_id, m.plan_name, m.expires_on
    from public.trainer_memberships m
    join public.trainer_students ts
      on ts.trainer_id = m.trainer_id
     and ts.student_id = m.student_id
     and ts.active = true
    where m.status = 'activa'
      and m.expires_on is not null
      and (
            m.expires_on = (current_date + interval '3 days')::date
         or m.expires_on = current_date
         or (m.expires_on < current_date and not exists (
              select 1 from public.notifications n
               where n.user_id = m.student_id
                 and n.type = 'cuota_profe'
                 and n.ref_id = m.id
                 and n.created_at > now() - interval '7 days'))
      )
  loop
    if not exists (
      select 1 from public.notifications n
       where n.user_id = mm.student_id
         and n.type = 'cuota_profe'
         and n.ref_id = mm.id
         and n.created_at::date = current_date
    ) then
      insert into public.notifications (user_id, actor_id, type, ref_id, message)
      values (mm.student_id, mm.trainer_id, 'cuota_profe', mm.id,
              case
                when mm.expires_on < current_date
                  then 'Tu membresia ' || mm.plan_name || ' con tu profe vencio el ' || to_char(mm.expires_on, 'DD/MM/YYYY') || '. Habla con el para regularizar.'
                when mm.expires_on = current_date
                  then 'Tu membresia ' || mm.plan_name || ' con tu profe vence HOY ' || to_char(mm.expires_on, 'DD/MM/YYYY') || '.'
                else 'Tu membresia ' || mm.plan_name || ' con tu profe vence el ' || to_char(mm.expires_on, 'DD/MM/YYYY') || '.'
              end);
    end if;
  end loop;
end;
$$;

create extension if not exists pg_cron;
do $$
begin
  if not exists (select 1 from cron.job where jobname = 'notify-trainer-membership-due') then
    perform cron.schedule('notify-trainer-membership-due', '0 9 * * *',
                          'select public.notify_trainer_membership_due();');
  end if;
end $$;
