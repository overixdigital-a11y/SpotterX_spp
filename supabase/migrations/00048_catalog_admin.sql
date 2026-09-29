-- ============================================================
-- SpotterX - 00048: Catalogo administrable (fotos + crear/editar).
--
-- Que habilita:
--   1. exercises.image_url  -> foto subida por el admin desde /admin/catalogo
--   2. admin_set_exercise_image  -> poner / quitar la foto de un ejercicio
--   3. admin_catalog_usage       -> cuantos rutinas/dietas usan un nombre
--   4. admin_update_exercise     -> editar nombre/grupo/disciplina
--   5. admin_update_food         -> editar nombre/categoria/macros
--
-- Ejecutar en SQL Editor de Supabase DESPUES de 00047.
--
-- REGLAS (no negociar, aprendidas en 00047):
--   * Toda funcion nueva revoca de `public` y de `anon`, y recien ahi grants a
--     `authenticated`. Revocar solo `public` NO alcanza: Supabase agrega un grant
--     explicito a `anon` via ALTER DEFAULT PRIVILEGES.
--   * Guard `_assert_admin()` (00028) en todas: escriben datos de toda la app.
--
-- TRAMPA QUE ESTA MIGRACION RESUELVE:
--   `trainer_routine_items.exercise` y `trainer_plan_items.exercise` guardan el
--   NOMBRE COMO TEXTO, no un id. Si se renombra un ejercicio del catalogo, las
--   rutinas viejas quedan con el nombre viejo y pierden la foto en silencio.
--   Por eso el rename exige `p_cascade = true` cuando el nombre esta en uso.
--
--   Para no pisar comida con ejercicio, los items de dieta se distinguen por
--   `(data->>'meal')`: si tienen `meal` son alimentos; si no, son ejercicios
--   (o items de entrenamiento viejos de 00013).
-- ============================================================

-- 0) Columna de la foto ------------------------------------------------------
-- NULL = no hay foto propia => la app usa la miniatura estatica de
-- public/exercises/ (o nada). La foto propia GANA sobre la estatica.
alter table public.exercises add column if not exists image_url text;

comment on column public.exercises.image_url is
  'URL publica de la foto del ejercicio (bucket media). NULL = usar la miniatura estatica de public/exercises/.';

-- 1) Poner / quitar la foto de un ejercicio ---------------------------------
create or replace function public.admin_set_exercise_image(
  p_exercise_id uuid,
  p_image_url text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public._assert_admin();

  if not exists (select 1 from public.exercises where id = p_exercise_id) then
    raise exception 'El ejercicio no existe';
  end if;

  -- '' o NULL = quitar la foto (vuelve a la estatica).
  update public.exercises
     set image_url = nullif(btrim(coalesce(p_image_url, '')), '')
   where id = p_exercise_id;
end;
$$;

-- 2) Cuantos lugares usan un nombre ------------------------------------------
-- Devuelve { "routines": n, "plans": n }. El admin lo consulta antes de
-- renombrar o de borrar, para avisarle en vez de romper datos en silencio.
create or replace function public.admin_catalog_usage(
  p_kind text,
  p_name text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_routines int := 0;
  v_plans int := 0;
begin
  perform public._assert_admin();

  if lower(coalesce(p_kind, '')) = 'exercise' then
    select count(*) into v_routines
      from public.trainer_routine_items
     where lower(exercise) = lower(p_name);

    -- Items de ENTRENAMIENTO dentro de planes (estructura vieja, 00013).
    -- Los de dieta tienen `meal` en data y NO se tocan.
    select count(*) into v_plans
      from public.trainer_plan_items
     where lower(exercise) = lower(p_name)
       and (data->>'meal') is null;
  else
    -- Alimentos: viven en los items de dieta (los que tienen `meal`).
    select count(*) into v_plans
      from public.trainer_plan_items
     where lower(exercise) = lower(p_name)
       and (data->>'meal') is not null;
  end if;

  return jsonb_build_object('routines', v_routines, 'plans', v_plans);
end;
$$;

-- 3) Editar un ejercicio -----------------------------------------------------
-- El nombre solo se cambia si NO esta en uso, o si el admin confirma con
-- p_cascade = true (en ese caso actualiza las rutinas y planes que lo usan).
create or replace function public.admin_update_exercise(
  p_id uuid,
  p_name text,
  p_muscle text,
  p_discipline text,
  p_cascade boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old text;
  v_new text;
  v_usage jsonb;
  v_routines int := 0;
  v_plans int := 0;
begin
  perform public._assert_admin();

  select name into v_old from public.exercises where id = p_id for update;
  if v_old is null then
    raise exception 'El ejercicio no existe';
  end if;

  v_new := btrim(coalesce(p_name, ''));
  if v_new = '' then
    raise exception 'El nombre no puede quedar vacio';
  end if;

  -- Grupo y disciplina: se actualizan siempre (no dependen de uso).
  update public.exercises
     set muscle     = nullif(btrim(coalesce(p_muscle, '')), ''),
         discipline = nullif(btrim(coalesce(p_discipline, '')), '')
   where id = p_id;

  if lower(v_new) = lower(v_old) then
    return jsonb_build_object('renamed_routines', 0, 'renamed_plans', 0, 'name', v_new);
  end if;

  select * into v_usage from public.admin_catalog_usage('exercise', v_old);
  v_routines := coalesce((v_usage->>'routines')::int, 0);
  v_plans    := coalesce((v_usage->>'plans')::int, 0);

  if (v_routines + v_plans) > 0 and not coalesce(p_cascade, false) then
    raise exception 'Ese nombre esta en uso en % rutina(s) y % plan(s). Reintenta confirmando la actualizacion.', v_routines, v_plans;
  end if;

  begin
    update public.exercises set name = v_new where id = p_id;
  exception when unique_violation then
    raise exception 'Ya existe un ejercicio llamado "%"', v_new;
  end;

  update public.trainer_routine_items
     set exercise = v_new
   where lower(exercise) = lower(v_old);

  update public.trainer_plan_items
     set exercise = v_new
   where lower(exercise) = lower(v_old)
     and (data->>'meal') is null;

  return jsonb_build_object('renamed_routines', v_routines, 'renamed_plans', v_plans, 'name', v_new);
end;
$$;

-- 4) Editar un alimento ------------------------------------------------------
-- Mismo criterio. Las macros quedan COPIADAS en cada item de dieta (`data`),
-- asi que un rename no rompe los numeros: solo evita nombres viejos escritos.
create or replace function public.admin_update_food(
  p_id uuid,
  p_name text,
  p_category text,
  p_kcal real,
  p_protein_g real,
  p_fat_g real,
  p_carbs_g real,
  p_unit_grams real,
  p_cascade boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old text;
  v_new text;
  v_usage jsonb;
  v_plans int := 0;
begin
  perform public._assert_admin();

  select name into v_old from public.foods where id = p_id for update;
  if v_old is null then
    raise exception 'El alimento no existe';
  end if;

  v_new := btrim(coalesce(p_name, ''));
  if v_new = '' then
    raise exception 'El nombre no puede quedar vacio';
  end if;

  -- `foods.category` es NOT NULL (00021): si el admin manda vacio cae en 'Otros',
  -- nunca en NULL, que reventaria el update con un not-null violation.
  update public.foods
     set category   = coalesce(nullif(btrim(coalesce(p_category, '')), ''), 'Otros'),
         kcal        = coalesce(p_kcal, 0),
         protein_g   = coalesce(p_protein_g, 0),
         fat_g       = coalesce(p_fat_g, 0),
         carbs_g     = coalesce(p_carbs_g, 0),
         unit_grams  = p_unit_grams
   where id = p_id;

  if lower(v_new) = lower(v_old) then
    return jsonb_build_object('renamed_routines', 0, 'renamed_diets', 0, 'name', v_new);
  end if;

  select * into v_usage from public.admin_catalog_usage('food', v_old);
  v_plans := coalesce((v_usage->>'plans')::int, 0);

  if v_plans > 0 and not coalesce(p_cascade, false) then
    raise exception 'Ese alimento esta en uso en % dieta(s). Reintenta confirmando la actualizacion.', v_plans;
  end if;

  begin
    update public.foods set name = v_new where id = p_id;
  exception when unique_violation then
    raise exception 'Ya existe un alimento llamado "%"', v_new;
  end if;

  update public.trainer_plan_items
     set exercise = v_new
   where lower(exercise) = lower(v_old)
     and (data->>'meal') is not null;

  return jsonb_build_object('renamed_routines', 0, 'renamed_diets', v_plans, 'name', v_new);
end;
$$;

-- 5) Permisos ----------------------------------------------------------------
-- Orden de 00047: revoke de public+anon, y SOLO despues grant a authenticated.
revoke execute on function public.admin_set_exercise_image(uuid, text) from public, anon;
grant   execute on function public.admin_set_exercise_image(uuid, text) to authenticated;

revoke execute on function public.admin_catalog_usage(text, text) from public, anon;
grant   execute on function public.admin_catalog_usage(text, text) to authenticated;

revoke execute on function public.admin_update_exercise(uuid, text, text, text, boolean) from public, anon;
grant   execute on function public.admin_update_exercise(uuid, text, text, text, boolean) to authenticated;

revoke execute on function public.admin_update_food(uuid, text, text, real, real, real, real, real, boolean) from public, anon;
grant   execute on function public.admin_update_food(uuid, text, text, real, real, real, real, real, boolean) to authenticated;

-- `admin_delete_exercise` y `admin_delete_food` (00028) ya existen y 00047 les
-- abrio/cerraro los permisos. NO se recrean aqui: si se recrearan, perderian el
-- grant a authenticated y el boton de borrar dejaria de funcionar.
