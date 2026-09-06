-- ============================================================
-- SpotterX - Etapa 2: perfil de usuario completo
-- Ejecutar en SQL Editor de Supabase (despues de 00009)
-- ============================================================

-- 1) profiles: columnas extra para el perfil completo
alter table public.profiles
  add column if not exists birth_date date,
  add column if not exists phone text,
  add column if not exists website text,
  add column if not exists social_links jsonb not null default '{}'::jsonb,
  add column if not exists is_verified boolean not null default false,
  add column if not exists privacy text not null default 'publico'
    check (privacy in ('publico', 'solo_seguidores')),
  add column if not exists settings jsonb not null default '{}'::jsonb,
  add column if not exists updated_at timestamptz not null default now();

-- updated_at automático
create or replace function public.touch_profile()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
drop trigger if exists trg_touch_profile on public.profiles;
create trigger trg_touch_profile before update on public.profiles
  for each row execute procedure public.touch_profile();

-- 2) Notificación por mensaje directo (type = 'message' ya está en el check)
create or replace function public.notify_message()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.notifications (user_id, actor_id, type)
  select new.recipient_id, new.sender_id, 'message'
  where new.recipient_id <> new.sender_id;
  return new;
end;
$$;
drop trigger if exists trg_notify_message on public.messages;
create trigger trg_notify_message after insert on public.messages
  for each row execute procedure public.notify_message();

-- 3) Índices para stats y listas de seguidores
create index if not exists idx_follows_follower on public.follows (follower_id);
create index if not exists idx_follows_following_u on public.follows (following_id);
create index if not exists idx_messages_recipient on public.messages (recipient_id, created_at desc);