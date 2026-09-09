-- ============================================================
-- SpotterX - 00022: unit_grams en foods (peso por unidad)
-- Permite calcular macros para alimentos por unidad
-- (ej: 2 huevos × 50g × base/100). Después de 00021.
-- Ejecutar en SQL Editor.
-- ============================================================

alter table public.foods add column if not exists unit_grams real;

-- Backfill: alimentos por unidad reciben un peso estimado (gramos por 1 unidad)
update public.foods set unit_grams = 50   where lower(name) = 'huevo entero';
update public.foods set unit_grams = 30   where lower(name) = 'clara de huevo';
update public.foods set unit_grams = 120  where lower(name) = 'banana';
update public.foods set unit_grams = 180  where lower(name) = 'manzana';
update public.foods set unit_grams = 130  where lower(name) = 'naranja';
update public.foods set unit_grams = 80   where lower(name) = 'mandarina';
update public.foods set unit_grams = 1300 where lower(name) = 'ananá';
update public.foods set unit_grams = 150  where lower(name) = 'palta';
update public.foods set unit_grams = 8    where lower(name) = 'uva';
update public.foods set unit_grams = 15   where lower(name) = 'frutilla';
update public.foods set unit_grams = 200  where lower(name) = 'sandía';
update public.foods set unit_grams = 150  where lower(name) = 'melón';
update public.foods set unit_grams = 170  where lower(name) = 'pera';
update public.foods set unit_grams = 150  where lower(name) = 'durazno';
update public.foods set unit_grams = 80   where lower(name) = 'kiwi';
update public.foods set unit_grams = 150  where lower(name) = 'papa';
update public.foods set unit_grams = 200  where lower(name) = 'batata';
update public.foods set unit_grams = 250  where lower(name) = 'papa (cocida)';
update public.foods set unit_grams = 40   where lower(name) = 'tortilla';
update public.foods set unit_grams = 30   where lower(name) = 'pan blanco';
update public.foods set unit_grams = 35   where lower(name) = 'pan integral';
update public.foods set unit_grams = 35   where lower(name) = 'pan de salvado';
update public.foods set unit_grams = 250  where lower(name) = 'leche entera';
update public.foods set unit_grams = 125  where lower(name) = 'yogur natural entero';
update public.foods set unit_grams = 125  where lower(name) = 'yogur descremado';
update public.foods set unit_grams = 45   where lower(name) = 'dulce de leche';
update public.foods set unit_grams = 21   where lower(name) = 'miel';