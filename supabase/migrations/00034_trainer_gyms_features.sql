-- 00034: Caracteristicas por ubicacion del profe (trainer_gyms)
-- disciplinas (array), descripcion, notas + RPC actualizado para el perfil publico.

alter table public.trainer_gyms
  add column if not exists disciplines text[],
  add column if not exists description text,
  add column if not exists notes text;

DROP FUNCTION IF EXISTS get_trainer_workplaces(uuid);
CREATE OR REPLACE FUNCTION get_trainer_workplaces(p_trainer_id uuid)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT jsonb_build_object(
    'gyms', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'gym_id', g.id,
        'name', g.name,
        'city', g.city,
        'address', g.address,
        'latitude', g.latitude,
        'longitude', g.longitude
      ))
      FROM gym_staff s
      JOIN gyms g ON g.id = s.gym_id
      WHERE s.user_id = p_trainer_id AND s.authorized = true
    ), '[]'::jsonb),
    'zonas', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', tg.id,
        'name', tg.name,
        'city', tg.city,
        'address', tg.address,
        'availability', tg.availability,
        'disciplines', tg.disciplines,
        'description', tg.description,
        'notes', tg.notes,
        'latitude', tg.latitude,
        'longitude', tg.longitude
      ))
      FROM trainer_gyms tg
      WHERE tg.trainer_id = p_trainer_id
    ), '[]'::jsonb)
  );
$$;