-- SpotterX - 00026: Marketplace (productos, órdenes, reseñas, RPC checkout, realtime)
-- Ejecutar en SQL Editor.

-- =====================================================
-- 1) TABLAS
-- =====================================================

-- Productos
create table if not exists public.market_products (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  description text,
  price numeric(10,2) not null check (price >= 0),
  images text[] not null default '{}',
  category text not null,
  condition text not null default 'new' check (condition in ('new', 'used')),
  stock integer not null default 1 check (stock >= 0),
  status text not null default 'active' check (status in ('active', 'sold', 'paused')),
  location text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Órdenes
create table if not exists public.market_orders (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references public.profiles(id) on delete cascade,
  seller_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'delivered', 'cancelled')),
  total numeric(10,2) not null,
  platform_fee numeric(10,2) not null default 0,
  delivery_type text not null default 'retiro' check (delivery_type in ('retiro', 'envio')),
  address text,
  notes text,
  created_at timestamptz not null default now()
);

-- Items de orden
create table if not exists public.market_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.market_orders(id) on delete cascade,
  product_id uuid not null references public.market_products(id),
  quantity integer not null default 1 check (quantity > 0),
  price numeric(10,2) not null
);

-- Reseñas (unique por producto+usuario)
create table if not exists public.market_reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.market_products(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  rating integer not null check (rating >= 1 AND rating <= 5),
  comment text,
  created_at timestamptz not null default now(),
  unique (product_id, user_id)
);

-- =====================================================
-- 2) RLS
-- =====================================================

alter table public.market_products enable row level security;
alter table public.market_orders enable row level security;
alter table public.market_order_items enable row level security;
alter table public.market_reviews enable row level security;

-- Products: lectura autenticada, gestión del dueño
create policy "MarketProducts: lectura"
  on public.market_products for select
  using (auth.role() = 'authenticated');

create policy "MarketProducts: insert propio"
  on public.market_products for insert
  with check (auth.uid() = seller_id);

create policy "MarketProducts: update propio"
  on public.market_products for update
  using (auth.uid() = seller_id);

create policy "MarketProducts: delete propio"
  on public.market_products for delete
  using (auth.uid() = seller_id);

-- Orders: solo buyer/seller ven sus órdenes; el buyer puede insertar (vía RPC, pero cubrimos por si acaso)
create policy "MarketOrders: lectura involucrados"
  on public.market_orders for select
  using (auth.uid() in (buyer_id, seller_id));

create policy "MarketOrders: insert buyer"
  on public.market_orders for insert
  with check (auth.uid() = buyer_id);

create policy "MarketOrders: update seller"
  on public.market_orders for update
  using (auth.uid() = seller_id);

create policy "MarketOrders: cancel buyer"
  on public.market_orders for update
  using (auth.uid() = buyer_id AND status = 'pending');

-- Order items: si podés ver la orden, podés ver sus items
create policy "MarketOrderItems: lectura involucrados"
  on public.market_order_items for select
  using (
    exists (
      select 1 from public.market_orders o
      where o.id = order_id
        and auth.uid() in (o.buyer_id, o.seller_id)
    )
  );

-- Reviews: lectura autenticada; insert own; delete own
create policy "MarketReviews: lectura"
  on public.market_reviews for select
  using (auth.role() = 'authenticated');

create policy "MarketReviews: insert propio"
  on public.market_reviews for insert
  with check (auth.uid() = user_id);

create policy "MarketReviews: delete propio"
  on public.market_reviews for delete
  using (auth.uid() = user_id);

-- =====================================================
-- 3) ÍNDICES
-- =====================================================

create index if not exists idx_market_products_seller on public.market_products (seller_id);
create index if not exists idx_market_products_category on public.market_products (category);
create index if not exists idx_market_products_created on public.market_products (created_at desc);
create index if not exists idx_market_orders_buyer on public.market_orders (buyer_id);
create index if not exists idx_market_orders_seller on public.market_orders (seller_id);
create index if not exists idx_market_order_items_order on public.market_order_items (order_id);
create index if not exists idx_market_reviews_product on public.market_reviews (product_id);

-- =====================================================
-- 4) REALTIME
-- =====================================================

alter publication supabase_realtime add table public.market_products;
alter publication supabase_realtime add table public.market_orders;
alter publication supabase_realtime add table public.market_reviews;

-- =====================================================
-- 5) TRIGGER updated_at
-- =====================================================

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_market_products_updated on public.market_products;
create trigger trg_market_products_updated
  before update on public.market_products
  for each row execute function public.touch_updated_at();

-- =====================================================
-- 6) TRIGGER NOTIFICACIÓN ORDEN
-- =====================================================

create or replace function public.notify_market_order()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (user_id, actor_id, type, ref_id, message)
  values (
    NEW.seller_id,
    NEW.buyer_id,
    'orden',
    NEW.id,
    'Nueva orden #' || substring(NEW.id::text, 1, 8) || ' — $' || NEW.total::text
  );
  return NEW;
end;
$$;

drop trigger if exists trg_notify_market_order on public.market_orders;
create trigger trg_notify_market_order
  after insert on public.market_orders
  for each row execute function public.notify_market_order();

-- =====================================================
-- 7) RPC: market_checkout (transacción atómica)
-- =====================================================

create or replace function public.market_checkout(
  p_items jsonb,         -- [{ "product_id": "...", "quantity": 1 }]
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
  v_fee_rate numeric;
  v_fee numeric;
  v_order_id uuid;
  v_item jsonb;
  v_product record;
begin
  -- Validar buyer
  if v_buyer is null then
    raise exception 'No autenticado';
  end if;

  -- Obtener tasa de comisión
  select (value)::numeric into v_fee_rate
  from public.platform_config
  where key = 'commission_rate';

  if v_fee_rate is null then v_fee_rate := 0.01; end if;

  -- Validar items y calcular total
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

    -- Todos los items deben ser del mismo vendedor
    if v_seller is null then
      v_seller := v_product.seller_id;
    elsif v_seller != v_product.seller_id then
      raise exception 'No se pueden mezclar productos de distintos vendedores en una orden';
    end if;

    -- No puede comprar自己的 productos
    if v_seller = v_buyer then
      raise exception 'No podés comprar tu propio producto';
    end if;

    v_total := v_total + (v_item->>'quantity')::int * v_product.price;
  end loop;

  -- Calcular comisión
  v_fee := round(v_total * v_fee_rate, 2);

  -- Crear orden
  insert into public.market_orders (buyer_id, seller_id, total, platform_fee, delivery_type, address, notes)
  values (v_buyer, v_seller, v_total, v_fee, p_delivery, p_address, p_notes)
  returning id into v_order_id;

  -- Insertar items y descontar stock
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
-- 8) Habilitar tipo 'orden' en notifications
-- =====================================================

alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check check (
    type in ('pulse', 'comment', 'follow', 'message', 'checkin', 'vencimiento', 'solicitud_staff', 'staff_aprobado', 'orden')
  );
