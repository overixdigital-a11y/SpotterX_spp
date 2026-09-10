export interface SessionInfo {
  routineId: string;
  routineTitle: string;
  day: number;
  dayLabel: string | null;
}

export interface MonthCell {
  date: string | null;
  dayNumber: number;
  inMonth: boolean;
}

export interface MonthBar {
  mes: string;
  key: string;
  hechas: number;
  planificadas: number;
}

export function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function monthGrid(year: number, month: number): MonthCell[] {
  const startWeekday = (new Date(year, month - 1, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells: MonthCell[] = [];
  for (let i = 0; i < startWeekday; i++) {
    cells.push({ date: null, dayNumber: 0, inMonth: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ date: `${year}-${pad(month)}-${pad(d)}`, dayNumber: d, inMonth: true });
  }
  return cells;
}

export function isFutureDate(dateStr: string | null, todayStr: string): boolean {
  return !!dateStr && dateStr > todayStr;
}

export function countLogsByDate(logs: { log_date: string }[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const l of logs) {
    m.set(l.log_date, (m.get(l.log_date) ?? 0) + 1);
  }
  return m;
}

export function sessionsByDate(
  logs: { log_date: string; routine_id: string; day: number }[],
  routines: { id: string; title: string }[],
  items: { routine_id: string; day: number; day_label: string | null }[]
): Map<string, SessionInfo[]> {
  const routineTitle = new Map(routines.map((r) => [r.id, r.title]));
  const labelBy = new Map<string, string | null>();
  for (const it of items) labelBy.set(`${it.routine_id}:${it.day}`, it.day_label);
  const m = new Map<string, SessionInfo[]>();
  for (const l of logs) {
    const info: SessionInfo = {
      routineId: l.routine_id,
      routineTitle: routineTitle.get(l.routine_id) ?? "Rutina",
      day: l.day,
      dayLabel: labelBy.get(`${l.routine_id}:${l.day}`) ?? null,
    };
    const arr = m.get(l.log_date);
    if (arr) arr.push(info);
    else m.set(l.log_date, [info]);
  }
  return m;
}

export function plannedDates(routines: { due_on: string | null }[]): Set<string> {
  const s = new Set<string>();
  for (const r of routines) {
    if (r.due_on) s.add(r.due_on.slice(0, 10));
  }
  return s;
}

export function computeStreak(dates: Set<string>, today: string): number {
  let streak = 0;
  const cursor = new Date(`${today}T12:00:00`);
  if (!dates.has(today)) cursor.setDate(cursor.getDate() - 1);
  for (;;) {
    const key = `${cursor.getFullYear()}-${pad(cursor.getMonth() + 1)}-${pad(cursor.getDate())}`;
    if (!dates.has(key)) break;
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function monthlySeries(
  byDate: Map<string, number>,
  planned: Set<string>,
  months: number,
  today: string
): MonthBar[] {
  const res: MonthBar[] = [];
  const cursor = new Date(`${today}T12:00:00`);
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(cursor.getFullYear(), cursor.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
    let hechas = 0;
    let planificadas = 0;
    byDate.forEach((_v, date) => {
      if (date.startsWith(key)) hechas++;
    });
    planned.forEach((date) => {
      if (date.startsWith(key)) planificadas++;
    });
    res.push({
      mes: d.toLocaleDateString("es-AR", { month: "short" }).replace(".", ""),
      key,
      hechas,
      planificadas,
    });
  }
  return res;
}

export function monthLabel(year: number, month: number): string {
  return new Date(year, month - 1, 1).toLocaleDateString("es-AR", {
    month: "long",
    year: "numeric",
  });
}

export function categoryForDiscipline(discipline: string | null | undefined): string {
  const d = discipline ?? "";
  if (d.includes("running")) return "#Running";
  if (d.includes("crossfit")) return "#CrossFit";
  if (d.includes("calistenia")) return "#Calistenia";
  if (d.includes("yoga")) return "#Yoga";
  if (d.includes("boxeo")) return "#Boxeo";
  if (d.includes("cardio") || d.includes("hiit")) return "#Cardio";
  if (d.includes("musculacion") || d.includes("power") || d.includes("fuerza")) return "#Powerlifting";
  return "#CrossFit";
}