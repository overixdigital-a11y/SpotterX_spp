-- SpotterX - 00046: contabilidad de cuotas (gym + profesor)
--
-- Objetivo: una RPC por lado que devuelve TODOS los agregados de un mes en una
-- sola llamada, en vez de traer cientos de pagos al celular. El shape del jsonb
-- es IDENTICO en las dos (ver src/lib/accounting.ts), asi que el componente
-- AccountingSummary se dibuja una sola vez y lo usan ambas paginas.
--
-- Sigue el patron ya establecido en el repo: admin_publish_revenue (00036),
-- admin_global_stats (00028) y gym_attendance_today (00011) son security
-- definer con validacion de ownership + grant/revoke (leccion 00045).
--
-- NOTA MANTENIMIENTO: las dos funciones de abajo repiten el mismo bloque de CTEs
-- porque una funcion SQL no puede recibir una tabla como parametro (los parametros
-- de tipo `table` solo existen en PL/pgSQL y obligarian a SQL dinamico con
-- EXECUTE + format(), que es mucho mas dificil de depurar). Si se agrega una
-- metrica, hay que agregarla en LAS DOS y mantener las mismas claves del jsonb.
-- El commentario "-- SHAPE" marca el bloque que debe quedar sincronizado.

-- ------------------------------------------------------------
-- 1) SEGURIDAD: gym_payments nunca tuvo RLS
-- ------------------------------------------------------------
-- Revisando las 45 migraciones: no hay ni una policy sobre gym_payments, y no
-- hay `alter table ... enable row level security` tampoco. En Supabase las
-- tablas de public tienen GRANT por defecto para anon/authenticated, asi que
-- sin RLS la anon key (que va PUBLICA en el bundle de Next) podria leer todos
-- los montos y los user_id de los socios en cuanto exista la primera fila. Por
-- ahora no se ve nada unicamente porque la tabla esta vacia.
--
-- Se cierra con el mismo espejo que ya usa gym_access_logs (00003):
--   - SELECT: el dueno del gym (lo necesitan /gimnasio/cobros y el CSV)
--   - INSERT: el dueno del gym (lo hace markPaid desde el cliente)
--   - UPDATE/DELETE: nadie, igual que el resto de las tablas.
alter table public.gym_payments enable row level security;

drop policy if exists "Payments: owner lectura" on public.gym_payments;
create policy "Payments: owner lectura" on public.gym_payments
  for select using (
    exists (select 1 from public.gyms g where g.id = gym_id and g.owner_id = auth.uid())
  );

drop policy if exists "Payments: owner registra" on public.gym_payments;
create policy "Payments: owner registra" on public.gym_payments
  for insert with check (
    exists (select 1 from public.gyms g where g.id = gym_id and g.owner_id = auth.uid())
  );

-- ------------------------------------------------------------
-- 2) Bajas: cancelled_at
-- ------------------------------------------------------------
-- Sin esta columna no hay forma de medir bajas ni retencion: una membresia
-- cancelada queda con status='inactiva' pero sin fecha de cuando se fue.
alter table public.gym_memberships
  add column if not exists cancelled_at timestamptz;

create or replace function public.touch_gym_membership_cancelled()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'inactiva' and (old.status is distinct from 'inactiva') then
    new.cancelled_at := coalesce(new.cancelled_at, now());
  elsif new.status = 'activa' then
    -- reactivar (boton "Reactivar" de /gimnasio/miembros) limpia la fecha
    new.cancelled_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_gym_membership_cancelled on public.gym_memberships;
create trigger trg_gym_membership_cancelled
  before update on public.gym_memberships
  for each row execute function public.touch_gym_membership_cancelled();

-- Backfill: las membresias ya inactivas no tienen fecha de baja.
update public.gym_memberships
   set cancelled_at = created_at
 where status = 'inactiva'
   and cancelled_at is null;

-- ------------------------------------------------------------
-- 3) Indices: la contabilidad filtra por mes + gym/profe
-- ------------------------------------------------------------
create index if not exists idx_gym_payments_period on public.gym_payments (gym_id, paid_at desc);
create index if not exists idx_memberships_expiry on public.gym_memberships (gym_id, expires_on);
create index if not exists idx_tmp_period on public.trainer_membership_payments (trainer_id, paid_at desc);
create index if not exists idx_tm_expiry on public.trainer_memberships (trainer_id, expires_on);

-- ------------------------------------------------------------
-- 4) RPC del gym
-- ------------------------------------------------------------
create or replace function public.gym_accounting_summary(p_gym uuid, p_month date)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_from date := date_trunc('month', p_month)::date;
  v_to   date := (date_trunc('month', p_month) + interval '1 month')::date;
  v_base jsonb;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;

  if not exists (select 1 from public.gyms g where g.id = p_gym and g.owner_id = auth.uid()) then
    raise exception 'No autorizado';
  end if;

  with pagos as (
    select p.amount, p.method, p.note, p.user_id, p.paid_at::date as dia
      from public.gym_payments p
     where p.gym_id = p_gym
       and p.paid_at::date >= v_from
       and p.paid_at::date <  v_to
  ),
  mes as (
    select count(*)::int as cantidad, coalesce(sum(amount), 0) as total from pagos
  ),
  mes_ant as (
    select count(*)::int as cantidad, coalesce(sum(p.amount), 0) as total
      from public.gym_payments p
     where p.gym_id = p_gym
       and p.paid_at::date >= (v_from - interval '1 month')::date
       and p.paid_at::date <  v_from
  ),
  -- "Esperado" = lo que VENCE este mes. Se usa expires_on y no paid_at porque
  -- el vencimiento es lo que el socio espera cubrir, mas o menos cerca.
  esperado as (
    select count(*)::int as cantidad, coalesce(sum(m.price), 0) as total
      from public.gym_memberships m
     where m.gym_id = p_gym
       and m.expires_on >= v_from
       and m.expires_on <  v_to
       and m.status = 'activa'
  ),
  por_vencer as (
    select
      count(*) filter (where m.expires_on <= current_date + 7)::int  as c7,
      coalesce(sum(m.price) filter (where m.expires_on <= current_date + 7), 0)  as t7,
      count(*) filter (where m.expires_on <= current_date + 15)::int as c15,
      coalesce(sum(m.price) filter (where m.expires_on <= current_date + 15), 0) as t15,
      count(*) filter (where m.expires_on <= current_date + 30)::int as c30,
      coalesce(sum(m.price) filter (where m.expires_on <= current_date + 30), 0) as t30
      from public.gym_memberships m
     where m.gym_id = p_gym
       and m.status = 'activa'
       and m.expires_on is not null
       and m.expires_on >= current_date
  ),
  vencidos as (
    select
      count(*)::int as cantidad,
      coalesce(sum(m.price), 0) as total,
      count(*) filter (where m.expires_on >= current_date - 7)::int as d7,
      count(*) filter (where m.expires_on >= current_date - 30
                         and m.expires_on <  current_date - 7)::int as d30,
      count(*) filter (where m.expires_on <  current_date - 30)::int as d90
      from public.gym_memberships m
     where m.gym_id = p_gym
       and m.status = 'activa'
       and m.expires_on is not null
       and m.expires_on <  current_date
  ),
  metodos as (
    select coalesce(jsonb_object_agg(m.method, m.s), '{}'::jsonb) as por_metodo
      from (
        select p.method, sum(p.amount) as s from pagos p group by p.method
      ) m
  ),
  serie as (
    select coalesce(jsonb_agg(
             jsonb_build_object('mes', to_char(s.mes, 'YYYY-MM'), 'total', s.total, 'cantidad', s.cantidad)
             order by s.mes
           ), '[]'::jsonb) as meses
      from (
        select date_trunc('month', p.paid_at)::date as mes,
               count(*)::int as cantidad,
               coalesce(sum(p.amount), 0) as total
          from public.gym_payments p
         where p.gym_id = p_gym
           and p.paid_at >= (v_from - interval '5 months')
         group by 1
      ) s
  ),
  detalle as (
    select coalesce(jsonb_agg(
             jsonb_build_object(
               'id', p.id, 'monto', p.amount, 'metodo', p.method,
               'nota', p.note, 'fecha', p.dia, 'socio', p.user_id
             ) order by p.dia desc
           ), '[]'::jsonb) as pagos
      from pagos p
  )
  select jsonb_build_object(
    'cantidad', (select cantidad from mes),
    'total',    (select total    from mes),
    'prev_cantidad', (select cantidad from mes_ant),
    'prev_total', (select total    from mes_ant),
    'esperado_cantidad', (select cantidad from esperado),
    'esperado', (select total    from esperado),
    'pv7_cantidad',  (select c7  from por_vencer),
    'pv7',   (select t7  from por_vencer),
    'pv15_cantidad', (select c15 from por_vencer),
    'pv15',  (select t15 from por_vencer),
    'pv30_cantidad', (select c30 from por_vencer),
    'pv30',  (select t30 from por_vencer),
    'vencidos_cantidad', (select cantidad from vencidos),
    'vencidos', (select total    from vencidos),
    'd7',  (select d7  from vencidos),
    'd30', (select d30 from vencidos),
    'd90', (select d90 from vencidos),
    'por_metodo', (select por_metodo from metodos),
    'serie',      (select meses  from serie),
    'detalle',    (select pagos  from detalle),
    -- Extras SOLO del gym: los activos son socios, no alumnos sueltos.
    'activos', (select count(*)::int from public.gym_memberships m
                 where m.gym_id = p_gym and m.status = 'activa'),
    'altas',   (select count(*)::int from public.gym_memberships m
                 where m.gym_id = p_gym
                   and m.created_at >= v_from and m.created_at < v_to),
    'bajas',   (select count(*)::int from public.gym_memberships m
                 where m.gym_id = p_gym
                   and m.cancelled_at is not null
                   and m.cancelled_at >= v_from and m.cancelled_at < v_to),
    'promos_por_vencer', (select count(*)::int from public.gym_memberships m
                 where m.gym_id = p_gym and m.status = 'activa'
                   and m.pay_status = 'promo'
                   and m.expires_on is not null
                   and m.expires_on between current_date and current_date + 7)
  ) into v_base;

  return v_base;
end;
$$;

-- ------------------------------------------------------------
-- 5) RPC del profesor
-- ------------------------------------------------------------
-- Mismo bloque de CTEs con las tablas del profe. Las claves del jsonb tienen que
-- quedar IGUALES a las de arriba (ver "-- SHAPE" en la seccion 4).
create or replace function public.trainer_accounting_summary(p_month date)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  v_from date := date_trunc('month', p_month)::date;
  v_to   date := (date_trunc('month', p_month) + interval '1 month')::date;
begin
  if v_uid is null then raise exception 'No autenticado'; end if;

  with pagos as (
    select p.amount, p.method, p.note, p.student_id, p.paid_at::date as dia
      from public.trainer_membership_payments p
     where p.trainer_id = v_uid
       and p.paid_at::date >= v_from
       and p.paid_at::date <  v_to
  ),
  mes as (
    select count(*)::int as cantidad, coalesce(sum(amount), 0) as total from pagos
  ),
  mes_ant as (
    select count(*)::int as cantidad, coalesce(sum(p.amount), 0) as total
      from public.trainer_membership_payments p
     where p.trainer_id = v_uid
       and p.paid_at::date >= (v_from - interval '1 month')::date
       and p.paid_at::date <  v_from
  ),
  esperado as (
    select count(*)::int as cantidad, coalesce(sum(m.price), 0) as total
      from public.trainer_memberships m
     where m.trainer_id = v_uid
       and m.expires_on >= v_from
       and m.expires_on <  v_to
       and m.status = 'activa'
  ),
  por_vencer as (
    select
      count(*) filter (where m.expires_on <= current_date + 7)::int  as c7,
      coalesce(sum(m.price) filter (where m.expires_on <= current_date + 7), 0)  as t7,
      count(*) filter (where m.expires_on <= current_date + 15)::int as c15,
      coalesce(sum(m.price) filter (where m.expires_on <= current_date + 15), 0) as t15,
      count(*) filter (where m.expires_on <= current_date + 30)::int as c30,
      coalesce(sum(m.price) filter (where m.expires_on <= current_date + 30), 0) as t30
      from public.trainer_memberships m
     where m.trainer_id = v_uid
       and m.status = 'activa'
       and m.expires_on is not null
       and m.expires_on >= current_date
  ),
  vencidos as (
    select
      count(*)::int as cantidad,
      coalesce(sum(m.price), 0) as total,
      count(*) filter (where m.expires_on >= current_date - 7)::int as d7,
      count(*) filter (where m.expires_on >= current_date - 30
                         and m.expires_on <  current_date - 7)::int as d30,
      count(*) filter (where m.expires_on <  current_date - 30)::int as d90
      from public.trainer_memberships m
     where m.trainer_id = v_uid
       and m.status = 'activa'
       and m.expires_on is not null
       and m.expires_on <  current_date
  ),
  metodos as (
    select coalesce(jsonb_object_agg(m.method, m.s), '{}'::jsonb) as por_metodo
      from (
        select p.method, sum(p.amount) as s from pagos p group by p.method
      ) m
  ),
  serie as (
    select coalesce(jsonb_agg(
             jsonb_build_object('mes', to_char(s.mes, 'YYYY-MM'), 'total', s.total, 'cantidad', s.cantidad)
             order by s.mes
           ), '[]'::jsonb) as meses
      from (
        select date_trunc('month', p.paid_at)::date as mes,
               count(*)::int as cantidad,
               coalesce(sum(p.amount), 0) as total
          from public.trainer_membership_payments p
         where p.trainer_id = v_uid
           and p.paid_at >= (v_from - interval '5 months')
         group by 1
      ) s
  ),
  detalle as (
    select coalesce(jsonb_agg(
             jsonb_build_object(
               'id', p.id, 'monto', p.amount, 'metodo', p.method,
               'nota', p.note, 'fecha', p.dia, 'socio', p.student_id
             ) order by p.dia desc
           ), '[]'::jsonb) as pagos
      from pagos p
  )
  select jsonb_build_object(
    'cantidad', (select cantidad from mes),
    'total',    (select total    from mes),
    'prev_cantidad', (select cantidad from mes_ant),
    'prev_total', (select total    from mes_ant),
    'esperado_cantidad', (select cantidad from esperado),
    'esperado', (select total    from esperado),
    'pv7_cantidad',  (select c7  from por_vencer),
    'pv7',   (select t7  from por_vencer),
    'pv15_cantidad', (select c15 from por_vencer),
    'pv15',  (select t15 from por_vencer),
    'pv30_cantidad', (select c30 from por_vencer),
    'pv30',  (select t30 from por_vencer),
    'vencidos_cantidad', (select cantidad from vencidos),
    'vencidos', (select total    from vencidos),
    'd7',  (select d7  from vencidos),
    'd30', (select d30 from vencidos),
    'd90', (select d90 from vencidos),
    'por_metodo', (select por_metodo from metodos),
    'serie',      (select meses  from serie),
    'detalle',    (select pagos  from detalle),
    'activos', (select count(*)::int from public.trainer_memberships m
                 where m.trainer_id = v_uid and m.status = 'activa'),
    'altas',   (select count(*)::int from public.trainer_memberships m
                 where m.trainer_id = v_uid
                   and m.created_at >= v_from and m.created_at < v_to),
    -- El profe no tiene bajas reales (no existe trainer_students.cancelled_at),
    -- asi que 'bajas' es 0 y el componente no lo muestra.
    'bajas',   0
  ) into v_base;

  return v_base;
end;
$$;

-- ------------------------------------------------------------
-- 6) Permisos
-- ------------------------------------------------------------
-- Leccion 00045: una security definer sin guard de auth queda con EXECUTE para
-- PUBLIC y cualquiera la puede invocar por POST /rest/v1/rpc/... (se verifico HTTP
-- 204 en notify_trainer_membership_due). Las de ahora validan ownership, pero
-- igual se cierran para anon.
revoke execute on function public.gym_accounting_summary(uuid, date) from public;
revoke execute on function public.gym_accounting_summary(uuid, date) from anon;
grant  execute on function public.gym_accounting_summary(uuid, date) to authenticated;

revoke execute on function public.trainer_accounting_summary(date) from public;
revoke execute on function public.trainer_accounting_summary(date) from anon;
grant  execute on function public.trainer_accounting_summary(date) to authenticated;

-- El trigger no se llama desde el cliente.
revoke execute on function public.touch_gym_membership_cancelled() from public;
revoke execute on function public.touch_gym_membership_cancelled() from anon;
