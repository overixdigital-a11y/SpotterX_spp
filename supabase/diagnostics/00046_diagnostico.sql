-- ============================================================
-- DIAGNOSTICO 00046 - contabilidad de cuotas
-- Pegalo COMPLETO en el SQL Editor y mandame el resultado de la ultima consulta.
--
-- ########################################################################
-- #  LEER ANTES DE CORRER.  ESTE ARCHIVO SE CORRE DENTRO DE UNA           #
-- #  TRANSACCION QUE HACE ROLLBACK, Y LAS FUNCIONES TIENEN EXECUTE        #
-- #  REVOCADO.  LAS DOS COSAS SON OBLIGATORIAS, POR SEPARADO.             #
-- #                                                                      #
-- #  Por que: una funcion creada aca sin `revoke` queda con                #
-- #  EXECUTE TO PUBLIC, o sea que es un endpoint REST PUBLICO:             #
-- #  cualquiera con la anon key (que esta en el bundle del navegador)     #
-- #  puede pegarle POST /rest/v1/rpc/<nombre> y ver lo que devuelva.      #
-- #  Ya se exploto de verdad: `_diag_00046_datos` respondio con            #
-- #  cuantos socios activos y en que mes vencen, de cada gym.             #
-- #  Mismo error que la 00045 con notify_trainer_membership_due.          #
-- #                                                                      #
-- #  El ROLLBACK es la red que salva: aunque el `revoke` falle o alguien  #
-- #  corra solo una parte del archivo, la funcion no queda en la base.     #
-- #  Copiar y pegar UN SOLO `create or replace` suelta = fuga.            #
-- ########################################################################
--
-- Solo lectura: consulta permisos y simula la sesion de cada dueno con
-- `set_config` sobre `request.jwt.claim.sub` (asi `auth.uid()` devuelve el
-- owner). No inserta ni actualiza nada.
-- ============================================================

begin;

-- ---------- 1) Quien puede ejecutar las RPCs ----------
-- Aca se ve el `revoke` de la migracion: si alguna aparece sin `{=X/...}`,
-- significa que PUBLIC todavia puede llamarla.
select
  p.proname,
  array_to_string(p.proacl, ' | ') as permisos
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('gym_accounting_summary', 'trainer_accounting_summary')
order by p.proname;

-- ---------- 2) Ejecutar la RPC de verdad, por cada gym, como su dueno ----------
-- Recorre TODOS los gyms, se pone en los shoes del dueno (auth.uid simulado)
-- y llama a la funcion. Si algo esta mal, lo captura y lo muestra.
--
-- El `revoke` de mas abajo es lo que cierra la puerta, NO el
-- `security invoker`. Ojo: el default de privilege de una funcion en
-- PostgreSQL es `EXECUTE TO PUBLIC`, sin importar si es invoker o definer.
-- Peor todavia en Supabase: hay `ALTER DEFAULT PRIVILEGES` sobre el schema
-- public, asi que ademas nace con un grant EXPLICITO para anon. Por eso el
-- `revoke` tiene que decir `from public, anon` y no solo `from public`; con
-- `public` nomas, anon conserva el acceso.
--
-- O sea: `security invoker` esta bien para que el helper no corra con
-- privilegios del owner, pero la unica razon por la que "copiar solo este
-- bloque" no seria una fuga es que el `revoke` de abajo esta en el MISMO
-- bloque. Si copiaste el `create or replace` y nada mas, si es una fuga.
create or replace function public._diag_00046()
returns jsonb
language plpgsql
security invoker
as $$
declare
  r record;
  v_owner uuid;
  v_res jsonb;
  v_err text;
  v_out jsonb := '[]'::jsonb;
begin
  for r in select g.id, g.name, g.owner_id from public.gyms g order by g.name loop
    v_owner := r.owner_id;
    v_err := null;
    v_res := null;

    begin
      perform set_config('request.jwt.claim.sub', v_owner::text, true);
      perform set_config('request.jwt.claims',
        json_build_object('sub', v_owner, 'role', 'authenticated')::text, true);
      v_res := public.gym_accounting_summary(r.id, date_trunc('month', current_date)::date);
    exception when others then
      v_err := sqlerrm;
    end;

    v_out := v_out || jsonb_build_object(
      'gym', r.name,
      'ok', (v_err is null),
      'error', v_err,
      -- si fallo, al menosCela muestra los totales para ver si los datos estan
      'total_mes', case when v_err is not null then null else v_res->>'total' end,
      'cantidad',  case when v_err is not null then null else v_res->>'cantidad' end,
      'esperado',  case when v_err is not null then null else v_res->>'esperado' end,
      'vencidos',  case when v_err is not null then null else v_res->>'vencidos' end,
      'serie_meses', case when v_err is not null then null
                         else jsonb_array_length(coalesce(v_res->'serie', '[]'::jsonb)) end
    );
  end loop;

  perform set_config('request.jwt.claim.sub', '', true);
  return v_out;
end;
$$;

select public._diag_00046() as diagnostico_por_gym;

-- Cuanto hay de verdad en cada gym (simula al dueno). Solo lectura.
create or replace function public._diag_00046_datos()
returns jsonb
language plpgsql
security invoker
as $$
declare
  r record;
  v_owner uuid;
  v_out jsonb := '[]'::jsonb;
begin
  for r in select g.id, g.name, g.owner_id from public.gyms g order by g.name loop
    v_owner := r.owner_id;
    perform set_config('request.jwt.claim.sub', v_owner::text, true);
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_owner, 'role', 'authenticated')::text, true);

    v_out := v_out || jsonb_build_object(
      'gym', r.name,
      'membresias_activas', (select count(*) from public.gym_memberships m
                               where m.gym_id = r.id and m.status = 'activa'),
      'membresias_inactivas', (select count(*) from public.gym_memberships m
                               where m.gym_id = r.id and m.status <> 'activa'),
      'pagos_totales', (select count(*) from public.gym_payments p
                          where p.gym_id = r.id),
      'mes_ultimo_pago', (select max(p.paid_at)::date from public.gym_payments p
                            where p.gym_id = r.id),
      'meses_que_vencen', (select coalesce(jsonb_agg(x.mes), '[]'::jsonb)
                            from (select to_char(m.expires_on, 'YYYY-MM') as mes
                                    from public.gym_memberships m
                                   where m.gym_id = r.id and m.status = 'activa'
                                     and m.expires_on is not null
                                   group by 1 order by 1) x)
    );
  end loop;
  perform set_config('request.jwt.claim.sub', '', true);
  return v_out;
end;
$$;

select public._diag_00046_datos() as datos_por_gym;

-- ---------- 3) Cerrar y deshacer todo ----------
-- Sin esto, estas dos funciones quedan con EXECUTE TO PUBLIC y cualquiera con
-- la anon key las llama por REST. Verificado: `_diag_00046_datos` devolvio
-- cuantos socios activos y en que mes vencen, de cada gym, a una peticion anon.
revoke execute on function public._diag_00046() from public, anon, authenticated;
revoke execute on function public._diag_00046_datos() from public, anon, authenticated;

-- Y el rollback las borra del todo.
rollback;

-- Verificacion opcional: despues del rollback no deberia existir nada.
-- select proname from pg_proc join pg_namespace on pg_namespace.oid = pronamespace
--   where nspname = 'public' and proname like '\_diag%';   -- tiene que dar 0 filas