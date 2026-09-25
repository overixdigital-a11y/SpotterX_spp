-- =====================================================
-- SpotterX - 00029: rol "admin" en profiles + cuenta raiz
-- YA CORRIDA en la DB (15/09/2026). Archivo de registro
-- historico: NO volver a ejecutar en el SQL Editor.
-- =====================================================

-- 1) Ampliar el CHECK de role para incluir 'admin'
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check check (role in ('gym', 'profesor', 'alumno', 'admin'));

-- 2) Marcar al dueno con rol admin
update public.profiles set role = 'admin' where email = 'overix.digital@gmail.com';

-- 3) Limpieza: gym de prueba "Lautiadmin"
delete from public.gyms where name = 'Lautiadmin';