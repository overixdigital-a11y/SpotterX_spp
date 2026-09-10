-- ============================================================
-- SpotterX - 00024: Adjuntos en el chat.
-- Columna attachment (jsonb) en messages para fotos/videos
-- subidos al bucket media (subcarpeta chat/ del usuario que
-- envía). El contenido pasa a permitir NULL (mensaje solo
-- imagen). Después de 00023. Ejecutar en SQL Editor.
-- ============================================================

alter table public.messages add column if not exists attachment jsonb;

alter table public.messages alter column content drop not null;