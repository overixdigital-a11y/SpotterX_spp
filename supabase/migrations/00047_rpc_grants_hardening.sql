-- 00047_rpc_grants_hardening.sql
-- Cierre de permisos EXECUTE de las RPCs del schema public (27/09/2026).
--
-- HALLAZGO: 52 de las 54 funciones de `public` tenian `EXECUTE` para `PUBLIC`.
-- Con la anon key se podia invocar cualquiera por POST /rest/v1/rpc/<nombre>.
-- Casos:
--   * admin_*: tienen guard interno (`_assert_admin` / is_admin) asi que el
--     impacto era bajo, pero la superficie quedaba abierta de todos modos.
--   * gym_attendance_today: `security definer` SIN ningun chequeo de propiedad
--     -> cualquiera, sin login, pedia el conteo de ingresos de HOY de cualquier
--     gym cuyo id conociera (bypass de RLS sobre gym_access_logs).
--   * Los 13 triggers (`notify_*`, `sync_ts_*`, `touch_*`, `handle_new_user`)
--     no son explotables: al llamarlos directo fallan con "record NEW is not
--     assigned yet". Se cierran igual por higiene.
--
-- LECCION (no volver a cometer esto): `revoke execute ... from public` NO alcanza.
-- Supabase aplica `ALTER DEFAULT PRIVILEGES` sobre el schema public, asi que cada
-- funcion nueva nace con un grant EXPLICITO para anon/authenticated/service_role
-- ADEMAS del default de PUBLIC. El ACL tipico era:
--   =X/postgres | postgres=X/postgres | anon=X/postgres | authenticated=X/postgres | service_role=X/postgres
-- `=X/postgres` es PUBLIC y `anon=X/postgres` es un grant aparte: revocar solo
-- `public` deja a anon con acceso intacto. Hay que revocar `public` Y `anon`.
--
-- Verificacion (esperado: SOLO 2 filas, get_trainer_stats y get_trainer_workplaces,
-- que son perfiles publicos visibles sin login):
--   supabase/diagnostics/00047_verificacion.sql

-- ---------------------------------------------------------------------------
-- 1. gym_attendance_today: agregar chequeo de propiedad.
--    Sigue siendo `security definer` porque necesita leer gym_access_logs por
--    encima del RLS, pero ahora valida owner o staff del gym. Patron alineado
--    con admin_set_gym_module (00041) y los policies de 00003.
-- ---------------------------------------------------------------------------
create or replace function public.gym_attendance_today(p_gym uuid)
returns bigint
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.gyms where id = p_gym and owner_id = auth.uid())
     and not exists (select 1 from public.gym_staff where gym_id = p_gym and user_id = auth.uid()) then
    raise exception 'No autorizado';
  end if;

  return (
    select count(*)
    from public.gym_access_logs
    where gym_id = p_gym
      and type = 'ingreso'
      and created_at::date = current_date
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Funciones internas: `revoke` a public/anon/authenticated y SIN grant.
--    Las 13 triggers se invocan desde el motor (o desde pg_cron) como owner, y
--    PostgreSQL solo verifica EXECUTE de una trigger function al CREAR el
--    trigger, nunca al dispararlo: revocar no rompe los triggers existentes.
--    _assert_admin es helper interno de las admin_*.
-- ---------------------------------------------------------------------------
revoke execute on function public._assert_admin() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.notify_comment() from public, anon, authenticated;
revoke execute on function public.notify_follow() from public, anon, authenticated;
revoke execute on function public.notify_gym_checkin() from public, anon, authenticated;
revoke execute on function public.notify_gym_solicitud() from public, anon, authenticated;
revoke execute on function public.notify_market_order() from public, anon, authenticated;
revoke execute on function public.notify_message() from public, anon, authenticated;
revoke execute on function public.notify_pulse() from public, anon, authenticated;
revoke execute on function public.notify_staff_aprobado() from public, anon, authenticated;
revoke execute on function public.sync_ts_on_membership() from public, anon, authenticated;
revoke execute on function public.sync_ts_on_staff() from public, anon, authenticated;
revoke execute on function public.touch_profile() from public, anon, authenticated;
revoke execute on function public.touch_updated_at() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Funciones de negocio: `revoke` a public/anon + `grant` a authenticated.
--    `authenticated` es subconjunto de lo que estaba expuesto antes, asi que es
--    una reduccion estricta: no rompe ningun call path del cliente, ni siquiera
--    los que se disparan desde wrappers con nombre de funcion variable.
--    El grant es explicito para que el estado final quede documentado en el repo
--    y no dependa del default de Supabase.
-- ---------------------------------------------------------------------------
revoke execute on function public.admin_approve_deposit(uuid) from public, anon;
grant execute on function public.admin_approve_deposit(uuid) to authenticated;

revoke execute on function public.admin_credit_wallet(uuid, numeric, text) from public, anon;
grant execute on function public.admin_credit_wallet(uuid, numeric, text) to authenticated;

revoke execute on function public.admin_delete_exercise(uuid) from public, anon;
grant execute on function public.admin_delete_exercise(uuid) to authenticated;

revoke execute on function public.admin_delete_food(uuid) from public, anon;
grant execute on function public.admin_delete_food(uuid) to authenticated;

revoke execute on function public.admin_delete_post(uuid) from public, anon;
grant execute on function public.admin_delete_post(uuid) to authenticated;

revoke execute on function public.admin_global_stats() from public, anon;
grant execute on function public.admin_global_stats() to authenticated;

revoke execute on function public.admin_list_deposits(text) from public, anon;
grant execute on function public.admin_list_deposits(text) to authenticated;

revoke execute on function public.admin_list_reports() from public, anon;
grant execute on function public.admin_list_reports() to authenticated;

revoke execute on function public.admin_mark_withdrawal_paid(uuid) from public, anon;
grant execute on function public.admin_mark_withdrawal_paid(uuid) to authenticated;

revoke execute on function public.admin_publish_revenue() from public, anon;
grant execute on function public.admin_publish_revenue() to authenticated;

revoke execute on function public.admin_resolve_report(uuid, text) from public, anon;
grant execute on function public.admin_resolve_report(uuid, text) to authenticated;

revoke execute on function public.admin_set_commission(numeric) from public, anon;
grant execute on function public.admin_set_commission(numeric) to authenticated;

revoke execute on function public.admin_set_gym_module(uuid, text, boolean) from public, anon;
grant execute on function public.admin_set_gym_module(uuid, text, boolean) to authenticated;

revoke execute on function public.admin_set_payment_config(jsonb, boolean, jsonb) from public, anon;
grant execute on function public.admin_set_payment_config(jsonb, boolean, jsonb) to authenticated;

revoke execute on function public.admin_set_publication_config(int, numeric) from public, anon;
grant execute on function public.admin_set_publication_config(int, numeric) to authenticated;

revoke execute on function public.admin_set_user_free_limit(uuid, int) from public, anon;
grant execute on function public.admin_set_user_free_limit(uuid, int) to authenticated;

revoke execute on function public.admin_set_verified(uuid, boolean) from public, anon;
grant execute on function public.admin_set_verified(uuid, boolean) to authenticated;

revoke execute on function public.admin_toggle_ban(uuid) from public, anon;
grant execute on function public.admin_toggle_ban(uuid) to authenticated;

revoke execute on function public.buy_from_wallet(uuid) from public, anon;
grant execute on function public.buy_from_wallet(uuid) to authenticated;

revoke execute on function public.get_my_wallet() from public, anon;
grant execute on function public.get_my_wallet() to authenticated;

revoke execute on function public.get_or_create_wallet() from public, anon;
grant execute on function public.get_or_create_wallet() to authenticated;

revoke execute on function public.get_publish_quote() from public, anon;
grant execute on function public.get_publish_quote() to authenticated;

revoke execute on function public.gym_attendance_today(uuid) from public, anon;
grant execute on function public.gym_attendance_today(uuid) to authenticated;

revoke execute on function public.market_checkout(jsonb, text, text, text) from public, anon;
grant execute on function public.market_checkout(jsonb, text, text, text) to authenticated;

revoke execute on function public.market_publish(text, text, numeric, text, text, int, text, text[]) from public, anon;
grant execute on function public.market_publish(text, text, numeric, text, text, int, text, text[]) to authenticated;

revoke execute on function public.market_publish_pending(text, text, numeric, text, text, int, text, text[]) from public, anon;
grant execute on function public.market_publish_pending(text, text, numeric, text, text, int, text, text[]) to authenticated;

revoke execute on function public.report_deposit(numeric, text) from public, anon;
grant execute on function public.report_deposit(numeric, text) to authenticated;

revoke execute on function public.request_withdrawal(numeric) from public, anon;
grant execute on function public.request_withdrawal(numeric) to authenticated;

revoke execute on function public.trainer_mark_membership_paid(uuid, numeric, text) from public, anon;
grant execute on function public.trainer_mark_membership_paid(uuid, numeric, text) to authenticated;

revoke execute on function public.unlink_student(uuid) from public, anon;
grant execute on function public.unlink_student(uuid) to authenticated;

revoke execute on function public.unlink_trainer_student(uuid) from public, anon;
grant execute on function public.unlink_trainer_student(uuid) to authenticated;

revoke execute on function public.upsert_trainer_review(uuid, smallint, text) from public, anon;
grant execute on function public.upsert_trainer_review(uuid, smallint, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Sin tocar, a proposito:
--    * get_trainer_stats / get_trainer_workplaces -> quedan PUBLICAS a proposito.
--      Las usan las paginas de perfil, visibles sin login:
--      src/app/(social)/perfil/[username]/page.tsx y src/app/(social)/perfil/page.tsx
--    * gym_accounting_summary / trainer_accounting_summary (00046),
--      notify_trainer_membership_due / notify_upcoming_expiry (00045/00011) y
--      touch_gym_membership_cancelled (00044) -> ya cerraron public+anon.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 5. admin_pending_withdrawals: huerfano. Venia de la 00037 (borrada del repo),
--    no hay frontend que la llame y la DB la tiene viva con EXECUTE para PUBLIC.
--    Se resuelve la firma real con pg_proc porque el archivo que la definia ya
--    no esta en el repo; en una DB limpia el loop simplemente no hace nada.
-- ---------------------------------------------------------------------------
do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure::text as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'admin_pending_withdrawals'
  loop
    execute 'drop function if exists ' || r.signature;
  end loop;
end $$;
