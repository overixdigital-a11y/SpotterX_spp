-- SpotterX - 00027: billetera + admin (wallet, platform_config, is_admin)
-- Ejecutar en SQL Editor después de 00026.

-- =====================================================
-- 1) profiles.is_admin
-- =====================================================

alter table public.profiles add column if not exists is_admin boolean not null default false;

-- =====================================================
-- 2) platform_config (comisión configurable)
-- =====================================================

create table if not exists public.platform_config (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- Insertar comisión inicial (1%)
insert into public.platform_config (key, value)
values ('commission_rate', to_jsonb(0.01))
on conflict (key) do nothing;

-- =====================================================
-- 3) WALLET (monedero)
-- =====================================================

create table if not exists public.wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  balance numeric(10,2) not null default 0 check (balance >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Ledger inmutable (cada movimiento es una fila)
create table if not exists public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  wallet_id uuid not null references public.wallets(id) on delete cascade,
  type text not null check (type in ('credit', 'debit', 'commission', 'withdrawal_request', 'withdrawal_paid', 'refund')),
  amount numeric(10,2) not null,
  reference text,
  note text,
  created_at timestamptz not null default now()
);

-- Índices
create index if not exists idx_wallets_user on public.wallets (user_id);
create index if not exists idx_wallet_tx_wallet on public.wallet_transactions (wallet_id);
create index if not exists idx_wallet_tx_type on public.wallet_transactions (type);
create index if not exists idx_wallet_tx_created on public.wallet_transactions (created_at desc);

-- RLS wallets: solo el dueño ve su saldo
alter table public.wallets enable row level security;
alter table public.wallet_transactions enable row level security;

create policy "Wallets: lectura propia"
  on public.wallets for select
  using (auth.uid() = user_id);

create policy "Wallets: insert propio"
  on public.wallets for insert
  with check (auth.uid() = user_id);

create policy "WalletTx: lectura propia"
  on public.wallet_transactions for select
  using (
    exists (
      select 1 from public.wallets w
      where w.id = wallet_id and w.user_id = auth.uid()
    )
  );

create policy "WalletTx: insert propio"
  on public.wallet_transactions for insert
  with check (
    exists (
      select 1 from public.wallets w
      where w.id = wallet_id and w.user_id = auth.uid()
    )
  );

-- Solo admin puede insertar/actualizar wallets de otros
create policy "Wallets: admin gestiona"
  on public.wallets for all
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_admin = true
    )
  );

create policy "WalletTx: admin inserta"
  on public.wallet_transactions for insert
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_admin = true
    )
  );

-- =====================================================
-- 4) RPC: get_or_create_wallet
-- =====================================================

create or replace function public.get_or_create_wallet()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wallet_id uuid;
  v_user uuid := auth.uid();
begin
  select id into v_wallet_id
  from public.wallets
  where user_id = v_user;

  if not found then
    insert into public.wallets (user_id)
    values (v_user)
    returning id into v_wallet_id;
  end if;

  return v_wallet_id;
end;
$$;

-- =====================================================
-- 5) RPC: buy_from_wallet (checkout con saldo)
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
  -- Obtener orden
  select * into v_order
  from public.market_orders
  where id = p_order_id and buyer_id = v_buyer and status = 'pending'
  for update;

  if not found then
    raise exception 'Orden no encontrada, no es tuya, o no está pendiente';
  end if;

  -- Obtener/crear wallets
  select id into v_buyer_wallet from public.wallets where user_id = v_buyer for update;
  if not found then
    insert into public.wallets (user_id) values (v_buyer) returning id into v_buyer_wallet;
  end if;

  select id into v_seller_wallet from public.wallets where user_id = v_order.seller_id for update;
  if not found then
    insert into public.wallets (user_id) values (v_order.seller_id) returning id into v_seller_wallet;
  end if;

  -- Validar saldo
  if (select balance from public.wallets where id = v_buyer_wallet) < v_order.total then
    raise exception 'Saldo insuficiente. Necesitás $% y tenés $%', v_order.total, (select balance from public.wallets where id = v_buyer_wallet);
  end if;

  -- Descontar al comprador
  update public.wallets set balance = balance - v_order.total where id = v_buyer_wallet;
  insert into public.wallet_transactions (wallet_id, type, amount, reference, note)
  values (v_buyer_wallet, 'debit', -v_order.total, p_order_id::text, 'Compra orden #' || substring(p_order_id::text, 1, 8));

  -- Acreditar al vendedor (total - comisión)
  update public.wallets set balance = balance + (v_order.total - v_order.platform_fee) where id = v_seller_wallet;
  insert into public.wallet_transactions (wallet_id, type, amount, reference, note)
  values (v_seller_wallet, 'credit', v_order.total - v_order.platform_fee, p_order_id::text, 'Venta orden #' || substring(p_order_id::text, 1, 8));

  -- Registrar comisión como movimiento (rastreable)
  insert into public.wallet_transactions (wallet_id, type, amount, reference, note)
  values (v_seller_wallet, 'commission', -v_order.platform_fee, p_order_id::text, 'Comisión SpotterX orden #' || substring(p_order_id::text, 1, 8));

  -- Marcar orden como confirmed
  update public.market_orders set status = 'confirmed' where id = p_order_id;
end;
$$;

-- =====================================================
-- 6) RPC: admin_set_commission (solo admin)
-- =====================================================

create or replace function public.admin_set_commission(
  p_rate numeric
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Validar admin
  if not exists (select 1 from public.profiles where id = auth.uid() and is_admin = true) then
    raise exception 'No autorizado';
  end if;

  if p_rate < 0 or p_rate > 1 then
    raise exception 'La comisión debe estar entre 0 y 1 (ej: 0.01 = 1%%)';
  end if;

  insert into public.platform_config (key, value, updated_at)
  values ('commission_rate', to_jsonb(p_rate), now())
  on conflict (key) do update set value = to_jsonb(p_rate), updated_at = now();
end;
$$;

-- =====================================================
-- 7) RPC: admin_credit_wallet (solo admin)
-- =====================================================

create or replace function public.admin_credit_wallet(
  p_user_id uuid,
  p_amount numeric,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wallet_id uuid;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and is_admin = true) then
    raise exception 'No autorizado';
  end if;

  if p_amount <= 0 then
    raise exception 'El monto debe ser mayor a 0';
  end if;

  select id into v_wallet_id from public.wallets where user_id = p_user_id;
  if not found then
    insert into public.wallets (user_id) values (p_user_id) returning id into v_wallet_id;
  end if;

  update public.wallets set balance = balance + p_amount where id = v_wallet_id;
  insert into public.wallet_transactions (wallet_id, type, amount, reference, note)
  values (v_wallet_id, 'credit', p_amount, null, coalesce(p_note, 'Crédito manual'));
end;
$$;

-- =====================================================
-- 8) RPC: admin_mark_withdrawal_paid (solo admin)
-- =====================================================

create or replace function public.admin_mark_withdrawal_paid(
  p_tx_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tx record;
  v_wallet_id uuid;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and is_admin = true) then
    raise exception 'No autorizado';
  end if;

  select * into v_tx from public.wallet_transactions where id = p_tx_id and type = 'withdrawal_request';
  if not found then
    raise exception 'Solicitud de retiro no encontrada o ya procesada';
  end if;

  -- Marcar como pagado
  insert into public.wallet_transactions (wallet_id, type, amount, reference, note)
  values (v_tx.wallet_id, 'withdrawal_paid', 0, v_tx.id::text, 'Retiro transferido');

  -- Descontar del saldo
  select id into v_wallet_id from public.wallets where id = v_tx.wallet_id;
  update public.wallets set balance = balance - abs(v_tx.amount) where id = v_wallet_id;
end;
$$;

-- =====================================================
-- 9) RPC: request_withdrawal (usuario solicita retiro)
-- =====================================================

create or replace function public.request_withdrawal(
  p_amount numeric
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wallet_id uuid;
  v_balance numeric;
begin
  if p_amount <= 0 then
    raise exception 'El monto debe ser mayor a 0';
  end if;

  select id, balance into v_wallet_id, v_balance
  from public.wallets
  where user_id = auth.uid()
  for update;

  if not found then
    raise exception 'No tenés billetera';
  end if;

  if v_balance < p_amount then
    raise exception 'Saldo insuficiente para retiro';
  end if;

  insert into public.wallet_transactions (wallet_id, type, amount, reference, note)
  values (v_wallet_id, 'withdrawal_request', -p_amount, null, 'Retiro solicitado por $' || p_amount::text);
end;
$$;

-- =====================================================
-- 10) Función para obtener wallet del usuario actual
-- =====================================================

create or replace function public.get_my_wallet()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wallet record;
  v_tx_count bigint;
begin
  select id, balance into v_wallet
  from public.wallets
  where user_id = auth.uid();

  if not found then
    return jsonb_build_object('balance', 0, 'tx_count', 0, 'wallet_id', null);
  end if;

  select count(*) into v_tx_count
  from public.wallet_transactions
  where wallet_id = v_wallet.id;

  return jsonb_build_object(
    'balance', v_wallet.balance,
    'tx_count', v_tx_count,
    'wallet_id', v_wallet.id
  );
end;
$$;
