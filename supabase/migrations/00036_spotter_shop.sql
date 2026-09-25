-- SpotterX - 00036: SpotterShop - sin comision por venta, cobro por publicacion,
-- cupo gratis general + override por usuario.
-- Ejecutar en SQL Editor.
--
-- CAMBIO DE MONETIZACION:
--   * Se ELIMINA la comision del 1% sobre las ventas: market_checkout guarda
--     platform_fee = 0 siempre y buy_from_wallet acredita el 100% al vendedor.
--   * Nuevo cobro: POR PUBLICACION. Cada vendedor tiene un cupo de publicaciones
--     gratis (config general free_publishes, editable por el admin) y un override
--     individual (profiles.shop_free_limit: NULL = usa el general, 0 = paga todo).
--     Al publicar (market_publish), si ya alcanzo su cupo efectivo, se descuenta
--     publish_price de su billetera (movimiento type='publish').
--   * RPCs admin: admin_set_publication_config (general) y admin_set_user_free_limit
--     (override individual, para premios y quitas puntuales).

-- =====================================================
-- 1) platform_config: claves nuevas
-- =====================================================

insert into public.platform_config (key, value)
values
  ('free_publishes', to_jsonb(3)),
  ('publish_price', to_jsonb(100))
on conflict (key) do nothing;

-- =====================================================
-- 2) profiles.shop_free_limit (override por usuario)
-- =====================================================

alter table public.profiles add column if not exists shop_free_limit int;

-- =====================================================
-- 3) wallet_transactions: tipo 'publish'
-- =====================================================

alter table public.wallet_transactions drop constraint if exists wallet_transactions_type_check;
alter table public.wallet_transactions
  add constraint wallet_transactions_type_check check (
    type in ('credit', 'debit', 'commission', 'withdrawal_request', 'withdrawal_paid', 'refund', 'publish')
  );

-- =====================================================
-- 4) market_checkout SIN comision (platform_fee = 0)
-- =====================================================

create or replace function public.market_checkout(
  p_items jsonb,
  p_delivery text default 'retiro',
  p_address text default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_buyer uuid := auth.uid();
  v_seller uuid;
  v_total numeric := 0;
  v_order_id uuid;
  v_item jsonb;
  v_product record;
begin
  if v_buyer is null then
    raise exception 'No autenticado';
  end if;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    select * into v_product
    from public.market_products
    where id = (v_item->>'product_id')::uuid
      and status = 'active'
    for update;

    if not found then
      raise exception 'Producto no encontrado o inactivo: %', v_item->>'product_id';
    end if;

    if v_product.stock < (v_item->>'quantity')::int then
      raise exception 'Stock insuficiente para: %', v_product.name;
    end if;

    if v_seller is null then
      v_seller := v_product.seller_id;
    elsif v_seller != v_product.seller_id then
      raise exception 'No se pueden mezclar productos de distintos vendedores en una orden';
    end if;

    if v_seller = v_buyer then
      raise exception 'No podés comprar tu propio producto';
    end if;

    v_total := v_total + (v_item->>'quantity')::int * v_product.price;
  end loop;

  insert into public.market_orders (buyer_id, seller_id, total, platform_fee, delivery_type, address, notes)
  values (v_buyer, v_seller, v_total, 0, p_delivery, p_address, p_notes)
  returning id into v_order_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    insert into public.market_order_items (order_id, product_id, quantity, price)
    values (
      v_order_id,
      (v_item->>'product_id')::uuid,
      (v_item->>'quantity')::int,
      (select price from public.market_products where id = (v_item->>'product_id')::uuid)
    );

    update public.market_products
    set stock = stock - (v_item->>'quantity')::int,
        status = case when stock - (v_item->>'quantity')::int <= 0 then 'sold' else status end
    where id = (v_item->>'product_id')::uuid;
  end loop;

  return v_order_id;
end;
$$;

-- =====================================================
-- 5) buy_from_wallet SIN comision (el vendedor cobra el 100%)
-- =====================================================

create or replace function public.buy_from_wallet(
  p_order_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_buyer uuid := auth.uid();
  v_order record;
  v_buyer_wallet uuid;
  v_seller_wallet uuid;
begin
  select * into v_order
  from public.market_orders
  where id = p_order_id and buyer_id = v_buyer and status = 'pending'
  for update;

  if not found then
    raise exception 'Orden no encontrada, no es tuya, o no está pendiente';
  end if;

  select id into v_buyer_wallet from public.wallets where user_id = v_buyer for update;
  if not found then
    insert into public.wallets (user_id) values (v_buyer) returning id into v_buyer_wallet;
  end if;

  select id into v_seller_wallet from public.wallets where user_id = v_order.seller_id for update;
  if not found then
    insert into public.wallets (user_id) values (v_order.seller_id) returning id into v_seller_wallet;
  end if;

  if (select balance from public.wallets where id = v_buyer_wallet) < v_order.total then
    raise exception 'Saldo insuficiente. Necesitás $% y tenés $%', v_order.total, (select balance from public.wallets where id = v_buyer_wallet);
  end if;

  update public.wallets set balance = balance - v_order.total where id = v_buyer_wallet;
  insert into public.wallet_transactions (wallet_id, type, amount, reference, note)
  values (v_buyer_wallet, 'debit', -v_order.total, p_order_id::text, 'Compra orden #' || substring(p_order_id::text, 1, 8));

  update public.wallets set balance = balance + v_order.total where id = v_seller_wallet;
  insert into public.wallet_transactions (wallet_id, type, amount, reference, note)
  values (v_seller_wallet, 'credit', v_order.total, p_order_id::text, 'Venta orden #' || substring(p_order_id::text, 1, 8));

  update public.market_orders set status = 'confirmed' where id = p_order_id;
end;
$$;

-- =====================================================
-- 6) RPC: market_publish (cobro por publicacion)
-- =====================================================

create or replace function public.market_publish(
  p_name text,
  p_description text,
  p_price numeric,
  p_category text,
  p_condition text default 'new',
  p_stock int default 1,
  p_location text default null,
  p_images text[] default '{}'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seller uuid := auth.uid();
  v_free int;
  v_price numeric;
  v_in_shop int;
  v_wallet uuid;
  v_balance numeric;
  v_price_note text;
  v_id uuid;
begin
  if v_seller is null then
    raise exception 'No autenticado';
  end if;

  if p_name is null or btrim(p_name) = '' or p_price is null or p_price < 0 then
    raise exception 'Nombre y precio válidos son obligatorios';
  end if;

  select value::int into v_free from public.platform_config where key = 'free_publishes';
  if v_free is null then v_free := 3; end if;
  select value::numeric into v_price from public.platform_config where key = 'publish_price';
  if v_price is null then v_price := 100; end if;

  select shop_free_limit into v_free from public.profiles where id = v_seller;
  if v_free is null then
    select value::int into v_free from public.platform_config where key = 'free_publishes';
    if v_free is null then v_free := 3; end if;
  end if;

  select count(*) into v_in_shop
  from public.market_products
  where seller_id = v_seller and status in ('active', 'paused');

  if v_in_shop >= v_free then
    select id, balance into v_wallet, v_balance
    from public.wallets where user_id = v_seller
    for update;
    if not found then
      v_wallet := null;
      v_balance := 0;
    end if;
    if v_balance < v_price then
      raise exception 'Saldo insuficiente para publicar (%s). Cargá saldo en tu billetera.', format('$%s', v_price);
    end if;
    update public.wallets set balance = balance - v_price where id = v_wallet;
    insert into public.wallet_transactions (wallet_id, type, amount, reference, note)
    values (v_wallet, 'publish', -v_price, null, 'Publicación SpotterShop');
  end if;

  insert into public.market_products (
    seller_id, name, description, price, category, condition, stock, status, location, images
  )
  values (
    v_seller, btrim(p_name), nullif(btrim(coalesce(p_description, '')), ''), p_price,
    p_category, coalesce(p_condition, 'new'), greatest(coalesce(p_stock, 1), 1), 'active',
    nullif(btrim(coalesce(p_location, '')), ''), coalesce(p_images, '{}')
  )
  returning id into v_id;

  return v_id;
end;
$$;

-- =====================================================
-- 7) RPC: get_publish_quote (cupo/restantes/precio/saldo)
-- =====================================================

create or replace function public.get_publish_quote()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_free int;
  v_price numeric;
  v_in_shop int;
  v_balance numeric;
begin
  if v_user is null then
    return jsonb_build_object('free_limit', 0, 'free_left', 0, 'price', 0, 'balance', 0, 'in_shop', 0, 'will_pay', false);
  end if;

  select shop_free_limit into v_free from public.profiles where id = v_user;
  if v_free is null then
    select value::int into v_free from public.platform_config where key = 'free_publishes';
  end if;
  if v_free is null then v_free := 3; end if;

  select value::numeric into v_price from public.platform_config where key = 'publish_price';
  if v_price is null then v_price := 100; end if;

  select count(*) into v_in_shop
  from public.market_products where seller_id = v_user and status in ('active', 'paused');

  select coalesce(balance, 0) into v_balance from public.wallets where user_id = v_user;

  return jsonb_build_object(
    'free_limit', v_free,
    'free_left', greatest(v_free - v_in_shop, 0),
    'price', v_price,
    'balance', v_balance,
    'in_shop', v_in_shop,
    'will_pay', v_in_shop >= v_free
  );
end;
$$;

-- =====================================================
-- 8) RPC admin: admin_set_publication_config (valor general)
-- =====================================================

create or replace function public.admin_set_publication_config(
  p_free_count int,
  p_price numeric
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and is_admin = true) then
    raise exception 'No autorizado';
  end if;
  if p_free_count < 0 then
    raise exception 'El cupo gratis no puede ser negativo';
  end if;
  if p_price < 0 then
    raise exception 'El precio no puede ser negativo';
  end if;

  if p_free_count is not null then
    insert into public.platform_config (key, value, updated_at)
    values ('free_publishes', to_jsonb(p_free_count), now())
    on conflict (key) do update set value = to_jsonb(p_free_count), updated_at = now();
  end if;

  if p_price is not null then
    insert into public.platform_config (key, value, updated_at)
    values ('publish_price', to_jsonb(p_price), now())
    on conflict (key) do update set value = to_jsonb(p_price), updated_at = now();
  end if;
end;
$$;

-- =====================================================
-- 9) RPC admin: admin_set_user_free_limit (override individual)
--    p_free_limit NULL -> vuelve a usar el valor general.
--    p_free_limit 0    -> paga desde la primera publicacion.
-- =====================================================

create or replace function public.admin_set_user_free_limit(
  p_user_id uuid,
  p_free_limit int
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and is_admin = true) then
    raise exception 'No autorizado';
  end if;
  if p_free_limit is not null and p_free_limit < 0 then
    raise exception 'El cupo gratis no puede ser negativo';
  end if;

  update public.profiles set shop_free_limit = p_free_limit where id = p_user_id;
  if not found then
    raise exception 'Usuario no encontrado';
  end if;
end;
$$;

-- =====================================================
-- 10) RPC admin: admin_publish_revenue (ingresos por publicaciones)
--     El admin no lee wallet_transactions ajenas por RLS,
--     por eso se agrega como RPC security definer.
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

  select coalesce(sum(abs(amount)), 0), count(*) into v_total, v_count
  from public.wallet_transactions
  where type = 'publish';

  return jsonb_build_object('total', v_total, 'count', v_count);
end;
$$;