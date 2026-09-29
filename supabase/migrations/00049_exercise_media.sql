-- ============================================================
-- SpotterX - 00049: Galeria de fotos + video demo por ejercicio.
--
-- Que habilita:
--   1. exercises.image_urls  -> hasta 5 fotos (array, en orden de subida)
--   2. exercises.demo_url    -> 1 video demo (mp4/webm)
--   3. admin_set_exercise_media -> setear fotos + video de un ejercicio
--
-- Ejecutar en SQL Editor de Supabase DESPUES de 00048.
--
-- POR QUE UN ARRAY Y NO UNA TABLA NUEVA:
--   Las fotos viven EN la fila del ejercicio, no en una tabla aparte keyed por
--   nombre. Eso hace que un rename del catalogo las arrastre solo (mismo
--   problema de fondo de la 00048: el nombre es TEXTO en las rutinas).
--   `market_products.images text[]` (00026) ya usa este mismo patron.
--
-- POR QUE NO SE TOCA `image_url` NI `admin_set_exercise_image` ACA:
--   La app en PRODUCCION los esta usando en este momento. Revocarlos o dropear
--   la funcion antes del deploy rompe la subida de fotos hoy.
--   Se limpian en la 00050, despues de que el codigo nuevo este arriba.
--
-- REGLAS (no negociar, aprendidas en 00047):
--   * Toda funcion nueva revoca de `public` y de `anon`, y recien ahi grants a
--     `authenticated`. Revocar solo `public` NO alcanza: Supabase agrega un grant
--     explicito a `anon` via ALTER DEFAULT PRIVILEGES.
--   * Guard `_assert_admin()` (00028) en todas: escriben datos de toda la app.
-- ============================================================

-- 0) Columnas ------------------------------------------------------------------
-- image_urls: array VACIO = sin fotos propias => la app usa la miniatura estatica
-- de public/exercises/ (o nada). La foto propia GANA sobre la estatica y la
-- primera del array es la portada.
alter table public.exercises add column if not exists image_urls text[] not null default '{}';
alter table public.exercises add column if not exists demo_url text;

comment on column public.exercises.image_urls is
  'Hasta 5 URLs publicas de fotos del ejercicio (bucket media), en orden de subida. La [0] es la portada. Array vacio = usar la miniatura estatica de public/exercises/.';

comment on column public.exercises.demo_url is
  'URL publica del video demo mp4/webm del ejercicio (bucket media). NULL = sin video.';

-- 1) Setear fotos + video de un ejercicio -------------------------------------
-- Reemplaza el set completo en una sola llamada (atomo). El frontend mantiene el
-- array en estado y manda el entero, asi agregar/quitar es una sola operacion.
-- Array vacio = sin fotos. p_demo_url vacio o NULL = sin video.
create or replace function public.admin_set_exercise_media(
  p_exercise_id uuid,
  p_image_urls text[],
  p_demo_url text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_urls text[];
  v_demo text;
  v_max constant integer := 5;
begin
  perform public._assert_admin();

  if not exists (select 1 from public.exercises where id = p_exercise_id) then
    raise exception 'El ejercicio no existe';
  end if;

  -- Limpieza: trim, descartar vacios y deduplicar CONSERVANDO el orden de subida
  -- (que es el orden de la galeria). El `distinct on` con `with ordinality` se
  -- queda con la primera aparicion de cada valor; el `array_agg(... order by ord)`
  -- de afuera vuelve a ordenar por posicion original.
  select coalesce(
           array_agg(trimmed order by ord) filter (where trimmed <> ''),
           '{}'::text[]
         )
    into v_urls
    from (
      select distinct on (btrim(u)) btrim(u) as trimmed, ord
        from unnest(coalesce(p_image_urls, '{}'::text[])) with ordinality as t(u, ord)
       order by btrim(u), ord
    ) s;

  if array_length(v_urls, 1) is not null and array_length(v_urls, 1) > v_max then
    raise exception 'Maximo % fotos por ejercicio (enviaste %)',
      v_max, array_length(v_urls, 1);
  end if;

  -- Las URLs tienen que ser del bucket `media`. Sin esto un admin podria meter
  -- una URL arbitraria y romper el `next/image` (host no permitido en
  -- next.config.ts) o colgar el thumbnail de un sitio de terceros.
  if exists (
    select 1 from unnest(v_urls) as u
     where u not like '%/storage/v1/object/public/media/%'
  ) then
    raise exception 'Las fotos tienen que estar en el bucket media';
  end if;

  v_demo := nullif(btrim(coalesce(p_demo_url, '')), '');

  if v_demo is not null and v_demo not like '%/storage/v1/object/public/media/%' then
    raise exception 'El video tiene que estar en el bucket media';
  end if;

  update public.exercises
     set image_urls = v_urls,
         demo_url   = v_demo
   where id = p_exercise_id;
end;
$$;

-- Orden de 00047: revoke de public+anon, y SOLO despues grant a authenticated.
revoke execute on function public.admin_set_exercise_media(uuid, text[], text) from public, anon;
grant   execute on function public.admin_set_exercise_media(uuid, text[], text) to authenticated;

-- 2) Verificacion (solo lectura, corre esto al final) -------------------------
-- Debe devolver 1 fila.
--   select p.proname, p.prosecdef
--     from pg_proc p
--     join pg_namespace n on n.oid = p.pronamespace
--    where n.nspname = 'public' and p.proname = 'admin_set_exercise_media';
