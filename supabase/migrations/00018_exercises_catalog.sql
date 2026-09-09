-- ============================================================
-- SpotterX - 00018: Catálogo global de ejercicios.
-- Biblioteca compartida entre profes + biblioteca inicial.
-- Ejecutar en SQL Editor de Supabase (despues de 00017)
-- ============================================================

create table if not exists public.exercises (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  discipline text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create unique index if not exists exercises_name_unique on public.exercises (lower(name));

alter table public.exercises enable row level security;

create policy "Exercises: lectura todos" on public.exercises
  for select using (true);
create policy "Exercises: todos pueden agregar" on public.exercises
  for insert with check (auth.uid() = created_by);

-- Realtime
do $$
begin
  begin
    alter publication supabase_realtime add table public.exercises;
  exception when duplicate_object then null;
  end;
end;
$$;

-- ─── Bibliotecas inicial ───
insert into public.exercises (name, discipline) values
('Press de banca', 'musculacion'),
('Press inclinado con mancuernas', 'musculacion'),
('Press de hombros', 'musculacion'),
('Press militar', 'musculacion'),
('Press francés', 'musculacion'),
('Sentadilla', 'musculacion'),
('Sentadilla frontal', 'musculacion'),
('Sentadilla búlgara', 'musculacion'),
('Peso muerto', 'musculacion'),
('Peso muerto rumano', 'musculacion'),
('Remo con barra', 'musculacion'),
('Remo con mancuerna', 'musculacion'),
('Remo en polea baja', 'musculacion'),
('Jalón al pecho', 'musculacion'),
('Dominadas', 'musculacion'),
('Dominadas lastradas', 'musculacion'),
('Curl de bíceps con barra', 'musculacion'),
('Curl de bíceps con mancuerna', 'musculacion'),
('Curl martillo', 'musculacion'),
('Extensiones de tríceps en polea', 'musculacion'),
('Aperturas con mancuernas', 'musculacion'),
('Elevaciones laterales', 'musculacion'),
('Pájaros (vuelos inversos)', 'musculacion'),
('Hip thrust', 'musculacion'),
('Prensa de piernas', 'musculacion'),
('Extensiones de cuádriceps', 'musculacion'),
('Curl de femoral en máquina', 'musculacion'),
('Peso muerto sumo', 'musculacion'),
('Zancadas', 'musculacion'),
('Zancadas con mancuernas', 'musculacion'),
('Elevación de pantorrillas', 'musculacion'),
('Crunch abdominal', 'musculacion'),
('Plancha abdominal', 'musculacion'),
('Russian twist', 'musculacion'),
('Ab wheel', 'musculacion'),
('Thruster', 'crossfit'),
('Clean', 'crossfit'),
('Snatch', 'crossfit'),
('Clean & jerk', 'crossfit'),
('Burpees', 'crossfit'),
('Burpees al cajón', 'crossfit'),
('Box jump', 'crossfit'),
('Wall ball', 'crossfit'),
('Kettlebell swing', 'crossfit'),
('Lanzamiento de balón medicinal', 'crossfit'),
('Sandbag over shoulder', 'crossfit'),
('Sled push', 'crossfit'),
('Rower (500 m)', 'crossfit'),
('Assault bike', 'crossfit'),
('Double unders', 'crossfit'),
('Pull-up kipping', 'crossfit'),
('Ring muscle-up', 'crossfit'),
('Handstand push-up', 'crossfit'),
('Toes to bar', 'crossfit'),
('Flexiones de brazos', 'calistenia'),
('Flexiones diamante', 'calistenia'),
('Flexiones declinadas', 'calistenia'),
('Flexiones con palmas', 'calistenia'),
('Dominadas pronas', 'calistenia'),
('Fondos en paralelas', 'calistenia'),
('Fondos en banco', 'calistenia'),
('Dips con lastre', 'calistenia'),
('Muscle-up en barra', 'calistenia'),
('Handstand hold', 'calistenia'),
('Pistol squat', 'calistenia'),
('Nordic curl', 'calistenia'),
('Plancha L-sit', 'calistenia'),
('Plancha ahead', 'calistenia'),
('Mountain climbers', 'funcional'),
('Kettlebell goblet squat', 'funcional'),
('Kettlebell clean and press', 'funcional'),
('Medicine ball slam', 'funcional'),
('Battle ropes', 'funcional'),
('Farmer walk', 'funcional'),
('Skipping / saltar la soga', 'funcional'),
('Caminata del granjero', 'funcional'),
('Step ups', 'funcional'),
('Lunge walk', 'funcional'),
('Bear crawl', 'funcional'),
('Split jump', 'funcional'),
('Carrera suave', 'cardio'),
('Trote', 'running'),
('Carrera de velocidad', 'running'),
('Series de 400 m', 'running'),
('Fartlek', 'running'),
('Hill repeats', 'running'),
('Tempo run', 'running'),
('Larga distancia', 'running'),
('Sprint en cinta', 'cardio'),
('Bicicleta fija', 'cardio'),
('Elíptica', 'cardio'),
('Remo (cardio)', 'cardio'),
('Ciclismo al aire libre', 'cardio'),
('Crol', 'natacion'),
('Espalda', 'natacion'),
('Pecho', 'natacion'),
('Mariposa', 'natacion'),
('Patada con tabla', 'natacion'),
('Aguante con snorkel', 'natacion'),
('Sombra de boxeo', 'artes_marciales'),
('Boxeo al saco', 'artes_marciales'),
('Kickboxing', 'artes_marciales'),
('Muay thai (clínica)', 'artes_marciales'),
('Jiu-jitsu por posiciones', 'artes_marciales'),
('Shadow boxing', 'artes_marciales'),
('Técnica de striking', 'artes_marciales'),
('Postura del perro boca abajo', 'yoga'),
('Postura del guerrero', 'yoga'),
('Postura del árbol', 'yoga'),
('Saludo al sol', 'yoga'),
('Pilates reformer', 'yoga'),
('Bridge pilates', 'yoga'),
('Estiramiento de isquiotibiales', 'movilidad'),
('Apertura de cadera 90/90', 'movilidad'),
('Movilidad de hombros con banda', 'movilidad'),
('Rotaciones de columna', 'movilidad'),
('Estiramiento de flexores de cadera', 'movilidad'),
('Círculos de tobillo', 'movilidad')
on conflict (lower(name)) do nothing;