-- ============================================================
-- SpotterX - Unique en gym_memberships (gym_id, user_id)
-- Ejecutar en SQL Editor de Supabase (despues de 00006)
-- Necesario para que el upsert de invite-member funcione
-- ============================================================

ALTER TABLE public.gym_memberships
  ADD CONSTRAINT gym_memberships_gym_user_key UNIQUE (gym_id, user_id);
