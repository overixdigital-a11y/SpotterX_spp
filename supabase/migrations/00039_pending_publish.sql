-- SpotterX - 00039: publicaciones pendientes de pago (sin billetera)
-- Cuando el publicador agota su cupo gratis, al tocar "Publicar" se crea el
-- producto con status 'pending' + se registra el deposito (publish_deposits
-- con product_id). El admin lo ve en "Publicaciones pendientes de pago" y con
-- "Aprobar y publicar" (admin_approve_deposit) activa el producto. La billetera
-- deja de participar del flujo de publicaciones (queda para el modo carrito).
-- Correr en SQL Editor.

-- =====================================================
-- 1) market_products.status admite 'pending'
--    (los pendientes no salen en la tienda que filtra status='active'
--    y NO cuentan el cupo que mira active/paused)
-- =====================================================

alter table public.market_products drop constraint if exists market_products_status_check;

alter table public.market_products
  add constraint market_products_status_check check (
    status in ('active', 'sold', 'paused', 'pending')
  );

-- =====================================================
-- 2) publish_deposits.product_id (deposito vinculado a la publicacion)
-- =====================================================

alter table public.publish_deposits
  add column if not exists product_id uuid references public.market_products(id) on delete set null;

create index if not exists idx_publish_deposits_product on public.publish_deposits (product_id);

-- =====================================================
-- 3) RPC: market_publish_pending
--    Crea la publicacion 'pending' + el deposito + aviso in-app al admin.
--    Devuelve el pedido (text) para mostrarlo al publicador.
-- =====================================================

create or replace function public.market_publish_pending(
  p_name text,
  p_description text,
  p_price numeric,
  p_category text,
  p_condition text default 'new',
  p_stock int default 1,
  p_location text default null,
  p_images text[] default '{}'
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seller uuid := auth.uid();
  v_price numeric;
  v_pedido text;
  v_admin uuid;
  v_product uuid;
begin
  if v_seller is null then
    raise exception 'No autenticado';
  end if;

  if p_name is null or btrim(p_name) = '' or p_price is null or p_price < 0 then
    raise exception 'Nombre y precio válidos son obligatorios';
  end if;

  select value::numeric into v_price from public.platform_config where key = 'publish_price';
  if v_price is null then v_price := 100; end if;

  insert into public.market_products (
    seller_id, name, description, price, category, condition, stock, status, location, images
  )
  values (
    v_seller, btrim(p_name), nullif(btrim(coalesce(p_description, '')), ''), p_price,
    p_category, coalesce(p_condition, 'new'), greatest(coalesce(p_stock, 1), 1), 'pending',
    nullif(btrim(coalesce(p_location, '')), ''), coalesce(p_images, '{}')
  )
  returning id into v_product;

  v_pedido := 'SP-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(md5(random()::text), 1, 4));

  insert into public.publish_deposits (pedido, user_id, amount, note, product_id)
  values (v_pedido, v_seller, v_price, 'Publicación "' || btrim(p_name) || '"', v_product);

  select id into v_admin
  from public.profiles
  where is_admin = true
  order by created_at
  limit 1;

  if v_admin is not null then
    insert into public.notifications (user_id, actor_id, type, ref_id, message)
    values (v_admin, v_seller, 'pago_publicacion', v_product,
      'Depósito ' || v_pedido || ' por "' || btrim(p_name) || '" ($' || v_price::text || ')');
  end if;

  return v_pedido;
end;
$$;

-- =====================================================
-- 4) RPC: admin_list_deposits (incluye el producto vinculado)
-- =====================================================

create or replace function public.admin_list_deposits(
  p_status text default 'pendiente'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_data jsonb;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and is_admin = true) then
    raise exception 'No autorizado';
  end if;

  select coalesce(jsonb_agg(t), '[]'::jsonb) into v_data
  from (
    select
      d.id,
      d.pedido,
      d.amount,
      d.status,
      d.note,
      d.created_at,
      d.acredited_at,
      d.user_id,
      d.product_id,
      p.username,
      p.full_name,
      p.email,
      mp.name as product_name,
      mp.price as product_price
    from public.publish_deposits d
    join public.profiles p on p.id = d.user_id
    left join public.market_products mp on mp.id = d.product_id
    where d.status = p_status
    order by d.created_at desc
    limit 100
  ) t;

  return v_data;
end;
$$;

-- =====================================================
-- 5) RPC: admin_approve_deposit
--    Acredita el deposito y, si tiene publicacion vinculada, la activa
--    (pending -> active). YA NO acredita saldo de billetera (la billetera
--    queda para el modo carrito).
-- =====================================================

create or replace function public.admin_approve_deposit(
  p_deposit_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dep record;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and is_admin = true) then
    raise exception 'No autorizado';
  end if;

  select * into v_dep
  from public.publish_deposits
  where id = p_deposit_id and status = 'pendiente';

  if not found then
    raise exception 'Depósito no encontrado o ya acreditado';
  end if;

  update public.publish_deposits
  set status = 'acreditado', acredited_at = now()
  where id = p_deposit_id;

  if v_dep.product_id is not null then
    update public.market_products
    set status = 'active'
    where id = v_dep.product_id;
  end if;
end;
$$;

-- =====================================================
-- 6) RPC: admin_publish_revenue
--    Los ingresos por publicaciones = depositos acreditados.
-- =====================================================

create or replace function public.admin_publish_revenue()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total numeric;
  v_count bigint;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and is_admin = true) then
    raise exception 'No autorizado';
  end if;

  select coalesce(sum(amount), 0), count(*) into v_total, v_count
  from public.publish_deposits
  where status = 'acreditado';

  return jsonb_build_object('total', v_total, 'count', v_count);
end;
$$;