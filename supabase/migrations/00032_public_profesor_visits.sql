-- 00032_public_profesor_visits.sql
-- Acceso público a alumnos del profe + RPC de lugares + columnas notif orden

-- 1. Política pública de lectura en trainer_students (para perfil público del profe)
DROP POLICY IF EXISTS "TS: lectura publica" ON public.trainer_students;
CREATE POLICY "TS: lectura publica" ON public.trainer_students
  FOR SELECT USING (true);

-- 2. RPC lugares de trabajo del profe (SECURITY DEFINER para leer gym_staff)
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
        'latitude', tg.latitude,
        'longitude', tg.longitude
      ))
      FROM trainer_gyms tg
      WHERE tg.trainer_id = p_trainer_id
    ), '[]'::jsonb)
  );
$$;

-- 3. Columnas que el trigger notify_market_order (00026) necesita
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS ref_id uuid;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS message text;
