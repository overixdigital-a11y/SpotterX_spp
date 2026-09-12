-- =====================================================
-- SpotterX - 00028: admin panel (moderación + ban + stats)
-- =====================================================

-- 1) Columna is_banned en profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_banned boolean not null default false;

-- 2) Columna status + resolved_by en post_reports
ALTER TABLE public.post_reports
  ADD COLUMN IF NOT EXISTS status text not null default 'pending'
    check (status in ('pending', 'resolved', 'dismissed')),
  ADD COLUMN IF NOT EXISTS resolved_by uuid references public.profiles(id);

-- =====================================================
-- 3) RPCs admin (security definer con guard is_admin)
-- =====================================================

-- Helper: verificar is_admin (reutilizable)
CREATE OR REPLACE FUNCTION public._assert_admin()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and is_admin = true) then
    raise exception 'No autorizado';
  end if;
end;
$$;

-- 3a) KPIs globales
CREATE OR REPLACE FUNCTION public.admin_global_stats()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
  v_users_total int;
  v_users_alumno int;
  v_users_profesor int;
  v_users_gym int;
  v_gyms_total int;
  v_trainers int;
  v_students_active int;
  v_posts_total int;
  v_orders_total int;
  v_orders_month int;
  v_sales_month numeric;
  v_commission_month numeric;
begin
  perform public._assert_admin();

  select count(*) into v_users_total from public.profiles;
  select count(*) into v_users_alumno from public.profiles where role = 'alumno';
  select count(*) into v_users_profesor from public.profiles where role = 'profesor';
  select count(*) into v_users_gym from public.profiles where role = 'gym';
  select count(*) into v_gyms_total from public.gyms;
  select count(*) into v_trainers from public.gym_staff where role = 'profesor_invitado' and authorized = true;
  select count(*) into v_students_active from public.trainer_students where active = true;
  select count(*) into v_posts_total from public.posts;
  select count(*) into v_orders_total from public.market_orders;
  select count(*) into v_orders_month from public.market_orders
    where created_at >= date_trunc('month', now());
  select coalesce(sum(total), 0) into v_sales_month from public.market_orders
    where created_at >= date_trunc('month', now());
  select coalesce(sum(platform_fee), 0) into v_commission_month from public.market_orders
    where created_at >= date_trunc('month', now());

  result := jsonb_build_object(
    'users_total', v_users_total,
    'users_alumno', v_users_alumno,
    'users_profesor', v_users_profesor,
    'users_gym', v_users_gym,
    'gyms_total', v_gyms_total,
    'trainers', v_trainers,
    'students_active', v_students_active,
    'posts_total', v_posts_total,
    'orders_total', v_orders_total,
    'orders_month', v_orders_month,
    'sales_month', v_sales_month,
    'commission_month', v_commission_month
  );
  return result;
end;
$$;

-- 3b) Toggle verify
CREATE OR REPLACE FUNCTION public.admin_set_verified(
  p_user_id uuid,
  p_verified boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public._assert_admin();
  update public.profiles set is_verified = p_verified where id = p_user_id;
end;
$$;

-- 3c) Toggle ban
CREATE OR REPLACE FUNCTION public.admin_toggle_ban(
  p_user_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  new_val boolean;
begin
  perform public._assert_admin();
  update public.profiles set is_banned = not is_banned where id = p_user_id
    returning is_banned into new_val;
  return new_val;
end;
$$;

-- 3d) Delete post (admin)
CREATE OR REPLACE FUNCTION public.admin_delete_post(
  p_post_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public._assert_admin();
  delete from public.posts where id = p_post_id;
end;
$$;

-- 3e) Resolve report
CREATE OR REPLACE FUNCTION public.admin_resolve_report(
  p_report_id uuid,
  p_status text default 'resolved'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public._assert_admin();
  update public.post_reports
    set status = p_status, resolved_by = auth.uid(), created_at = created_at
    where id = p_report_id;
end;
$$;

-- 3f) List pending reports with post info
CREATE OR REPLACE FUNCTION public.admin_list_reports()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  perform public._assert_admin();

  select jsonb_agg(jsonb_build_object(
    'id', pr.id,
    'reason', pr.reason,
    'status', pr.status,
    'created_at', pr.created_at,
    'reporter', jsonb_build_object('id', p.id, 'username', p.username, 'full_name', p.full_name),
    'post', jsonb_build_object('id', po.id, 'caption', po.caption, 'media_url', po.media_url, 'user_id', po.user_id, 'created_at', po.created_at)
  ))
  into result
  from public.post_reports pr
  left join public.profiles p on p.id = pr.user_id
  left join public.posts po on po.id = pr.post_id
  where pr.status = 'pending'
  order by pr.created_at desc;

  return coalesce(result, '[]'::jsonb);
end;
$$;

-- 3g) Delete exercise (admin)
CREATE OR REPLACE FUNCTION public.admin_delete_exercise(
  p_exercise_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public._assert_admin();
  delete from public.exercises where id = p_exercise_id;
end;
$$;

-- 3h) Delete food (admin)
CREATE OR REPLACE FUNCTION public.admin_delete_food(
  p_food_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public._assert_admin();
  delete from public.foods where id = p_food_id;
end;
$$;
