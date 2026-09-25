-- SpotterX - 00040: platform_config legible (RLS la bloqueaba por completo)
-- =========================================================================
-- Causa raiz: platform_config tiene RLS HABILITADA sin ninguna policy -> ni
-- anon ni autenticados pueden leerla via PostgREST. Resultado: getMarketConfig()
-- devolvia accounts:[] siempre -> el modal de /market/crear mostraba
-- "El administrador todavia no cargo una cuenta de cobro" aunque el admin la
-- hubiera cargado (el guardado funciona porque admin_set_payment_config es
-- security definer; lo que no andaba era LEERLA de vuelta).
-- Afectaba tambien a /admin/market (free_publishes/publish_price) y a
-- MarketShell/storefront/[id]/billetera/carrito (allow_cart).
--
-- Fix: policy SELECT para todas las roles (solo contiene valores publicos:
-- cupo gratis, precio de publicacion, cuentas de cobro, contacto, toggle de
-- carrito). INSERT/UPDATE/DELETE siguen SIN policy -> solo las RPCs security
-- definer (admin_set_payment_config, admin_set_publication_config, etc.)
-- pueden escribir. Idempotente: correr varias veces no rompe nada.
-- =========================================================================

alter table public.platform_config enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'platform_config'
      and policyname = 'platform_config_read'
  ) then
    create policy "platform_config_read"
      on public.platform_config
      for select
      using (true);
  end if;
end $$;