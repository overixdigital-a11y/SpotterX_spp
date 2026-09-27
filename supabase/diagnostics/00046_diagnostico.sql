-- ============================================================
-- DIAGNOSTICO 00046 - contabilidad de cuotas
-- Pegalo en el SQL Editor y mandame el resultado de la 2da consulta.
-- No modifica nada: es solo lectura + una simulacion de sesion.
-- ============================================================

-- ---------- 1) Quien puede ejecutar las RPCs ----------
select
  p.proname,
  p.proacl::text                                   as permisos,
  array_to_string(p.proacl, ' | ')                 as permisos_legible
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('gym_accounting_summary', 'trainer_accounting_summary')
order by p.proname;

-- ---------- 2) Ejecutar la RPC de verdad, por cada gym, como su dueno ----------
-- Recorre TODOS los gyms, se pone en los shoes del dueno (auth.uid simulado)
-- y llama a la funcion. Si algo esta mal, lo captura y lo muestra.
create or replace function public._diag_00046()
returns jsonb
language plpgsql
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