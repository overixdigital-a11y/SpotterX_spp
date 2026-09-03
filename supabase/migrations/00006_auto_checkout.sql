-- ============================================================
-- SpotterX - Auto-checkout de alumni (pg_cron)
-- Ejecutar en SQL Editor de Supabase (despues de 00005)
-- ============================================================

-- 1. Extensiones necesarias
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Job: cerrar sesiones de alumni > 3 horas
-- Corre cada 15 minutos. Excluye staff (profesores).
SELECT cron.schedule(
  'auto-checkout-alumni',
  '*/15 * * * *',
  $$
  INSERT INTO gym_access_logs (gym_id, user_id, type, created_at)
  SELECT
    gl.gym_id,
    gl.user_id,
    'egreso',
    gl.created_at + INTERVAL '3 hours'
  FROM gym_access_logs gl
  WHERE gl.type = 'ingreso'
    -- Sin egreso posterior (sesion abierta)
    AND NOT EXISTS (
      SELECT 1 FROM gym_access_logs eg
      WHERE eg.gym_id = gl.gym_id
        AND eg.user_id = gl.user_id
        AND eg.type = 'egreso'
        AND eg.created_at > gl.created_at
    )
    -- Ingreso hace mas de 3 horas
    AND gl.created_at < NOW() - INTERVAL '3 hours'
    -- NO es staff (los profesores se cierran manualmente)
    AND NOT EXISTS (
      SELECT 1 FROM gym_staff gs
      WHERE gs.gym_id = gl.gym_id
        AND gs.user_id = gl.user_id
    );
  $$
);
