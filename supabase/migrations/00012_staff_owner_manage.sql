-- ============================================================
-- SpotterX - Buscador de personas: el owner gestiona su staff
-- Ejecutar en SQL Editor de Supabase (despues de 00011)
-- ============================================================

-- Permite que el dueño del gym agregue/quite profesores (gym_staff) desde la app.
-- Hasta ahora solo existia "Staff: lectura propia" (el alta pasaba por la edge
-- function invite-member con service role). Con esta policy el cliente (anon key)
-- puede hacer upsert directo, igual que ya hace con gym_memberships.
drop policy if exists "Staff: owner gestiona" on public.gym_staff;
create policy "Staff: owner gestiona" on public.gym_staff
  for all using (
    exists (select 1 from public.gyms g where g.id = gym_id and g.owner_id = auth.uid())
  ) with check (
    exists (select 1 from public.gyms g where g.id = gym_id and g.owner_id = auth.uid())
  );