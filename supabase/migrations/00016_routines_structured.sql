-- ============================================================
-- SpotterX - 00016: Rutinas estructuradas por ciclo de días
-- + disciplinas + tracking de progreso.
-- Ejecutar en SQL Editor de Supabase (despues de 00015)
-- ============================================================

-- Catálogo de disciplinas
create table if not exists public.disciplines (
  id text primary key,
  label text not null,
  icon text,
  fields jsonb not null default '[]'::jsonb,
  position int not null default 0
);

insert into public.disciplines (id, label, icon, fields, position) values
('musculacion', 'Musculación/Fuerza', 'Dumbbell', '[
  {"key":"sets","label":"Series","type":"number"},
  {"key":"reps","label":"Reps","type":"text"},
  {"key":"weight_kg","label":"Peso (kg)","type":"number"},
  {"key":"rest_seconds","label":"Descanso (s)","type":"number"},
  {"key":"tempo","label":"Tempo","type":"text"}
]'::jsonb, 1),
('cardio', 'Cardio/Resistencia', 'Heart', '[
  {"key":"duration_min","label":"Duración (min)","type":"number"},
  {"key":"distance_km","label":"Distancia (km)","type":"number"},
  {"key":"pace_min_km","label":"Ritmo (min/km)","type":"text"},
  {"key":"heart_rate","label":"FC promedio","type":"number"}
]'::jsonb, 2),
('artes_marciales', 'Artes marciales', 'Swords', '[
  {"key":"rounds","label":"Rounds","type":"number"},
  {"key":"round_duration_sec","label":"Duración round (s)","type":"number"},
  {"key":"technique","label":"Técnica","type":"text"},
  {"key":"intensity","label":"Intensidad","type":"select","options":["baja","media","alta","máxima"]}
]'::jsonb, 3),
('yoga', 'Yoga/Pilates', 'Flower2', '[
  {"key":"duration_min","label":"Duración (min)","type":"number"},
  {"key":"pose","label":"Postura","type":"text"},
  {"key":"hold_seconds","label":"Mantener (s)","type":"number"},
  {"key":"breath_cycles","label":"Ciclos respiración","type":"number"}
]'::jsonb, 4),
('natacion', 'Natación', 'Waves', '[
  {"key":"laps","label":"Largos","type":"number"},
  {"key":"distance_m","label":"Distancia (m)","type":"number"},
  {"key":"stroke","label":"Estilo","type":"select","options":["libre","espalda","pecho","mariposa","combinado"]},
  {"key":"rest_seconds","label":"Descanso (s)","type":"number"}
]'::jsonb, 5),
('running', 'Running/Trail', 'Timer', '[
  {"key":"distance_km","label":"Distancia (km)","type":"number"},
  {"key":"duration_min","label":"Duración (min)","type":"number"},
  {"key":"pace_min_km","label":"Ritmo (min/km)","type":"text"},
  {"key":"elevation_m","label":"Desnivel (m)","type":"number"}
]'::jsonb, 6),
('calistenia', 'Calistenia', 'PersonStanding', '[
  {"key":"sets","label":"Series","type":"number"},
  {"key":"reps","label":"Reps","type":"text"},
  {"key":"variation","label":"Variación","type":"text"},
  {"key":"tempo","label":"Tempo","type":"text"},
  {"key":"hold_seconds","label":"Mantener (s)","type":"number"}
]'::jsonb, 7),
('crossfit', 'CrossFit', 'Flame', '[
  {"key":"rounds","label":"Rounds","type":"number"},
  {"key":"reps","label":"Reps","type":"text"},
  {"key":"weight_kg","label":"Peso (kg)","type":"number"},
  {"key":"time_cap_sec","label":"Time cap (s)","type":"number"},
  {"key":"movement","label":"Movimiento","type":"text"}
]'::jsonb, 8),
('hiit', 'HIIT', 'Zap', '[
  {"key":"rounds","label":"Rounds","type":"number"},
  {"key":"work_sec","label":"Trabajo (s)","type":"number"},
  {"key":"rest_sec","label":"Descanso (s)","type":"number"},
  {"key":"movement","label":"Movimiento","type":"text"}
]'::jsonb, 9),
('funcional', 'Funcional', 'Activity', '[
  {"key":"sets","label":"Series","type":"number"},
  {"key":"reps","label":"Reps","type":"text"},
  {"key":"movement","label":"Movimiento","type":"text"},
  {"key":"rest_seconds","label":"Descanso (s)","type":"number"}
]'::jsonb, 10),
('movilidad', 'Movilidad', 'StretchHorizontal', '[
  {"key":"duration_min","label":"Duración (min)","type":"number"},
  {"key":"zone","label":"Zona","type":"text"},
  {"key":"hold_seconds","label":"Mantener (s)","type":"number"},
  {"key":"intensity","label":"Intensidad","type":"select","options":["baja","media","alta"]}
]'::jsonb, 11),
('otras', 'Otras', 'Puzzle', '[]'::jsonb, 12)
on conflict (id) do nothing;

-- Disciplinas en el perfil del profe
alter table public.profiles
  add column if not exists disciplines jsonb not null default '[]'::jsonb;

-- Extender rutinas con disciplina
alter table public.trainer_routines
  add column if not exists discipline text,
  add column if not exists custom_fields jsonb default '[]'::jsonb;

-- Items de rutina (ejercicios estructurados por día del ciclo)
create table if not exists public.trainer_routine_items (
  id uuid primary key default gen_random_uuid(),
  routine_id uuid not null references public.trainer_routines(id) on delete cascade,
  day integer not null default 1,
  day_label text,
  exercise text not null,
  position integer not null default 0,
  notes text,
  data jsonb not null default '{}',
  created_at timestamptz not null default now()
);

alter table public.trainer_routine_items enable row level security;

create policy "Routine items: lectura involucrados" on public.trainer_routine_items
  for select using (
    exists (
      select 1 from public.trainer_routines tr
      where tr.id = routine_id and auth.uid() in (tr.trainer_id, tr.student_id)
    )
  );
create policy "Routine items: profe gestiona" on public.trainer_routine_items
  for all using (
    exists (
      select 1 from public.trainer_routines tr
      where tr.id = routine_id and auth.uid() = tr.trainer_id
    )
  ) with check (
    exists (
      select 1 from public.trainer_routines tr
      where tr.id = routine_id and auth.uid() = tr.trainer_id
    )
  );

create index idx_routine_items_routine on public.trainer_routine_items(routine_id, day, position);

-- Logs de progreso (valores reales del alumno)
create table if not exists public.trainer_routine_logs (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.trainer_routine_items(id) on delete cascade,
  routine_id uuid not null references public.trainer_routines(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  day integer not null,
  log_date date not null default current_date,
  data jsonb not null default '{}',
  notes text,
  created_at timestamptz not null default now()
);

alter table public.trainer_routine_logs enable row level security;

create policy "Routine logs: alumno gestiona" on public.trainer_routine_logs
  for all using (auth.uid() = student_id) with check (auth.uid() = student_id);
create policy "Routine logs: profe lee" on public.trainer_routine_logs
  for select using (
    exists (
      select 1 from public.trainer_routines tr
      where tr.id = routine_id and auth.uid() = tr.trainer_id
    )
  );

create index idx_routine_logs_item_date on public.trainer_routine_logs(item_id, log_date);
create index idx_routine_logs_routine_day on public.trainer_routine_logs(routine_id, day, log_date);
create index idx_routine_logs_student on public.trainer_routine_logs(student_id, log_date);

-- Realtime
do $$
begin
  begin
    alter publication supabase_realtime add table public.trainer_routine_items;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.trainer_routine_logs;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.disciplines;
  exception when duplicate_object then null;
  end;
end;
$$;
