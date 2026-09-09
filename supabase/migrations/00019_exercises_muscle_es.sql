-- ============================================================
-- SpotterX - 00019: Grupo muscular (muscle) en el catálogo de
-- ejercicios + lote de ejercicios en español.
-- Después de 00018. Ejecutar en SQL Editor de Supabase.
-- ============================================================

alter table public.exercises add column if not exists muscle text;

create index if not exists exercises_muscle_idx on public.exercises (muscle);

-- ─── Backfill de ejercicios existentes ───
update public.exercises set muscle = 'pecho' where lower(name) in (
  'press de banca', 'press inclinado con mancuernas', 'aperturas con mancuernas',
  'flexiones de brazos', 'flexiones diamante', 'flexiones declinadas', 'flexiones con palmas'
);
update public.exercises set muscle = 'espalda' where lower(name) in (
  'remo con barra', 'remo con mancuerna', 'remo en polea baja', 'jalón al pecho',
  'dominadas', 'dominadas lastradas', 'dominadas pronas', 'pájaros (vuelos inversos)',
  'muscle-up en barra', 'ring muscle-up', 'pull-up kipping'
);
update public.exercises set muscle = 'hombros' where lower(name) in (
  'press de hombros', 'press militar', 'elevaciones laterales',
  'handstand push-up', 'handstand hold', 'lanzamiento de balón medicinal'
);
update public.exercises set muscle = 'bíceps' where lower(name) in (
  'curl de bíceps con barra', 'curl de bíceps con mancuerna', 'curl martillo'
);
update public.exercises set muscle = 'tríceps' where lower(name) in (
  'press francés', 'extensiones de tríceps en polea',
  'fondos en paralelas', 'fondos en banco', 'dips con lastre'
);
update public.exercises set muscle = 'cuádriceps' where lower(name) in (
  'sentadilla', 'sentadilla frontal', 'sentadilla búlgara', 'prensa de piernas',
  'extensiones de cuádriceps', 'zancadas', 'zancadas con mancuernas',
  'pistol squat', 'step ups', 'wall ball', 'kettlebell goblet squat', 'box jump', 'split jump'
);
update public.exercises set muscle = 'femoral' where lower(name) in (
  'peso muerto', 'peso muerto rumano', 'peso muerto sumo',
  'curl de femoral en máquina', 'nordic curl'
);
update public.exercises set muscle = 'glúteos' where lower(name) in ('hip thrust');
update public.exercises set muscle = 'pantorrilla' where lower(name) in ('elevación de pantorrillas');
update public.exercises set muscle = 'core' where lower(name) in (
  'crunch abdominal', 'plancha abdominal', 'russian twist', 'ab wheel',
  'toes to bar', 'mountain climbers', 'bear crawl', 'plancha l-sit', 'plancha ahead'
);
update public.exercises set muscle = 'full body' where lower(name) in (
  'thruster', 'clean', 'snatch', 'clean & jerk', 'burpees', 'burpees al cajón',
  'kettlebell swing', 'sandbag over shoulder', 'sled push',
  'farmer walk', 'caminata del granjero', 'kettlebell clean and press',
  'medicine ball slam', 'battle ropes', 'lunge walk'
);
update public.exercises set muscle = 'cardio' where lower(name) in (
  'carrera suave', 'trote', 'carrera de velocidad', 'series de 400 m',
  'fartlek', 'hill repeats', 'tempo run', 'larga distancia', 'sprint en cinta',
  'bicicleta fija', 'elíptica', 'remo (cardio)', 'ciclismo al aire libre',
  'rower (500 m)', 'assault bike', 'double unders', 'skipping / saltar la soga'
);
update public.exercises set muscle = 'técnica' where lower(name) in (
  'crol', 'espalda', 'pecho', 'mariposa', 'patada con tabla', 'aguante con snorkel',
  'sombra de boxeo', 'boxeo al saco', 'kickboxing', 'muay thai (clínica)',
  'jiu-jitsu por posiciones', 'shadow boxing', 'técnica de striking'
);
update public.exercises set muscle = 'movilidad' where lower(name) in (
  'postura del perro boca abajo', 'postura del guerrero', 'postura del árbol',
  'saludo al sol', 'pilates reformer', 'bridge pilates',
  'estiramiento de isquiotibiales', 'apertura de cadera 90/90',
  'movilidad de hombros con banda', 'rotaciones de columna',
  'estiramiento de flexores de cadera', 'círculos de tobillo'
);

-- ─── Ejercicios en español (se mantienen los de inglés) ───
insert into public.exercises (name, discipline, muscle) values
('Cargada de fuerza', 'crossfit', 'full body'),
('Arrancada', 'crossfit', 'full body'),
('Envión', 'crossfit', 'full body'),
('Salto al cajón', 'crossfit', 'cuádriceps'),
('Balón a la pared', 'crossfit', 'cuádriceps'),
('Doble salto a la cuerda', 'crossfit', 'cardio'),
('Punteras a la barra', 'crossfit', 'core'),
('Flexión de pino', 'calistenia', 'hombros'),
('Sentadilla pistola', 'calistenia', 'cuádriceps'),
('Curl nórdico', 'calistenia', 'femoral'),
('Muscle-up en anillas', 'calistenia', 'espalda'),
('Dominada australiana', 'calistenia', 'espalda'),
('Empuje de trineo', 'funcional', 'full body'),
('Cuerdas de batalla', 'funcional', 'full body'),
('Sentadilla con salto', 'funcional', 'cuádriceps'),
('Bird dog', 'funcional', 'core'),
('Subir escalones', 'funcional', 'cuádriceps'),
('Cruce de poleas', 'musculacion', 'pecho'),
('Apertura en peck deck', 'musculacion', 'pecho'),
('Press de pecho en máquina', 'musculacion', 'pecho'),
('Pull-over con mancuerna', 'musculacion', 'pecho'),
('Peso muerto con mancuernas', 'musculacion', 'femoral'),
('Remo en máquina', 'musculacion', 'espalda'),
('Jalón con agarre cerrado', 'musculacion', 'espalda'),
('Dominada asistida', 'musculacion', 'espalda'),
('Encogimiento de hombros', 'musculacion', 'hombros'),
('Curl concentrado', 'musculacion', 'bíceps'),
('Curl en predicador', 'musculacion', 'bíceps'),
('Press de banca con agarre cerrado', 'musculacion', 'tríceps'),
('Extensión de tríceps con mancuerna', 'musculacion', 'tríceps'),
('Puente de glúteos', 'musculacion', 'glúteos'),
('Sentadilla goblet', 'musculacion', 'cuádriceps'),
('Plancha lateral', 'musculacion', 'core'),
('Superman', 'musculacion', 'espalda'),
('Goblet squat', 'funcional', 'cuádriceps'),
('Saltos a la soga', 'cardio', 'cardio'),
('Caminata rápida', 'cardio', 'cardio')
on conflict (lower(name)) do nothing;