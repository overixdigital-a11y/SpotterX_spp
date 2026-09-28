-- 00047_verificacion.sql
-- SOLO LECTURA. No modificar nada de la base; se puede correr las veces que haga falta.
--
-- Correr DESPUES de aplicar 00047_rpc_grants_hardening.sql.
--
-- Chequeo 1 (el que importa): que funciones siguen siendo publicas.
-- `aclexplode(proacl).grantee = 0` identifica PUBLIC de forma definitiva, porque
-- el grantee de PUBLIC es el oid 0. NO usar `proacl::text like '%=X/%'`: en LIKE
-- el % es comodin, asi que ese patron tambien matchea `postgres=X/postgres` y
-- marca como publica cualquier funcion con permiso de ejecutar (falsos positivos).
--
-- RESULTADO ESPERADO: 2 filas, get_trainer_stats y get_trainer_workplaces.
-- Son los perfiles publicos que se ven sin login. Si sale una tercera, paso lo
-- que aparece y reviso esa funcion.

select p.proname,
       array_to_string(p.proacl, ' | ') as permisos
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and exists (
    select 1
    from aclexplode(p.proacl) a
    where a.grantee = 0
  )
order by p.proname;

-- Chequeo 2: que rol puede ejecutar cada funcion. Lo que hay que leer es que
-- `anon` NO aparezca en la columna rolname de las funciones de negocio.
-- RESULTADO ESPERADO: 2 filas, get_trainer_stats y get_trainer_workplaces
-- (las unicas publicas a proposito, con grant explicito a anon).
-- OJO: la columna de pg_roles se llama `rolname`, NO `role_name`.
-- service_role puede aparecer: lo necesita para correr la app desde el servidor.

select p.proname,
       string_agg(r.rolname, ', ' order by r.rolname) as roles_con_exec
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
cross join lateral aclexplode(p.proacl) a
join pg_roles r on r.oid = a.grantee
where n.nspname = 'public' and a.privilege_type = 'EXECUTE'
group by p.proname
having bool_or(r.rolname = 'anon')
order by p.proname;

-- Chequeo 3: huerfano eliminado. Debe devolver 0 filas.
-- (si todavia devuelve algo, es que hay otra funcion de la 00037 viva)

select proname
from pg_proc
where proname = 'admin_pending_withdrawals';

-- Chequeo 4: sanity de las funciones que deben seguir funcionando.
-- gym_attendance_today ahora es plpgsql con guard, no la old version en sql.

select p.proname,
       l.lanname as lenguaje,
       p.prosecdef as es_security_definer
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
join pg_language l on l.oid = p.prolang
where n.nspname = 'public'
  and p.proname in ('gym_attendance_today', 'gym_accounting_summary', 'trainer_accounting_summary')
order by p.proname;
