-- 00031_profesor_profile.sql
-- Extiende el perfil del profesor: certificaciones, tarifas, portfolio, horarios

-- 1. Nuevas columnas en profiles (solo para profesores)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS certifications jsonb NOT NULL DEFAULT '[]';
-- Ejemplo: [{ "name": "NSCA-CPT", "issuer": "NSCA", "year": 2023 }]

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS hourly_rate numeric;
-- Tarifa por hora en la moneda local (null = no definida)

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS specialties text[] NOT NULL DEFAULT '{}';
-- Ejemplo: {'fuerza', 'cardio', 'nutricion', 'rehabilitacion'}

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS portfolio jsonb NOT NULL DEFAULT '[]';
-- Ejemplo: [{ "url": "...", "type": "image", "caption": "Transformación 6 meses" }]

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS availability jsonb NOT NULL DEFAULT '{}';
-- Ejemplo: { "mon": ["09:00-12:00", "14:00-18:00"], "tue": ["10:00-14:00"], ... }

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS years_experience integer;
-- Años de experiencia

-- 2. Índices para búsquedas
CREATE INDEX IF NOT EXISTS idx_profiles_specialties ON profiles USING gin (specialties);
CREATE INDEX IF NOT EXISTS idx_profiles_hourly_rate ON profiles (hourly_rate) WHERE hourly_rate IS NOT NULL;

-- 3. Tabla de reseñas de alumnos a profesores
CREATE TABLE IF NOT EXISTS trainer_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reviewer_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  rating smallint NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (trainer_id, reviewer_id)
);

ALTER TABLE trainer_reviews ENABLE ROW LEVEL SECURITY;

-- Policies: cualquiera lee, solo el reviewer crea/edita/borra
CREATE POLICY "Reviews: public read"
  ON trainer_reviews FOR SELECT
  USING (true);

CREATE POLICY "Reviews: reviewer gestiona"
  ON trainer_reviews FOR ALL
  USING (auth.uid() = reviewer_id)
  WITH CHECK (auth.uid() = reviewer_id);

-- RPC para obtener stats del profe
CREATE OR REPLACE FUNCTION get_trainer_stats(p_trainer_id uuid)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT jsonb_build_object(
    'students', (SELECT count(*) FROM trainer_students WHERE trainer_id = p_trainer_id AND active = true),
    'gyms', (SELECT count(*) FROM gym_staff WHERE user_id = p_trainer_id AND authorized = true),
    'reviews_count', (SELECT count(*) FROM trainer_reviews WHERE trainer_id = p_trainer_id),
    'avg_rating', (SELECT round(avg(rating), 1) FROM trainer_reviews WHERE trainer_id = p_trainer_id),
    'plans_created', (SELECT count(*) FROM trainer_plans WHERE trainer_id = p_trainer_id),
    'routines_completed', (SELECT count(*) FROM trainer_routines WHERE trainer_id = p_trainer_id AND completed_at IS NOT NULL)
  );
$$;

-- RPC para upsert reseña
CREATE OR REPLACE FUNCTION upsert_trainer_review(
  p_trainer_id uuid,
  p_rating smallint,
  p_comment text DEFAULT NULL
)
RETURNS void
LANGUAGE sql SECURITY DEFINER
AS $$
  INSERT INTO trainer_reviews (trainer_id, reviewer_id, rating, comment)
  VALUES (p_trainer_id, auth.uid(), p_rating, p_comment)
  ON CONFLICT (trainer_id, reviewer_id)
  DO UPDATE SET rating = p_rating, comment = p_comment;
$$;

-- Realtime para reseñas
ALTER PUBLICATION supabase_realtime ADD TABLE trainer_reviews;
