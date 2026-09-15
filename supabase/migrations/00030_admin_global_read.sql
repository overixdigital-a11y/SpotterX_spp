-- =====================================================
-- SpotterX - 00030: admin panel - lectura global RLS
-- Permite al admin leer todas las filas (SELECT) de las
-- tablas principales que usa el panel de administración.
-- Correr en SQL Editor de Supabase.
-- =====================================================

-- Helper: ver si el usuario actual es admin
-- (ya existe _assert_admin, se reutiliza la lógica inline aquí)

-- gym_memberships
create policy "Admin: lectura global" on public.gym_memberships
  for select using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true));

-- gym_staff
create policy "Admin: lectura global" on public.gym_staff
  for select using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true));

-- gym_plans
create policy "Admin: lectura global" on public.gym_plans
  for select using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true));

-- gym_access_logs
create policy "Admin: lectura global" on public.gym_access_logs
  for select using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true));

-- gym_member_details
create policy "Admin: lectura global" on public.gym_member_details
  for select using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true));

-- trainer_students
create policy "Admin: lectura global" on public.trainer_students
  for select using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true));

-- market_orders
create policy "Admin: lectura global" on public.market_orders
  for select using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true));

-- market_order_items
create policy "Admin: lectura global" on public.market_order_items
  for select using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true));
