-- SpotterX - 00035: Fix constraint notifications_type_check (faltaba 'orden')
-- Ejecutar en SQL Editor.
--
-- Contexto: la constraint se re-crea en CADA migracion (00005, 00011, 00015,
-- 00026) y las versiones viejas NO incluyen los tipos agregados despues. Si se
-- re-ejecuta una migracion vieja, el tipo 'orden' (agregado en 00026) desaparece
-- y el trigger de notificacion del checkout (notify_market_order) falla con
-- "violates check constraint notifications_type_check".
-- Fix: re-crear la constraint con la LISTA ACUMULATIVA COMPLETA de tipos.
-- LECCION: al agregar un nuevo tipo de notificacion o re-correr una migracion
-- vieja, SIEMPRE re-crear la constraint con todos los tipos existentes.

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check check (
    type in ('pulse', 'comment', 'follow', 'message', 'checkin', 'vencimiento', 'solicitud_staff', 'staff_aprobado', 'orden')
  );