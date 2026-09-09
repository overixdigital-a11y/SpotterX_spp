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
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuthState } from "@/lib/auth-context";
import { formatDay, todayLocal } from "@/lib/format";
import { DueBadge } from "@/components/training/DueBadge";

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
}

interface Routine {
  id: string;
  plan_id: string | null;
  title: string;
  description: string | null;
  done: boolean;
  due_on: string | null;
  completed_at: string | null;
  created_at: string;
}

interface Msg {
  id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  read: boolean;
  created_at: string;
}

function todayDow(): number {
  const d = new Date();
  return ((d.getDay() + 6) % 7) + 1;
}

export default function MiEntrenamientoPage() {
  const { userId } = useAuthState();
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [trainerId, setTrainerId] = useState<string | null>(null);
  const [tab, setTab] = useState<"planes" | "rutinas" | "chat">("planes");
  const [plans, setPlans] = useState<Plan[]>([]);
  const [items, setItems] = useState<PlanItem[]>([]);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [msgText, setMsgText] = useState("");
  const [loading, setLoading] = useState(true);
  const [openPlan, setOpenPlan] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

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
    return () => {
      active = false;
    };
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
    };

    loadData();

    const channel = supabase
      .channel(`mi-ent-${trainerId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `recipient_id=eq.${userId}` }, () => loadData())
      .on("postgres_changes", { event: "*", schema: "public", table: "trainer_routines", filter: `trainer_id=eq.${trainerId}` }, () => loadData())
      .on("postgres_changes", { event: "*", schema: "public", table: "trainer_plans", filter: `trainer_id=eq.${trainerId}` }, () => loadData())
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [userId, trainerId]);

  const toggleRoutine = async (r: Routine) => {
    const nextDone = !r.done;
    await createClient()
      .from("trainer_routines")
      .update({ done: nextDone, completed_at: nextDone ? new Date().toISOString() : null })
      .eq("id", r.id);
    setRoutines((prev) =>
      prev.map((x) =>
        x.id === r.id
          ? { ...x, done: nextDone, completed_at: nextDone ? new Date().toISOString() : null }
          : x
      )
    );
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
  const sortedRoutines = [...routines].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    const da = a.due_on ?? "9999-12-31";
    const db = b.due_on ?? "9999-12-31";
    return da.localeCompare(db) || b.created_at.localeCompare(a.created_at);
  });
  const pending = sortedRoutines.filter((r) => !r.done);
  const completed = sortedRoutines.filter((r) => r.done);
  const todayCount = pending.filter((r) => r.due_on && r.due_on === todayLocal()).length;
  const currentDay = todayDow();
  const planMap = new Map(plans.map((p) => [p.id, p]));

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
        <div className="text-right">
          <p className="text-xs font-semibold text-neon">{pending.length} pendientes</p>
          <p className="text-xs text-muted">{completed.length} completadas</p>
        </div>
      </div>

      {todayCount > 0 && (
        <div className="mt-3 rounded-xl border border-neon/30 bg-neon/10 px-3.5 py-2.5 text-sm text-neon">
          Tenés {todayCount} rutina{todayCount === 1 ? "" : "s"} para hoy 💪
        </div>
      )}

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

      {tab === "planes" && (
        <div className="mt-4">
          {plans.length === 0 && (
            <p className="py-8 text-center text-sm text-muted">
              Tu profe todavía no te asignó planes.
            </p>
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
            const todayItems = planItems.filter(
              (i) => i.day === currentDay || i.day === 0
            );
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
                      {todayItems.length > 0 && (
                        <span className="rounded-full border border-ember/40 bg-ember/10 px-2 py-0.5 text-[11px] text-ember">
                          {todayItems.length} {isNutrition ? "comidas hoy" : "ejercicios hoy"}
                        </span>
                      )}
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
                {p.content && !isNutrition && (
                  <p className="mt-2 text-sm text-muted">{p.content}</p>
                )}

                {expanded && (
                  <div className="mt-3 border-t border-edge pt-3">
                    {planItems.length === 0 && (
                      <p className="pb-2 text-sm text-muted">
                        {isNutrition ? "Este plan todavía no tiene comidas." : "Este plan todavía no tiene ejercicios."}
                      </p>
                    )}
                    {[...groups.entries()].map(([day, dayItems]) => (
                      <div key={day} className="mb-2">
                        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted">
                          {day === 0 ? "General" : isNutrition ? `Comidas del día ${day}` : `Día ${day}`}
                        </p>
                        {dayItems.map((it) => (
                          <div key={it.id} className="rounded-lg border-b border-edge py-2">
                            <p className="text-sm font-medium text-ink">{it.exercise}</p>
                            {isNutrition ? (
                              <p className="text-xs text-muted">
                                {it.notes || "Sin detalles"}
                              </p>
                            ) : (
                              <p className="text-xs text-muted">
                                {it.sets ?? "—"}×{it.reps ?? "—"}
                                {it.rest_seconds ? ` · ${it.rest_seconds}s descanso` : ""}
                                {it.notes ? ` · ${it.notes}` : ""}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {tab === "rutinas" && (
        <div className="mt-4">
          {routines.length === 0 && (
            <p className="py-8 text-center text-sm text-muted">
              Tu profe todavía no te asignó rutinas.
            </p>
          )}

          {pending.length > 0 && (
            <>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">
                Pendientes
              </p>
              {pending.map((r) => (
                <div
                  key={r.id}
                  className="mb-2 flex items-center gap-3 rounded-xl border border-edge bg-card p-3.5"
                >
                  <button
                    onClick={() => toggleRoutine(r)}
                    aria-label="Marcar como hecha"
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-edge text-[10px] text-transparent transition hover:border-neon hover:text-neon"
                  >
                    ✓
                  </button>
                  <div className="flex-1">
                    <p className="text-sm text-ink">{r.title}</p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                      {r.due_on && <DueBadge due_on={r.due_on} done={r.done} />}
                      {r.plan_id && planMap.has(r.plan_id) && (
                        <span className="rounded-full border border-neon/30 bg-neon/5 px-2 py-0.5 text-[10px] text-neon">
                          {planMap.get(r.plan_id)?.title}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}

          {completed.length > 0 && (
            <>
              <p className="mb-2 mt-4 text-[11px] font-semibold uppercase tracking-wide text-muted">
                Completadas
              </p>
              {completed.slice(0, 20).map((r) => (
                <div
                  key={r.id}
                  className="mb-2 flex items-center gap-3 rounded-xl border border-edge bg-card p-3.5"
                >
                  <button
                    onClick={() => toggleRoutine(r)}
                    aria-label="Desmarcar"
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-neon bg-neon text-[10px] text-bg"
                  >
                    ✓
                  </button>
                  <div className="flex-1">
                    <p className="text-sm text-muted line-through">{r.title}</p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                      {r.completed_at && (
                        <span className="text-[11px] text-muted">
                          Hecha {formatDay(r.completed_at.slice(0, 10))}
                        </span>
                      )}
                      {r.plan_id && planMap.has(r.plan_id) && (
                        <span className="rounded-full border border-neon/30 bg-neon/5 px-2 py-0.5 text-[10px] text-neon">
                          {planMap.get(r.plan_id)?.title}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {tab === "chat" && (
        <div className="mt-4">
          <div className="flex h-[50vh] flex-col rounded-xl border border-edge bg-card p-3">
            <div className="flex-1 space-y-2 overflow-y-auto">
              {messages.length === 0 && (
                <p className="py-8 text-center text-sm text-muted">
                  Escribile a tu profe, te responde acá.
                </p>
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