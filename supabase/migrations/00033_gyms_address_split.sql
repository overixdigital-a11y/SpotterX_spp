-- 00033: Direccion dividida en campos estructurados (gyms + trainer_gyms)
-- calle, altura, codigo postal, provincia. Se conservan `address`/`city` para compat.

alter table public.gyms
  add column if not exists street text,
  add column if not exists street_number text,
  add column if not exists postal_code text,
  add column if not exists province text;

alter table public.trainer_gyms
  add column if not exists street text,
  add column if not exists street_number text,
  add column if not exists postal_code text,
  add column if not exists province text;