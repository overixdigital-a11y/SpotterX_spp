-- SpotterX - 00038: config de cobro + registro de depositos publicaciones
-- Pago de publicaciones por transferencia (cuentas del admin) + depositos
-- avisados por el publicador con registro automatico + notificacion in-app.
-- Correr en SQL Editor.

-- =====================================================
-- 1) Defaults en platform_config (carrito oculto por defecto)
-- =====================================================

insert into public.platform_config (key, value)
values
  ('allow_cart', 'false'),
  ('payment_accounts', '[]'),
  ('admin_contact', '{}')
on conflict (key) do nothing;

-- =====================================================
-- 2) publish_deposits (registro de depositos con datos de respaldo)
-- =====================================================

create table if not exists public.publish_deposits (
  id uuid primary key default gen_random_uuid(),
  pedido text not null unique,
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount numeric(10,2) not null check (amount > 0),
  status text not null default 'pendiente' check (status in ('pendiente', 'acreditado')),
  note text,
  created_at timestamptz not null default now(),
  acredited_at timestamptz
);

create index if not exists idx_publish_deposits_user on public.publish_deposits (user_id);
create index if not exists idx_publish_deposits_status on public.publish_deposits (status);

alter table public.publish_deposits enable row level security;

-- El publicador ve sus propios depositos (historial con estado)
create policy "Depositos: el publicador ve los suyos"
  on public.publish_deposits for select
  using (auth.uid() = user_id);

-- =====================================================
-- 3) RPC: report_deposit (el publicador avisa su transferencia)
--    Guarda el deposito + notifica al admin + devuelve el pedido.
-- =====================================================

create or replace function public.report_deposit(
  p_amount numeric,
  p_note text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pedido text;
  v_user uuid := auth.uid();
  v_admin uuid;
begin
  if v_user is null then
    raise exception 'No autenticado';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Monto invalido';
  end if;

  v_pedido := 'SP-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(md5(random()::text), 1, 4));

  insert into public.publish_deposits (pedido, user_id, amount, note)
  values (v_pedido, v_user, p_amount, p_note);

  select id into v_admin
  from public.profiles
  where is_admin = true
  order by created_at
  limit 1;

  if v_admin is not null then
    insert into public.notifications (user_id, actor_id, type, ref_id, message)
    values (v_admin, v_user, 'pago_publicacion', v_user, 'Deposito ' || v_pedido || ' por $' || p_amount::text);
  end if;

  return v_pedido;
end;
$$;

-- =====================================================
-- 4) RPC: admin_list_deposits (registro de depositos en el panel admin)
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
      p.username,
      p.full_name,
      p.email
    from public.publish_deposits d
    join public.profiles p on p.id = d.user_id
    where d.status = p_status
    order by d.created_at desc
    limit 100
  ) t;

  return v_data;
end;
$$;

-- =====================================================
-- 5) RPC: admin_approve_deposit (verifico el deposito y acredito saldo)
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
  v_wallet uuid;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and is_admin = true) then
    raise exception 'No autorizado';
  end if;

  select * into v_dep
  from public.publish_deposits
  where id = p_deposit_id and status = 'pendiente';

  if not found then
    raise exception 'Deposito no encontrado o ya acreditado';
  end if;

  select id into v_wallet from public.wallets where user_id = v_dep.user_id;
  if not found then
    insert into public.wallets (user_id) values (v_dep.user_id) returning id into v_wallet;
  end if;

  update public.wallets set balance = balance + v_dep.amount where id = v_wallet;

  insert into public.wallet_transactions (wallet_id, type, amount, reference, note)
  values (v_wallet, 'credit', v_dep.amount, v_dep.pedido, 'Deposito ' || v_dep.pedido);

  update public.publish_deposits
  set status = 'acreditado', acredited_at = now()
  where id = p_deposit_id;
end;
$$;

-- =====================================================
-- 6) RPC: admin_set_payment_config (cuentas / carrito / contacto)
--    (NULL en un parametro = no tocar esa key)
-- =====================================================

create or replace function public.admin_set_payment_config(
  p_accounts jsonb default null,
  p_allow_cart boolean default null,
  p_contact jsonb default null
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

  if p_accounts is not null then
    insert into public.platform_config (key, value, updated_at)
    values ('payment_accounts', p_accounts, now())
    on conflict (key) do update set value = excluded.value, updated_at = now();
  end if;

  if p_allow_cart is not null then
    insert into public.platform_config (key, value, updated_at)
    values ('allow_cart', to_jsonb(p_allow_cart), now())
    on conflict (key) do update set value = excluded.value, updated_at = now();
  end if;

  if p_contact is not null then
    insert into public.platform_config (key, value, updated_at)
    values ('admin_contact', p_contact, now())
    on conflict (key) do update set value = excluded.value, updated_at = now();
  end if;
end;
$$;

-- =====================================================
-- 7) Constraint notifications: lista ACUMULATIVA completa + 'pago_publicacion'
--    (leccion 00035: re-crear SIEMPRE con todos los tipos existentes)
-- =====================================================

alter table public.notifications drop constraint if exists notifications_type_check;

alter table public.notifications add constraint notifications_type_check
  check (type in ('pulse', 'comment', 'follow', 'message', 'checkin', 'vencimiento',
    'solicitud_staff', 'staff_aprobado', 'orden', 'pago_publicacion'));