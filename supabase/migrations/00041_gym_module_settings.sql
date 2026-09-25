-- Lote 33: modulos habilitables/deshabilitables por gym desde /admin/gyms
-- Ausencia de registro = modulo habilitado (default).
create table if not exists public.gym_module_settings (
  gym_id uuid not null references public.gyms(id) on delete cascade,
  module text not null check (module in ('feed','spotter_shop','entrenamiento','catalogo')),
  enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (gym_id, module)
);

alter table public.gym_module_settings enable row level security;

-- Lectura publica (la app necesita gatear la UI con el estado).
create policy "GMS: lectura publica" on public.gym_module_settings
  for select using (true);

-- Escritura SOLO via RPC security definer (sin policies insert/update/delete).

create or replace function public.admin_set_gym_module(
  p_gym_id uuid,
  p_module text,
  p_enabled boolean
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and is_admin = true) then
    raise exception 'No autorizado';
  end if;
  if p_module not in ('feed','spotter_shop','entrenamiento','catalogo') then
    raise exception 'Modulo invalido';
  end if;
  insert into public.gym_module_settings (gym_id, module, enabled, updated_at)
  values (p_gym_id, p_module, p_enabled, now())
  on conflict (gym_id, module) do update set enabled = excluded.enabled, updated_at = now();
end;
$$;