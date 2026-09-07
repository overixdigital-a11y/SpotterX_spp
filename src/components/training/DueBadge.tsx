"use client";

import { CalendarDays } from "lucide-react";
import { todayLocal, formatDay } from "@/lib/format";

export function DueBadge({ due_on, done }: { due_on: string; done?: boolean }) {
  if (done) return null;
  const today = todayLocal();
  const overdue = due_on < today;
  const isToday = due_on === today;
  const cls = overdue
    ? "border-ember/40 bg-ember/10 text-ember"
    : isToday
      ? "border-neon/40 bg-neon/10 text-neon"
      : "border-edge bg-bg text-muted";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${cls}`}
    >
      <CalendarDays className="h-3 w-3" />
      {overdue ? "Vencida" : isToday ? "Hoy" : formatDay(due_on)}
    </span>
  );
}