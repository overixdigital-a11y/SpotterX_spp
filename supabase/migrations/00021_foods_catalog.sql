-- ============================================================
-- SpotterX - 00021: Catálogo de alimentos con macros por 100g.
-- Alimentos para dietas (trainer_plan_items.data).
-- 100% opcional: si la tabla no existe, el form de dieta anda
-- igual (input simple). Después de 00020. Ejecutar en SQL Editor.
-- ============================================================

create table if not exists public.foods (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null default 'Otros',
  kcal real not null default 0,
  protein_g real not null default 0,
  fat_g real not null default 0,
  carbs_g real not null default 0,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create unique index if not exists foods_name_unique on public.foods (lower(name));

alter table public.foods enable row level security;

drop policy if exists "Foods: lectura pública" on public.foods;
create policy "Foods: lectura pública"
  on public.foods for select
  using (true);

drop policy if exists "Foods: autenticados agregan" on public.foods;
create policy "Foods: autenticados agregan"
  on public.foods for insert
  with check (auth.uid() is not null);

alter publication supabase_realtime add table public.foods;

-- ============================================================
-- Seed de alimentos comunes (valores por 100 g)
-- ============================================================
insert into public.foods (name, category, kcal, protein_g, fat_g, carbs_g) values
  -- Proteínas
  ('Pechuga de pollo', 'Proteínas', 165, 31, 3.6, 0),
  ('Pata y muslo de pollo', 'Proteínas', 184, 26, 8, 0),
  ('Carne vacuna magra', 'Proteínas', 250, 26, 15, 0),
  ('Carne picada 5%', 'Proteínas', 137, 20, 6, 0),
  ('Bife de chorizo', 'Proteínas', 294, 26, 21, 0),
  ('Hígado vacuno', 'Proteínas', 135, 20, 4, 4),
  ('Cerdo (lomo)', 'Proteínas', 242, 27, 14, 0),
  ('Atún al natural', 'Proteínas', 116, 25, 1, 0),
  ('Salmón', 'Proteínas', 208, 20, 13, 0),
  ('Merluza', 'Proteínas', 90, 18, 1, 0),
  ('Langostinos', 'Proteínas', 99, 24, 0.3, 0),
  ('Huevo entero', 'Proteínas', 155, 13, 11, 1.1),
  ('Clara de huevo', 'Proteínas', 52, 11, 0.2, 0.7),
  ('Tofu', 'Proteínas', 76, 8, 4.8, 1.9),
  ('Whey protein', 'Proteínas', 400, 80, 6, 8),
  -- Carbohidratos y cereales
  ('Avena', 'Carbohidratos', 389, 17, 7, 66),
  ('Arroz blanco (crudo)', 'Carbohidratos', 365, 7, 0.7, 80),
  ('Arroz integral (crudo)', 'Carbohidratos', 350, 7.5, 2.5, 72),
  ('Fideos (pasta seca)', 'Carbohidratos', 371, 13, 1.5, 75),
  ('Fideos integrales (secos)', 'Carbohidratos', 365, 14, 3, 65),
  ('Pan blanco', 'Carbohidratos', 265, 9, 3.2, 49),
  ('Pan integral', 'Carbohidratos', 247, 13, 3.4, 41),
  ('Pan de salvado', 'Carbohidratos', 240, 11, 3.5, 42),
  ('Papa', 'Carbohidratos', 77, 2, 0.1, 17),
  ('Batata', 'Carbohidratos', 86, 1.6, 0.1, 20),
  ('Mandioca', 'Carbohidratos', 160, 1.4, 0.3, 38),
  ('Quinoa (cruda)', 'Carbohidratos', 368, 14, 6, 64),
  ('Harina de trigo', 'Carbohidratos', 364, 10, 1, 76),
  ('Cebada perlada', 'Carbohidratos', 355, 10, 1.6, 78),
  -- Legumbres (cocidas)
  ('Lentejas cocidas', 'Carbohidratos', 116, 9, 0.4, 20),
  ('Garbanzos cocidos', 'Carbohidratos', 164, 9, 2.6, 27),
  ('Porotos negros cocidos', 'Carbohidratos', 132, 9, 0.5, 24),
  ('Arvejas cocidas', 'Carbohidratos', 81, 5.4, 0.4, 14),
  -- Lácteos
  ('Leche entera', 'Lácteos', 61, 3.2, 3.3, 4.8),
  ('Leche descremada', 'Lácteos', 35, 3.4, 0.1, 5),
  ('Yogur natural entero', 'Lácteos', 63, 5.3, 3.2, 3.9),
  ('Yogur descremado', 'Lácteos', 55, 9, 0.2, 5),
  ('Queso cremoso', 'Lácteos', 253, 24, 19, 1),
  ('Queso muzzarella', 'Lácteos', 280, 22, 21, 2),
  ('Queso de máquina', 'Lácteos', 350, 25, 27, 2),
  ('Ricota', 'Lácteos', 174, 11, 13, 3),
  ('Queso untable descremado', 'Lácteos', 130, 12, 7, 5),
  ('Ralladura de parmesano', 'Lácteos', 431, 38, 29, 4),
  -- Frutas
  ('Banana', 'Frutas', 89, 1.1, 0.3, 23),
  ('Manzana', 'Frutas', 52, 0.3, 0.2, 14),
  ('Naranja', 'Frutas', 47, 0.9, 0.1, 12),
  ('Mandarina', 'Frutas', 53, 0.8, 0.3, 13),
  ('Ananá', 'Frutas', 50, 0.5, 0.1, 13),
  ('Palta', 'Frutas', 160, 2, 15, 9),
  ('Uva', 'Frutas', 69, 0.7, 0.2, 18),
  ('Frutilla', 'Frutas', 32, 0.7, 0.3, 7.7),
  ('Arándanos', 'Frutas', 57, 0.7, 0.3, 14),
  ('Sandía', 'Frutas', 30, 0.6, 0.2, 8),
  ('Melón', 'Frutas', 34, 0.8, 0.2, 8),
  ('Pera', 'Frutas', 57, 0.4, 0.1, 15),
  ('Durazno', 'Frutas', 39, 0.9, 0.3, 10),
  ('Kiwi', 'Frutas', 61, 1.1, 0.5, 15),
  -- Verduras
  ('Tomate', 'Verduras', 18, 0.9, 0.2, 3.9),
  ('Lechuga', 'Verduras', 15, 1.4, 0.2, 2.9),
  ('Rúcula', 'Verduras', 25, 2.6, 0.7, 3.7),
  ('Espinaca', 'Verduras', 23, 2.9, 0.4, 3.6),
  ('Acelga', 'Verduras', 19, 1.8, 0.2, 3.7),
  ('Brócoli', 'Verduras', 34, 2.8, 0.4, 7),
  ('Zanahoria', 'Verduras', 41, 0.9, 0.2, 10),
  ('Cebolla', 'Verduras', 40, 1.1, 0.1, 9),
  ('Pimiento', 'Verduras', 31, 1, 0.3, 6),
  ('Zapallito', 'Verduras', 16, 1.7, 0.2, 2.4),
  ('Zapallo', 'Verduras', 26, 1, 0.1, 6),
  ('Choclo', 'Verduras', 96, 3.4, 1.5, 21),
  ('Champiñones', 'Verduras', 22, 3.1, 0.3, 3.3),
  -- Grasas y frutos secos
  ('Aceite de oliva', 'Grasas y frutos secos', 884, 0, 100, 0),
  ('Aceite de girasol', 'Grasas y frutos secos', 884, 0, 100, 0),
  ('Manteca', 'Grasas y frutos secos', 717, 0.9, 81, 0.1),
  ('Crema de leche', 'Grasas y frutos secos', 340, 2.4, 35, 3),
  ('Maní tostado', 'Grasas y frutos secos', 567, 26, 49, 16),
  ('Manteca de maní', 'Grasas y frutos secos', 588, 25, 50, 20),
  ('Almendras', 'Grasas y frutos secos', 579, 21, 50, 22),
  ('Nueces', 'Grasas y frutos secos', 654, 15, 65, 14),
  ('Semillas de chía', 'Grasas y frutos secos', 486, 17, 31, 42),
  ('Semillas de girasol', 'Grasas y frutos secos', 584, 21, 51, 20),
  ('Semillas de lino', 'Grasas y frutos secos', 534, 18, 42, 29),
  -- Otros / dulces
  ('Dulce de leche', 'Otros', 315, 6, 8, 56),
  ('Miel', 'Otros', 304, 0.3, 0, 82),
  ('Azúcar', 'Otros', 400, 0, 0, 100),
  ('Cacao en polvo', 'Otros', 228, 19.6, 14, 58),
  ('Edulcorante', 'Otros', 0, 0, 0, 0),
  ('Sal', 'Otros', 0, 0, 0, 0);