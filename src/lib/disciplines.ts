export interface FieldDef {
  key: string;
  label: string;
  type: "number" | "text" | "select";
  options?: string[];
  placeholder?: string;
}

export interface Discipline {
  id: string;
  label: string;
  icon: string;
  fields: FieldDef[];
}

export const DISCIPLINES: Discipline[] = [
  {
    id: "musculacion",
    label: "Musculación/Fuerza",
    icon: "Dumbbell",
    fields: [
      { key: "sets", label: "Series", type: "number" },
      { key: "reps", label: "Reps", type: "text", placeholder: "ej: 10-12" },
      { key: "weight_kg", label: "Peso (kg)", type: "number" },
      { key: "rest_seconds", label: "Descanso (s)", type: "number" },
      { key: "tempo", label: "Tempo", type: "text", placeholder: "ej: 2-0-1-0" },
    ],
  },
  {
    id: "cardio",
    label: "Cardio/Resistencia",
    icon: "Heart",
    fields: [
      { key: "duration_min", label: "Duración (min)", type: "number" },
      { key: "distance_km", label: "Distancia (km)", type: "number" },
      { key: "pace_min_km", label: "Ritmo (min/km)", type: "text", placeholder: "ej: 5:30" },
      { key: "heart_rate", label: "FC promedio", type: "number" },
    ],
  },
  {
    id: "artes_marciales",
    label: "Artes marciales",
    icon: "Swords",
    fields: [
      { key: "rounds", label: "Rounds", type: "number" },
      { key: "round_duration_sec", label: "Duración round (s)", type: "number" },
      { key: "technique", label: "Técnica", type: "text" },
      { key: "intensity", label: "Intensidad", type: "select", options: ["baja", "media", "alta", "máxima"] },
    ],
  },
  {
    id: "yoga",
    label: "Yoga/Pilates",
    icon: "Flower2",
    fields: [
      { key: "duration_min", label: "Duración (min)", type: "number" },
      { key: "pose", label: "Postura", type: "text" },
      { key: "hold_seconds", label: "Mantener (s)", type: "number" },
      { key: "breath_cycles", label: "Ciclos respiración", type: "number" },
    ],
  },
  {
    id: "natacion",
    label: "Natación",
    icon: "Waves",
    fields: [
      { key: "laps", label: "Largos", type: "number" },
      { key: "distance_m", label: "Distancia (m)", type: "number" },
      { key: "stroke", label: "Estilo", type: "select", options: ["libre", "espalda", "pecho", "mariposa", "combinado"] },
      { key: "rest_seconds", label: "Descanso (s)", type: "number" },
    ],
  },
  {
    id: "running",
    label: "Running/Trail",
    icon: "Timer",
    fields: [
      { key: "distance_km", label: "Distancia (km)", type: "number" },
      { key: "duration_min", label: "Duración (min)", type: "number" },
      { key: "pace_min_km", label: "Ritmo (min/km)", type: "text", placeholder: "ej: 5:30" },
      { key: "elevation_m", label: "Desnivel (m)", type: "number" },
    ],
  },
  {
    id: "calistenia",
    label: "Calistenia",
    icon: "PersonStanding",
    fields: [
      { key: "sets", label: "Series", type: "number" },
      { key: "reps", label: "Reps", type: "text", placeholder: "ej: 10-12" },
      { key: "variation", label: "Variación", type: "text" },
      { key: "tempo", label: "Tempo", type: "text", placeholder: "ej: 2-0-1-0" },
      { key: "hold_seconds", label: "Mantener (s)", type: "number" },
    ],
  },
  {
    id: "crossfit",
    label: "CrossFit",
    icon: "Flame",
    fields: [
      { key: "rounds", label: "Rounds", type: "number" },
      { key: "reps", label: "Reps", type: "text", placeholder: "ej: 15-12-9" },
      { key: "weight_kg", label: "Peso (kg)", type: "number" },
      { key: "time_cap_sec", label: "Time cap (s)", type: "number" },
      { key: "movement", label: "Movimiento", type: "text" },
    ],
  },
  {
    id: "hiit",
    label: "HIIT",
    icon: "Zap",
    fields: [
      { key: "rounds", label: "Rounds", type: "number" },
      { key: "work_sec", label: "Trabajo (s)", type: "number" },
      { key: "rest_sec", label: "Descanso (s)", type: "number" },
      { key: "movement", label: "Movimiento", type: "text" },
    ],
  },
  {
    id: "funcional",
    label: "Funcional",
    icon: "Activity",
    fields: [
      { key: "sets", label: "Series", type: "number" },
      { key: "reps", label: "Reps", type: "text", placeholder: "ej: 12-15" },
      { key: "movement", label: "Movimiento", type: "text" },
      { key: "rest_seconds", label: "Descanso (s)", type: "number" },
    ],
  },
  {
    id: "movilidad",
    label: "Movilidad",
    icon: "StretchHorizontal",
    fields: [
      { key: "duration_min", label: "Duración (min)", type: "number" },
      { key: "zone", label: "Zona", type: "text" },
      { key: "hold_seconds", label: "Mantener (s)", type: "number" },
      { key: "intensity", label: "Intensidad", type: "select", options: ["baja", "media", "alta"] },
    ],
  },
  {
    id: "otras",
    label: "Otras",
    icon: "Puzzle",
    fields: [],
  },
];

export interface Series {
  reps?: string | number | null;
  weight_kg?: number | null;
  rest_seconds?: number | null;
}

export interface SeriesLog {
  done: boolean;
  weight_kg?: number | null;
}

const SERIES_DISCIPLINES = new Set(["musculacion", "crossfit", "calistenia", "funcional"]);

export function isSeriesDiscipline(disciplineId: string | null): boolean {
  return disciplineId ? SERIES_DISCIPLINES.has(disciplineId) : false;
}

export function getSeries(data: Record<string, unknown> | null | undefined, disciplineId: string | null): Series[] {
  const d = data ?? {};
  if (isSeriesDiscipline(disciplineId) && Array.isArray(d.series)) {
    return d.series as Series[];
  }
  if (Array.isArray(d.series)) return d.series as Series[];
  return [];
}

export function resolveSeries(data: Record<string, unknown> | null | undefined, disciplineId: string | null): Series[] {
  const serie = getSeries(data, disciplineId);
  if (serie.length > 0) return serie;
  return legacyToSeries(data, disciplineId);
}

export function legacyToSeries(data: Record<string, unknown> | null | undefined, disciplineId: string | null): Series[] {
  const d = data ?? {};
  const sets = Number(d.sets);
  if (isSeriesDiscipline(disciplineId) && Number.isInteger(sets) && sets > 0) {
    return Array.from({ length: sets }, () => ({
      reps: (d.reps as string | number) ?? "",
      weight_kg: d.weight_kg != null && d.weight_kg !== "" ? Number(d.weight_kg) : null,
      rest_seconds: d.rest_seconds != null && d.rest_seconds !== "" ? Number(d.rest_seconds) : null,
    }));
  }
  return [];
}

export function formatSeries(s: Series): string {
  const parts: string[] = [];
  if (s.reps != null && s.reps !== "") parts.push(String(s.reps));
  if (s.weight_kg != null) parts.push(`${s.weight_kg}kg`);
  if (s.rest_seconds != null) parts.push(`${s.rest_seconds}s`);
  return parts.join(" · ");
}

export function getDiscipline(id: string | null): Discipline | undefined {
  return DISCIPLINES.find((d) => d.id === id);
}

export function getDisciplineFields(id: string | null, customFields?: FieldDef[]): FieldDef[] {
  if (id === "otras") return customFields ?? [];
  return DISCIPLINES.find((d) => d.id === id)?.fields ?? [];
}

export function formatFieldValue(value: unknown, field: FieldDef): string {
  if (value == null || value === "") return "—";
  if (field.type === "select") return String(value);
  if (field.key === "weight_kg") return `${value}kg`;
  if (field.key === "rest_seconds" || field.key === "round_duration_sec" || field.key === "hold_seconds" || field.key === "work_sec" || field.key === "rest_sec")
    return `${value}s`;
  if (field.key === "distance_km") return `${value}km`;
  if (field.key === "distance_m") return `${value}m`;
  if (field.key === "duration_min") return `${value}min`;
  if (field.key === "elevation_m") return `${value}m`;
  if (field.key === "pace_min_km") return `${value}/km`;
  if (field.key === "time_cap_sec") return `cap ${value}s`;
  return String(value);
}

export function buildPlannedSummary(data: Record<string, unknown>, fields: FieldDef[]): string {
  return fields
    .filter((f) => data[f.key] != null && data[f.key] !== "")
    .map((f) => formatFieldValue(data[f.key], f))
    .join(" · ");
}
