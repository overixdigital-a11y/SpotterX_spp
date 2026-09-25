-- SpotterX - 00037: RPC admin_pending_withdrawals
-- El admin NO lee wallet_transactions ajenas por RLS (solo lectura propia),
-- por eso la lista de retiros pendientes sale por RPC security definer
-- (mismo patron que admin_publish_revenue de 00036).
-- Ejecutar en SQL Editor.

create or replace function public.admin_pending_withdrawals()
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
      tx.id,
      tx.wallet_id,
      tx.amount,
      tx.created_at,
      w.user_id,
      p.email,
      p.username,
      p.full_name
    from public.wallet_transactions tx
    join public.wallets w on w.id = tx.wallet_id
    join public.profiles p on p.id = w.user_id
    where tx.type = 'withdrawal_request'
      and not exists (
        select 1 from public.wallet_transactions paid
        where paid.type = 'withdrawal_paid' and paid.reference = tx.id::text
      )
    order by tx.created_at desc
    limit 100
  ) t;

  return v_data;
end;
$$;