-- ============================================================
-- SpotterX - Pulido red social (Etapa 1 del plan maestro)
-- Ejecutar en SQL Editor de Supabase (despues de 00008)
-- ============================================================

-- 1) post_comments: respuestas anidadas
alter table public.post_comments add column if not exists parent_id uuid
  references public.post_comments (id) on delete cascade;

-- 2) Tablas nuevas: guardados y reportes
create table if not exists public.post_saves (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (post_id, user_id)
);

create table if not exists public.post_reports (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  reason text,
  created_at timestamptz not null default now(),
  unique (post_id, user_id)
);

alter table public.post_saves enable row level security;
alter table public.post_reports enable row level security;

create policy "Saves: lectura" on public.post_saves for select using (true);
create policy "Saves: gestión propia" on public.post_saves
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Reports: lectura" on public.post_reports for select using (true);
create policy "Reports: creación propia" on public.post_reports
  for insert with check (auth.uid() = user_id);

-- 3) RLS que faltaban para editar/borrar contenido propio
create policy "Posts: edición propia" on public.posts
  for update using (auth.uid() = user_id);
create policy "Posts: borrado propio" on public.posts
  for delete using (auth.uid() = user_id);

create policy "Comments: edición propia" on public.post_comments
  for update using (auth.uid() = user_id);
create policy "Comments: borrado propio" on public.post_comments
  for delete using (auth.uid() = user_id);

create policy "Notifs: marcar leídas" on public.notifications
  for update using (auth.uid() = user_id);
create policy "Notifs: borrar propias" on public.notifications
  for delete using (auth.uid() = user_id);

-- 4) Storage: policies del bucket media (posts en <uid>/ y avatares en avatars/<uid>/)
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;

drop policy if exists "Media: lectura pública" on storage.objects;
create policy "Media: lectura pública"
  on storage.objects for select using (bucket_id = 'media');

drop policy if exists "Media: subida propia" on storage.objects;
create policy "Media: subida propia"
  on storage.objects for insert with check (
    bucket_id = 'media'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or (
        (storage.foldername(name))[1] = 'avatars'
        and (storage.foldername(name))[2] = auth.uid()::text
      )
    )
  );

drop policy if exists "Media: actualización propia" on storage.objects;
create policy "Media: actualización propia"
  on storage.objects for update using (
    bucket_id = 'media'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or (
        (storage.foldername(name))[1] = 'avatars'
        and (storage.foldername(name))[2] = auth.uid()::text
      )
    )
  );

drop policy if exists "Media: borrado propio" on storage.objects;
create policy "Media: borrado propio"
  on storage.objects for delete using (
    bucket_id = 'media'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or (
        (storage.foldername(name))[1] = 'avatars'
        and (storage.foldername(name))[2] = auth.uid()::text
      )
    )
  );

-- 5) Realtime: red social en vivo (publicaciones, pulses, comentarios, follows)
do $$
begin
  begin
    alter publication supabase_realtime add table public.posts;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.post_pulses;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.post_comments;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.follows;
  exception when duplicate_object then null;
  end;
end;
$$;

-- 6) Índices para conteos, feed y filtros
create index if not exists idx_posts_created on public.posts (created_at desc);
create index if not exists idx_posts_category on public.posts (category);
create index if not exists idx_pulses_post on public.post_pulses (post_id);
create index if not exists idx_comments_post on public.post_comments (post_id);
create index if not exists idx_follows_following on public.follows (following_id);
create index if not exists idx_notifs_read on public.notifications (user_id, read);