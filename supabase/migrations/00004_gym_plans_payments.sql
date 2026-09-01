-- ============================================================
-- SpotterX - Pulido de Planes + Fase 5 (Cobro de Cuota manual)
-- Ejecutar en SQL Editor de Supabase (despues de 00003)
-- ============================================================

-- 1) gym_plans: duracion en MESES (1,2,3,6,12) y promo de captacion
alter table public.gym_plans add column if not exists duration_months int default 1;
alter table public.gym_plans add column if not exists promo_type text
  check (promo_type in ('2x1', '3x2', '4x3'));

-- 2) gym_memberships: estado de pago de la cuota
alter table public.gym_memberships add column if not exists pay_status text
  default 'pendiente'
  check (pay_status in ('pagado', 'promo', 'pendiente'));

-- 3) gym_payments: nota opcional (este method/paid_at ya existen)
alter table public.gym_payments add column if not exists note text;

-- Indices para consultas rapidas por estado
create index if not exists idx_memberships_pay on public.gym_memberships (gym_id, pay_status);
