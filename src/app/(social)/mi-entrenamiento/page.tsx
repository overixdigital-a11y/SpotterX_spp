"use client";

import { useEffect, useState } from "react";
import {
  Loader2,
  FileText,
  ListChecks,
  MessageCircle,
  Send,
  ChevronDown,
  Users,
  TrendingUp,
  Award,
  Calendar,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuthState } from "@/lib/auth-context";
import { todayLocal } from "@/lib/format";
import { getDisciplineFields, isSeriesDiscipline, resolveSeries, formatSeries, type FieldDef } from "@/lib/disciplines";
import { MEALS, getDietData, formatQuantity } from "@/lib/diets";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

interface Trainer {
  id: string;
  username: string;
  full_name: string | null;
  source: string;
}

interface Plan {
  id: string;
  title: string;
  kind: string;
  content: string | null;
  assigned_at: string | null;
}

interface PlanItem {
  id: string;
  plan_id: string;
  day: number | null;
  exercise: string;
  sets: number | null;
  reps: string | null;
  rest_seconds: number | null;
  notes: string | null;
  position: number;
  data: Record<string, unknown> | null;
}

interface Routine {
  id: string;
  title: string;
  description: string | null;
  discipline: string | null;
  custom_fields: FieldDef[] | null;
  done: boolean;
  due_on: string | null;
  completed_at: string | null;
  created_at: string;
}

interface RoutineItem {
  id: string;
  routine_id: string;
  day: number;
  day_label: string | null;
  exercise: string;
  position: number;
  notes: string | null;
  data: Record<string, unknown>;
}

interface RoutineLog {
  id: string;
  item_id: string;
  routine_id: string;
  day: number;
  log_date: string;
  data: Record<string, unknown>;
  notes: string | null;
}

interface SeriesEntry {
  done: boolean;
  weight_kg: number | null;
}

interface Msg {
  id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  read: boolean;
  created_at: string;
}

export default function MiEntrenamientoPage() {
  const { userId } = useAuthState();
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [trainerId, setTrainerId] = useState<string | null>(null);
  const [tab, setTab] = useState<"planes" | "rutinas" | "chat">("planes");
  const [plans, setPlans] = useState<Plan[]>([]);
  const [items, setItems] = useState<PlanItem[]>([]);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [routineItems, setRoutineItems] = useState<RoutineItem[]>([]);
  const [routineLogs, setRoutineLogs] = useState<RoutineLog[]>([]);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [msgText, setMsgText] = useState("");
  const [loading, setLoading] = useState(true);
  const [openPlan, setOpenPlan] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  const [selectedRoutine, setSelectedRoutine] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<number>(1);
  const [logValues, setLogValues] = useState<Record<string, Record<string, unknown>>>({});
  const [seriesLogs, setSeriesLogs] = useState<Record<string, SeriesEntry[]>>({});
  const [showProgress, setShowProgress] = useState<string | null>(null);
  const [progressExercise, setProgressExercise] = useState<string>("");
  const [progressData, setProgressData] = useState<{ date: string; value: number }[]>([]);

  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    let active = true;
    const loadTrainers = async () => {
      const { data: ts } = await supabase
        .from("trainer_students")
        .select("trainer_id, source")
        .eq("student_id", userId)
        .eq("active", true);
      if (!active) return;
      const ids = (ts as { trainer_id: string; source: string }[] | null)?.map((t) => t.trainer_id) ?? [];
      if (ids.length === 0) {
        setTrainers([]);
        setLoading(false);
        return;
      }
      const { data: ps } = await supabase
        .from("profiles")
        .select("id, username, full_name")
        .in("id", ids);
      const map = new Map<string, Trainer>();
      if (ps) {
        (ps as { id: string; username: string; full_name: string | null }[]).forEach((p) =>
          map.set(p.id, { ...p, source: "" })
        );
      }
      (ts as { trainer_id: string; source: string }[]).forEach((t) => {
        const curr = map.get(t.trainer_id);
        if (curr) map.set(t.trainer_id, { ...curr, source: t.source });
      });
      const list = ids.map((id) => map.get(id)).filter(Boolean) as Trainer[];
      setTrainers(list);
      if (list.length > 0) setTrainerId((prev) => prev ?? list[0].id);
      setLoading(false);
    };
    loadTrainers();
    return () => { active = false; };
  }, [userId]);

  useEffect(() => {
    if (!userId || !trainerId) return;
    const supabase = createClient();
    let active = true;

    const loadData = async () => {
      const { data: pl } = await supabase
        .from("trainer_plans")
        .select("*")
        .eq("trainer_id", trainerId)
        .eq("is_template", false)
        .not("assigned_at", "is", null)
        .order("created_at", { ascending: false });
      if (!active) return;
      if (pl) setPlans(pl as Plan[]);

      const planIds = (pl as Plan[] | null)?.map((x) => x.id) ?? [];
      if (planIds.length > 0) {
        const { data: it } = await supabase
          .from("trainer_plan_items")
          .select("*")
          .in("plan_id", planIds)
          .order("position", { ascending: true });
        if (active && it) setItems(it as PlanItem[]);
      }

      const { data: rt } = await supabase
        .from("trainer_routines")
        .select("*")
        .eq("trainer_id", trainerId)
        .order("created_at", { ascending: false });
      if (active && rt) setRoutines(rt as Routine[]);

      const routineIds = (rt as Routine[] | null)?.map((x) => x.id) ?? [];
      if (routineIds.length > 0) {
        const { data: ri } = await supabase
          .from("trainer_routine_items")
          .select("*")
          .in("routine_id", routineIds)
          .order("day", { ascending: true })
          .order("position", { ascending: true });
        if (active && ri) setRoutineItems(ri as unknown as RoutineItem[]);

        if (userId) {
          const { data: rl } = await supabase
            .from("trainer_routine_logs")
            .select("*")
            .eq("student_id", userId)
            .in("routine_id", routineIds);
          if (active && rl) setRoutineLogs(rl as unknown as RoutineLog[]);
        }
      }

      const { data: ms } = await supabase
        .from("messages")
        .select("*")
        .or(`sender_id.eq.${trainerId},recipient_id.eq.${trainerId}`)
        .order("created_at", { ascending: true });
      if (!active) return;
      if (ms) {
        const unread = (ms as Msg[]).filter(
          (m) => m.sender_id === trainerId && m.recipient_id === userId && !m.read
        ).length;
        setUnreadCount(unread);
        setMessages(ms as Msg[]);
      }

      await supabase
        .from("messages")
        .update({ read: true })
        .eq("recipient_id", userId)
        .eq("sender_id", trainerId)
        .eq("read", false);

      setLoading(false);
    };

    loadData();

    const channel = supabase
      .channel(`mi-ent-${trainerId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `recipient_id=eq.${userId}` }, () => loadData())
      .on("postgres_changes", { event: "*", schema: "public", table: "trainer_routines", filter: `trainer_id=eq.${trainerId}` }, () => loadData())
      .on("postgres_changes", { event: "*", schema: "public", table: "trainer_routine_items" }, () => loadData())
      .on("postgres_changes", { event: "*", schema: "public", table: "trainer_plans", filter: `trainer_id=eq.${trainerId}` }, () => loadData())
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [userId, trainerId]);

  const saveLogs = async (routineId: string, day: number) => {
    if (!userId) return;
    const supabase = createClient();
    const routine = routines.find((r) => r.id === routineId);
    const dayItems = routineItems.filter((ri) => ri.routine_id === routineId && ri.day === day);
    const today = todayLocal();
    const todayLogs = routineLogs.filter(
      (l) => l.routine_id === routineId && l.day === day && l.log_date === today
    );

    const entriesFor = (ri: RoutineItem): SeriesEntry[] => {
      const planned = resolveSeries(ri.data, routine?.discipline ?? null);
      const log = todayLogs.find((l) => l.item_id === ri.id);
      if (seriesLogs[ri.id]) return seriesLogs[ri.id];
      const series = Array.isArray(log?.data?.series)
        ? (log.data.series as { done?: boolean; weight_kg?: number | null }[])
        : [];
      return planned.map((s, i) => ({
        done: series[i]?.done ?? false,
        weight_kg: series[i]?.weight_kg != null ? series[i].weight_kg : (s.weight_kg ?? null),
      }));
    };

    if (isSeriesDiscipline(routine?.discipline ?? null)) {
      const upserts = dayItems
        .map((ri) => ({
          item_id: ri.id,
          routine_id: routineId,
          student_id: userId,
          day,
          log_date: today,
          data: {
            series: entriesFor(ri).map((e) => ({
              done: e.done,
              weight_kg: e.done ? e.weight_kg : null,
            })),
          },
        }))
        .filter((u) => (u.data.series as SeriesEntry[]).some((s) => s.done));
      if (upserts.length > 0) {
        for (const u of upserts) {
          await supabase.from("trainer_routine_logs").upsert(u, { onConflict: "item_id,log_date" });
        }
        const { data: freshLogs } = await supabase
          .from("trainer_routine_logs")
          .select("*")
          .eq("student_id", userId)
          .eq("routine_id", routineId);
        if (freshLogs) setRoutineLogs(freshLogs as unknown as RoutineLog[]);
      }
      return;
    }

    const flatUpserts = dayItems
      .filter((ri) => logValues[ri.id] && Object.values(logValues[ri.id]).some((v) => v !== "" && v !== null && v !== undefined))
      .map((ri) => ({
        item_id: ri.id,
        routine_id: routineId,
        student_id: userId,
        day,
        log_date: today,
        data: logValues[ri.id] ?? {},
      }));

    if (flatUpserts.length > 0) {
      for (const u of flatUpserts) {
        await supabase.from("trainer_routine_logs").upsert(u, { onConflict: "item_id,log_date" });
      }
      const { data: freshLogs } = await supabase
        .from("trainer_routine_logs")
        .select("*")
        .eq("student_id", userId)
        .eq("routine_id", routineId);
      if (freshLogs) setRoutineLogs(freshLogs as unknown as RoutineLog[]);
    }
  };

  const loadProgress = async (routineId: string, exerciseName: string) => {
    if (!userId) return;
    const supabase = createClient();
    const itemIds = routineItems
      .filter((ri) => ri.routine_id === routineId && ri.exercise === exerciseName)
      .map((ri) => ri.id);
    if (itemIds.length === 0) return;

    const { data } = await supabase
      .from("trainer_routine_logs")
      .select("log_date, data, item_id")
      .eq("student_id", userId)
      .in("item_id", itemIds)
      .order("log_date", { ascending: true });

    if (data) {
      const r = routines.find((rr) => rr.id === routineId);

      const points = (data as { log_date: string; data: Record<string, unknown> }[])
        .map((d) => {
          if (isSeriesDiscipline(r?.discipline ?? null)) {
            const series = Array.isArray(d.data?.series)
              ? (d.data.series as { done?: boolean; weight_kg?: number | null }[])
              : [];
            const maxW = series
              .filter((x) => x.done)
              .reduce((m, x) => Math.max(m, Number(x.weight_kg) || 0), 0);
            return { date: d.log_date, value: maxW };
          }
          const fields = getDisciplineFields(r?.discipline ?? null, r?.custom_fields ?? undefined);
          const numField = fields.find((f) => f.type === "number" && f.key !== "rest_seconds" && f.key !== "hold_seconds" && f.key !== "round_duration_sec" && f.key !== "work_sec" && f.key !== "rest_sec");
          const fieldKey = numField?.key ?? fields[0]?.key ?? "weight_kg";
          return { date: d.log_date, value: Number(d.data[fieldKey]) || 0 };
        })
        .filter((d) => d.value > 0);

      setProgressData(points);
      setProgressExercise(exerciseName);
      setShowProgress(routineId);
    }
  };

  const send = async () => {
    if (!userId || !trainerId || !msgText.trim()) return;
    const supabase = createClient();
    await supabase
      .from("messages")
      .insert({ sender_id: userId, recipient_id: trainerId, content: msgText.trim() });
    setMsgText("");
    const { data } = await supabase
      .from("messages")
      .select("*")
      .or(`sender_id.eq.${trainerId},recipient_id.eq.${trainerId}`)
      .order("created_at", { ascending: true });
    if (data) setMessages(data as Msg[]);
  };

  if (loading) {
    return (
      <main className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-neon" />
      </main>
    );
  }

  if (trainers.length === 0) {
    return (
      <main className="mx-auto max-w-md px-4 pt-5 pb-24">
        <h1 className="text-xl font-bold text-ink">Mi entrenamiento</h1>
        <div className="mt-6 rounded-xl border border-edge bg-card p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-neon/20">
            <Users className="h-5 w-5 text-neon" />
          </div>
          <p className="mt-3 text-sm font-semibold text-ink">Todavía no tenés un profe</p>
          <p className="mt-1 text-sm text-muted">
            Cuando un profesor te agregue como alumno, sus planes, rutinas y mensajes van a aparecer acá.
          </p>
        </div>
      </main>
    );
  }

  const trainer = trainers.find((t) => t.id === trainerId) ?? trainers[0];

  return (
    <main className="mx-auto max-w-md px-4 pt-5 pb-24">
      <h1 className="text-xl font-bold text-ink">Mi entrenamiento</h1>

      {trainers.length > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {trainers.map((t) => (
            <button
              key={t.id}
              onClick={() => setTrainerId(t.id)}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                t.id === trainer?.id ? "border-neon bg-neon text-bg" : "border-edge bg-card text-muted"
              }`}
            >
              {t.full_name || t.username}
            </button>
          ))}
        </div>
      )}

      <div className="mt-4 flex items-center gap-3 rounded-xl border border-edge bg-card p-3.5">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-neon/20 text-base font-bold text-neon">
          {(trainer?.full_name || trainer?.username || "P").slice(0, 2).toUpperCase()}
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold text-ink">{trainer?.full_name || trainer?.username}</p>
          <p className="text-xs text-muted">Tu profe {trainer?.source === "gym" ? "del gimnasio" : "personal"}</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-card p-1">
        {(
          [
            ["planes", "Planes", FileText],
            ["rutinas", "Rutinas", ListChecks],
            ["chat", "Chat", MessageCircle],
          ] as const
        ).map(([key, label, Icon]) => (
          <button
            key={key}
            onClick={() => {
              setTab(key);
              if (key === "chat") setUnreadCount(0);
            }}
            className={`flex items-center justify-center gap-1.5 rounded-lg py-2.5 text-sm font-semibold transition ${
              tab === key ? "bg-neon text-bg" : "text-muted"
            }`}
          >
            <Icon className="h-4 w-4" /> {label}
            {key === "chat" && unreadCount > 0 && (
              <span className="ml-1 flex h-4 w-4 items-center justify-center rounded-full bg-ember text-[10px] font-bold text-bg">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ─── PLANES ─── */}
      {tab === "planes" && (
        <div className="mt-4">
          {plans.length === 0 && (
            <p className="py-8 text-center text-sm text-muted">Tu profe todavía no te asignó planes.</p>
          )}
          {plans.map((p) => {
            const planItems = items
              .filter((i) => i.plan_id === p.id)
              .sort((a, b) => (a.day ?? 0) - (b.day ?? 0) || a.position - b.position);
            const expanded = openPlan === p.id;
            const isNutrition = p.kind === "alimentacion";
            const groups = new Map<number, PlanItem[]>();
            planItems.forEach((i) => {
              const k = i.day ?? 0;
              groups.set(k, [...(groups.get(k) ?? []), i]);
            });
            const MEAL_ORDER = ["desayuno", "colacion", "almuerzo", "merienda", "cena", "post_entreno"];
            const dietGroups = new Map<number, { label: string; items: PlanItem[] }[]>();
            if (isNutrition && expanded) {
              const perDay = new Map<number, Map<string, PlanItem[]>>();
              planItems.forEach((i) => {
                const k = i.day ?? 0;
                if (!perDay.has(k)) perDay.set(k, new Map());
                const meals = perDay.get(k)!;
                const meal = getDietData(i.data).meal ?? "__sin__";
                if (!meals.has(meal)) meals.set(meal, []);
                meals.get(meal)!.push(i);
              });
              for (const [k, meals] of perDay) {
                const sorted = Array.from(meals.entries())
                  .map(([id, list]) => ({
                    label: id === "__sin__" ? "Sin etiquetar" : (MEALS.find((m) => m.id === id)?.label ?? id),
                    items: list,
                  }))
                  .sort((a, b) => {
                    const ai = MEAL_ORDER.indexOf(a.label === "Sin etiquetar" ? "__sin__" : a.label.toLowerCase());
                    const bi = MEAL_ORDER.indexOf(b.label === "Sin etiquetar" ? "__sin__" : b.label.toLowerCase());
                    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
                  });
                dietGroups.set(k, sorted);
              }
            }
            return (
              <div key={p.id} className="mb-2 rounded-xl border border-edge bg-card p-3.5">
                <button
                  onClick={() => setOpenPlan(expanded ? null : p.id)}
                  className="flex w-full items-center justify-between text-left"
                >
                  <div>
                    <p className="font-semibold text-ink">{p.title}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <span className={`rounded-full border px-2 py-0.5 text-[11px] ${isNutrition ? "border-ember/40 bg-ember/10 text-ember" : "border-neon/40 bg-neon/10 text-neon"}`}>
                        {isNutrition ? "Alimentación" : "Entrenamiento"}
                      </span>
                    </div>
                  </div>
                  <ChevronDown className={`h-4 w-4 text-muted transition ${expanded ? "rotate-180" : ""}`} />
                </button>
                {p.content && isNutrition && (
                  <div className="mt-3 rounded-xl border border-ember/20 bg-ember/5 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-ember">Guía nutricional</p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-ink">{p.content}</p>
                  </div>
                )}
                {expanded && (
                  <div className="mt-3 border-t border-edge pt-3">
                    {isNutrition ? (
                      [...dietGroups.entries()].map(([day, meals]) => (
                        <div key={day} className="mb-2">
                          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted">
                            {day === 0 ? "General" : `Comidas del día ${day}`}
                          </p>
                          {meals.map((m) => (
                            <div key={m.label} className="mb-2">
                              <p className="mb-1 text-[11px] font-semibold text-ember">{m.label}</p>
                              {m.items.map((it) => {
                                const d = getDietData(it.data);
                                return (
                                  <div key={it.id} className="rounded-lg border-b border-edge py-2">
                                    <p className="text-sm font-medium text-ink">{it.exercise}</p>
                                    <p className="text-xs text-muted">
                                      {formatQuantity(d) && (
                                        <>{formatQuantity(d)}{d.kcal ? ` · ${d.kcal} kcal` : ""}</>
                                      )}
                                      {(d.protein_g || d.fat_g || d.carbs_g) && (
                                        <> · P {d.protein_g ?? "—"}g · G {d.fat_g ?? "—"}g · C {d.carbs_g ?? "—"}g</>
                                      )}
                                      {it.notes ? ` · ${it.notes}` : ""}
                                    </p>
                                  </div>
                                );
                              })}
                            </div>
                          ))}
                        </div>
                      ))
                    ) : (
                      [...groups.entries()].map(([day, dayItems]) => (
                        <div key={day} className="mb-2">
                          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted">
                            {day === 0 ? "General" : `Día ${day}`}
                          </p>
                          {dayItems.map((it) => (
                            <div key={it.id} className="rounded-lg border-b border-edge py-2">
                              <p className="text-sm font-medium text-ink">{it.exercise}</p>
                              <p className="text-xs text-muted">
                                {it.sets ?? "—"}×{it.reps ?? "—"}
                                {it.rest_seconds ? ` · ${it.rest_seconds}s` : ""}
                                {it.notes ? ` · ${it.notes}` : ""}
                              </p>
                            </div>
                          ))}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ─── RUTINAS ─── */}
      {tab === "rutinas" && (
        <div className="mt-4">
          {routines.length === 0 && (
            <p className="py-8 text-center text-sm text-muted">Tu profe todavía no te asignó rutinas.</p>
          )}

          {routines.map((r) => {
            const rItems = routineItems
              .filter((ri) => ri.routine_id === r.id)
              .sort((a, b) => a.day - b.day || a.position - b.position);
            const dayGroups = new Map<number, { label: string | null; items: RoutineItem[] }>();
            rItems.forEach((ri) => {
              if (!dayGroups.has(ri.day)) dayGroups.set(ri.day, { label: ri.day_label, items: [] });
              dayGroups.get(ri.day)!.items.push(ri);
            });
            const totalDays = dayGroups.size;
            const daysWithLogs = new Set(
              routineLogs
                .filter((l) => l.routine_id === r.id)
                .map((l) => l.day)
            ).size;
            const progressPct = totalDays > 0 ? Math.round((daysWithLogs / totalDays) * 100) : 0;
            const isExpanded = selectedRoutine === r.id;
            const fields = getDisciplineFields(r.discipline, r.custom_fields ?? undefined);
            const dayItems = rItems.filter((ri) => ri.day === selectedDay && r.id === selectedRoutine);
            const todayStr = todayLocal();
            const todayLogs = routineLogs.filter(
              (l) => l.routine_id === r.id && l.day === selectedDay && l.log_date === todayStr
            );
            const hasLogsToday = todayLogs.length > 0;

            return (
              <div key={r.id} className="mb-3 rounded-xl border border-edge bg-card p-3.5">
                <button
                  onClick={() => {
                    setSelectedRoutine(isExpanded ? null : r.id);
                    setSelectedDay(1);
                  }}
                  className="flex w-full items-start justify-between gap-2 text-left"
                >
                  <div>
                    <p className="font-semibold text-ink">{r.title}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      {r.discipline && (
                        <span className="rounded-full border border-neon/40 bg-neon/10 px-2 py-0.5 text-[11px] text-neon">
                          {r.discipline.replace(/_/g, " ")}
                        </span>
                      )}
                      <span className="text-[11px] text-muted">{totalDays} días</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-edge">
                        <div
                          className="h-full rounded-full bg-neon transition-all"
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                      <p className="mt-0.5 text-[10px] text-muted">{daysWithLogs}/{totalDays}</p>
                    </div>
                    <ChevronDown className={`h-4 w-4 text-muted transition ${isExpanded ? "rotate-180" : ""}`} />
                  </div>
                </button>

                {isExpanded && (
                  <div className="mt-3 border-t border-edge pt-3">
                    <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1">
                      {[...dayGroups.entries()].map(([day, { label }]) => {
                        const hasLog = routineLogs.some((l) => l.routine_id === r.id && l.day === day && l.log_date === todayStr);
                        return (
                          <button
                            key={day}
                            onClick={() => setSelectedDay(day)}
                            className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                              selectedDay === day && isExpanded
                                ? hasLog
                                  ? "bg-neon text-bg"
                                  : "border border-neon bg-neon/10 text-neon"
                                : hasLog
                                  ? "border border-neon/30 bg-neon/5 text-neon"
                                  : "border border-edge bg-card text-muted"
                            }`}
                          >
                            Día {day}{label ? `: ${label}` : ""}
                          </button>
                        );
                      })}
                    </div>

                    {dayItems.length === 0 ? (
                      <p className="py-4 text-center text-sm text-muted">Sin ejercicios para este día.</p>
                    ) : (
                      <>
                        <div className="space-y-2">
                          {dayItems.map((ri) => {
                            const existingLog = todayLogs.find((l) => l.item_id === ri.id);
                            const seriesDiscipline = isSeriesDiscipline(r.discipline);
                            const plannedSeries = seriesDiscipline
                              ? resolveSeries(ri.data, r.discipline)
                              : [];
                            const entries: SeriesEntry[] = seriesLogs[ri.id]
                              ? seriesLogs[ri.id]
                              : plannedSeries.map((s, i) => ({
                                  done: Array.isArray(existingLog?.data?.series)
                                    ? ((existingLog.data.series as unknown as SeriesEntry[])[i]?.done ?? false)
                                    : false,
                                  weight_kg: Array.isArray(existingLog?.data?.series)
                                    ? ((existingLog.data.series as unknown as SeriesEntry[])[i]?.weight_kg ?? (s.weight_kg ?? null))
                                    : (s.weight_kg ?? null),
                                }));
                            const doneCount = entries.filter((e) => e.done).length;

                            const toggleSeries = (sIdx: number) => {
                              setSeriesLogs((prev) => ({
                                ...prev,
                                [ri.id]: entries.map((e, k) =>
                                  k === sIdx ? { ...e, done: !e.done } : e
                                ),
                              }));
                            };
                            const setSeriesWeight = (sIdx: number, val: string) => {
                              setSeriesLogs((prev) => ({
                                ...prev,
                                [ri.id]: entries.map((e, k) =>
                                  k === sIdx ? { ...e, weight_kg: val === "" ? null : Number(val) } : e
                                ),
                              }));
                            };

                            const plannedSummary = fields
                              .filter((f) => ri.data?.[f.key] != null && ri.data[f.key] !== "")
                              .map((f) => {
                                const v = ri.data[f.key];
                                if (f.key === "weight_kg") return `${v}kg`;
                                if (f.key === "rest_seconds" || f.key === "hold_seconds" || f.key === "work_sec" || f.key === "rest_sec" || f.key === "round_duration_sec") return `${v}s`;
                                if (f.key === "distance_km") return `${v}km`;
                                if (f.key === "distance_m") return `${v}m`;
                                if (f.key === "duration_min") return `${v}min`;
                                return String(v);
                              })
                              .join(" · ");

                            return (
                              <div key={ri.id} className="rounded-lg border border-edge bg-bg p-2.5">
                                <div className="flex items-start justify-between">
                                  <div className="min-w-0">
                                    <p className="text-sm font-medium text-ink">{ri.exercise}</p>
                                    {seriesDiscipline ? (
                                      plannedSeries.length > 0
                                        ? (
                                          <p className="text-[11px] text-muted">
                                            {doneCount}/{plannedSeries.length} series hechas
                                          </p>
                                        )
                                        : (
                                          <p className="text-[11px] text-muted">Sin series todavía</p>
                                        )
                                    ) : (
                                      plannedSummary && (
                                        <p className="text-[11px] text-muted">Plan: {plannedSummary}</p>
                                      )
                                    )}
                                  </div>
                                  <button
                                    onClick={() => loadProgress(r.id, ri.exercise)}
                                    className="shrink-0 rounded p-1 text-muted hover:text-neon"
                                    title="Ver progreso"
                                  >
                                    <TrendingUp className="h-3.5 w-3.5" />
                                  </button>
                                </div>

                                {seriesDiscipline ? (
                                  <div className="mt-2 space-y-1">
                                    {plannedSeries.map((s, sIdx) => (
                                      <div
                                        key={sIdx}
                                        className={`flex items-center gap-2 rounded-lg border py-1.5 pl-2 pr-1.5 ${
                                          entries[sIdx]?.done
                                            ? "border-neon/40 bg-neon/5"
                                            : "border-edge bg-card"
                                        }`}
                                      >
                                        <button
                                          onClick={() => toggleSeries(sIdx)}
                                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border text-[10px] font-bold transition ${
                                            entries[sIdx]?.done
                                              ? "border-neon bg-neon text-bg"
                                              : "border-edge text-muted"
                                          }`}
                                        >
                                          {entries[sIdx]?.done ? "✓" : ""}
                                        </button>
                                        <span className="w-6 shrink-0 text-[10px] font-semibold text-neon">
                                          S{sIdx + 1}
                                        </span>
                                        <span className="min-w-0 flex-1 truncate text-[11px] text-muted">
                                          {formatSeries(s)}
                                        </span>
                                        <label className="flex shrink-0 items-center gap-1 text-[10px] text-muted">
                                          Peso
                                          <input
                                            type="number"
                                            inputMode="decimal"
                                            step="0.5"
                                            value={entries[sIdx]?.weight_kg != null ? String(entries[sIdx].weight_kg) : ""}
                                            onChange={(e) => setSeriesWeight(sIdx, e.target.value)}
                                            placeholder={s.weight_kg != null ? String(s.weight_kg) : "—"}
                                            className="w-14 rounded border border-edge bg-card px-1.5 py-0.5 text-[11px] text-ink placeholder:text-muted focus:border-neon focus:outline-none"
                                          />
                                        </label>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  fields.length > 0 && (
                                    <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                                      {fields.map((field) => (
                                        <div key={field.key}>
                                          <label className="text-[10px] text-muted">{field.label}</label>
                                          {field.type === "select" && field.options ? (
                                            <select
                                              value={String(logValues[ri.id]?.[field.key] ?? existingLog?.data[field.key] ?? "")}
                                              onChange={(e) =>
                                                setLogValues((prev) => ({
                                                  ...prev,
                                                  [ri.id]: { ...prev[ri.id], [field.key]: e.target.value },
                                                }))
                                              }
                                              className="mt-0.5 w-full rounded border border-edge bg-card px-2 py-1 text-[11px] text-ink focus:border-neon focus:outline-none"
                                            >
                                              <option value="">—</option>
                                              {field.options.map((o) => (
                                                <option key={o} value={o}>{o}</option>
                                              ))}
                                            </select>
                                          ) : (
                                            <input
                                              type={field.type === "number" ? "number" : "text"}
                                              value={String(logValues[ri.id]?.[field.key] ?? existingLog?.data[field.key] ?? "")}
                                              onChange={(e) =>
                                                setLogValues((prev) => ({
                                                  ...prev,
                                                  [ri.id]: {
                                                    ...prev[ri.id],
                                                    [field.key]: field.type === "number"
                                                      ? (e.target.value ? Number(e.target.value) : "")
                                                      : e.target.value,
                                                  },
                                                }))
                                              }
                                              placeholder={field.label}
                                              className="mt-0.5 w-full rounded border border-edge bg-card px-2 py-1 text-[11px] text-ink placeholder:text-muted focus:border-neon focus:outline-none"
                                            />
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  )
                                )}
                              </div>
                            );
                          })}
                        </div>

                        <button
                          onClick={() => saveLogs(r.id, selectedDay)}
                          className="mt-3 w-full rounded-lg bg-neon py-2.5 text-sm font-semibold text-bg shadow-neon"
                        >
                          {hasLogsToday ? "Actualizar registro" : "Registrar sesión"}
                        </button>
                      </>
                    )}
                  </div>
                )}

                {showProgress === r.id && (
                  <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60" onClick={() => setShowProgress(null)}>
                    <div className="w-full max-w-md rounded-t-2xl border border-edge bg-card p-4 pb-8" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-ink">{progressExercise}</p>
                          <p className="text-xs text-muted">Progreso histórico</p>
                        </div>
                        <button onClick={() => setShowProgress(null)} className="text-muted">✕</button>
                      </div>

                      {progressData.length === 0 ? (
                        <p className="py-8 text-center text-sm text-muted">Sin datos de progreso todavía.</p>
                      ) : (
                        <>
                          <div className="mt-4 h-48">
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={progressData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1e2530" />
                                <XAxis
                                  dataKey="date"
                                  tick={{ fill: "#6b7280", fontSize: 10 }}
                                  tickFormatter={(v) => v.slice(5)}
                                />
                                <YAxis tick={{ fill: "#6b7280", fontSize: 10 }} width={40} />
                                <Tooltip
                                  contentStyle={{ backgroundColor: "#161b22", border: "1px solid #1e2530", borderRadius: 8, fontSize: 12 }}
                                  labelStyle={{ color: "#9ca3af" }}
                                />
                                <Line
                                  type="monotone"
                                  dataKey="value"
                                  stroke="#00f2fe"
                                  strokeWidth={2}
                                  dot={{ fill: "#00f2fe", r: 3 }}
                                  activeDot={{ r: 5 }}
                                />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>

                          <div className="mt-3 grid grid-cols-3 gap-2">
                            <div className="rounded-lg border border-edge bg-bg p-2 text-center">
                              <Award className="mx-auto h-4 w-4 text-ember" />
                              <p className="mt-0.5 text-xs font-bold text-ink">
                                {Math.max(...progressData.map((d) => d.value))}
                              </p>
                              <p className="text-[10px] text-muted">PR</p>
                            </div>
                            <div className="rounded-lg border border-edge bg-bg p-2 text-center">
                              <TrendingUp className="mx-auto h-4 w-4 text-neon" />
                              <p className="mt-0.5 text-xs font-bold text-ink">
                                {(progressData.reduce((s, d) => s + d.value, 0) / progressData.length).toFixed(1)}
                              </p>
                              <p className="text-[10px] text-muted">Promedio</p>
                            </div>
                            <div className="rounded-lg border border-edge bg-bg p-2 text-center">
                              <Calendar className="mx-auto h-4 w-4 text-muted" />
                              <p className="mt-0.5 text-xs font-bold text-ink">{progressData.length}</p>
                              <p className="text-[10px] text-muted">Sesiones</p>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ─── CHAT ─── */}
      {tab === "chat" && (
        <div className="mt-4">
          <div className="flex h-[50vh] flex-col rounded-xl border border-edge bg-card p-3">
            <div className="flex-1 space-y-2 overflow-y-auto">
              {messages.length === 0 && (
                <p className="py-8 text-center text-sm text-muted">Escribile a tu profe, te responde acá.</p>
              )}
              {messages.map((m) => {
                const mine = m.sender_id === userId;
                return (
                  <div
                    key={m.id}
                    className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${
                      mine ? "ml-auto bg-neon text-bg" : "bg-elevated text-ink"
                    }`}
                  >
                    {m.content}
                  </div>
                );
              })}
            </div>
            <div className="mt-2 flex items-center gap-2 border-t border-edge pt-2">
              <input
                value={msgText}
                onChange={(e) => setMsgText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
                placeholder="Escribí un mensaje…"
                className="flex-1 rounded-lg border border-edge bg-bg px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-neon focus:outline-none"
              />
              <button onClick={send} className="rounded-lg bg-neon p-2.5 text-bg shadow-neon">
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
