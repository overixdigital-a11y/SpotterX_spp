"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Loader2, FileText, ListChecks, MessageCircle, Plus, Trash2, Send } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuthState } from "@/lib/auth-context";

interface StudentProfile {
  id: string;
  username: string;
  full_name: string | null;
  role: string;
}

interface Plan {
  id: string;
  title: string;
  kind: string;
  content: string | null;
}

interface Routine {
  id: string;
  title: string;
  description: string | null;
  done: boolean;
  due_on: string | null;
}

interface Msg {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
}

export default function AlumnoPage() {
  const params = useParams<{ id: string }>();
  const studentId = params.id;
  const { userId } = useAuthState();
  const [student, setStudent] = useState<StudentProfile | null>(null);
  const [tab, setTab] = useState<"planes" | "rutinas" | "chat">("planes");
  const [plans, setPlans] = useState<Plan[]>([]);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [msgText, setMsgText] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    const load = async () => {
      const { data: p } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", studentId)
        .maybeSingle();
      if (active && p) setStudent(p as StudentProfile);

      const [{ data: pl }, { data: rt }, { data: ms }] = await Promise.all([
        supabase
          .from("trainer_plans")
          .select("*")
          .eq("student_id", studentId)
          .order("created_at", { ascending: false }),
        supabase
          .from("trainer_routines")
          .select("*")
          .eq("student_id", studentId)
          .order("created_at", { ascending: false }),
        supabase
          .from("messages")
          .select("*")
          .or(`sender_id.eq.${studentId},recipient_id.eq.${studentId}`)
          .order("created_at", { ascending: true }),
      ]);

      if (!active) return;
      if (pl) setPlans(pl as Plan[]);
      if (rt) setRoutines(rt as Routine[]);
      if (ms) setMessages(ms as Msg[]);
      setLoading(false);
    };

    load();

    const channel = supabase
      .channel("alumno-chat")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `recipient_id=eq.${studentId},sender_id=eq.${studentId}`,
        },
        () => load()
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [studentId]);

  const addPlan = async () => {
    if (!userId) return;
    const title = window.prompt("Título del plan (ej: Plan 4x8 fuerza)");
    if (!title) return;
    const kind = window.prompt("Tipo (entrenamiento / alimentacion / general)", "entrenamiento") || "general";
    await createClient()
      .from("trainer_plans")
      .insert({ trainer_id: userId, student_id: studentId, title, kind, content: "" });
    const { data } = await createClient()
      .from("trainer_plans")
      .select("*")
      .eq("student_id", studentId)
      .order("created_at", { ascending: false });
    if (data) setPlans(data as Plan[]);
  };

  const deletePlan = async (id: string) => {
    if (!confirm("¿Eliminar este plan?")) return;
    await createClient().from("trainer_plans").delete().eq("id", id);
    setPlans((prev) => prev.filter((p) => p.id !== id));
  };

  const addRoutine = async () => {
    if (!userId) return;
    const title = window.prompt("Rutina / tarea (ej: 3x12 sentadilla)");
    if (!title) return;
    await createClient()
      .from("trainer_routines")
      .insert({ trainer_id: userId, student_id: studentId, title });
    const { data } = await createClient()
      .from("trainer_routines")
      .select("*")
      .eq("student_id", studentId)
      .order("created_at", { ascending: false });
    if (data) setRoutines(data as Routine[]);
  };

  const toggleRoutine = async (r: Routine) => {
    await createClient().from("trainer_routines").update({ done: !r.done }).eq("id", r.id);
    setRoutines((prev) => prev.map((x) => (x.id === r.id ? { ...x, done: !r.done } : x)));
  };

  const send = async () => {
    if (!userId || !msgText.trim()) return;
    const supabase = createClient();
    await supabase
      .from("messages")
      .insert({ sender_id: userId, recipient_id: studentId, content: msgText.trim() });
    setMsgText("");
    const { data } = await supabase
      .from("messages")
      .select("*")
      .or(`sender_id.eq.${studentId},recipient_id.eq.${studentId}`)
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

  return (
    <main className="mx-auto max-w-md px-4 pt-5">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-neon/20 text-base font-bold text-neon">
          {(student?.full_name || student?.username || "U").slice(0, 2).toUpperCase()}
        </div>
        <div>
          <h1 className="text-lg font-bold text-ink">
            {student?.full_name || student?.username}
          </h1>
          <p className="text-sm text-muted">@{student?.username}</p>
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
            onClick={() => setTab(key)}
            className={`flex items-center justify-center gap-1.5 rounded-lg py-2.5 text-sm font-semibold transition ${
              tab === key ? "bg-neon text-bg" : "text-muted"
            }`}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {tab === "planes" && (
        <div className="mt-4">
          <button
            onClick={addPlan}
            className="mb-3 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-edge bg-card py-3 text-sm font-medium text-neon"
          >
            <Plus className="h-4 w-4" /> Nuevo plan
          </button>
          {plans.length === 0 && (
            <p className="py-8 text-center text-sm text-muted">Sin planes todavía.</p>
          )}
          {plans.map((p) => (
            <div key={p.id} className="rounded-xl border border-edge bg-card p-3.5 mb-2">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-ink">{p.title}</p>
                  <span className="rounded-full border border-neon/40 bg-neon/10 px-2 py-0.5 text-[11px] text-neon">
                    {p.kind}
                  </span>
                </div>
                <button onClick={() => deletePlan(p.id)} className="text-muted hover:text-ember">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              {p.content && <p className="mt-2 text-sm text-muted">{p.content}</p>}
            </div>
          ))}
        </div>
      )}

      {tab === "rutinas" && (
        <div className="mt-4">
          <button
            onClick={addRoutine}
            className="mb-3 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-edge bg-card py-3 text-sm font-medium text-neon"
          >
            <Plus className="h-4 w-4" /> Nueva rutina
          </button>
          {routines.length === 0 && (
            <p className="py-8 text-center text-sm text-muted">Sin rutinas todavía.</p>
          )}
          {routines.map((r) => (
            <button
              key={r.id}
              onClick={() => toggleRoutine(r)}
              className="flex w-full items-center gap-3 rounded-xl border border-edge bg-card p-3.5 mb-2 text-left"
            >
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full border text-[10px] ${
                  r.done ? "border-neon bg-neon text-bg" : "border-edge text-transparent"
                }`}
              >
                ✓
              </span>
              <div>
                <p className={`text-sm ${r.done ? "text-muted line-through" : "text-ink"}`}>
                  {r.title}
                </p>
                {r.due_on && <p className="text-xs text-muted">Vence: {r.due_on}</p>}
              </div>
            </button>
          ))}
        </div>
      )}

      {tab === "chat" && (
        <div className="mt-4">
          <div className="flex h-[50vh] flex-col rounded-xl border border-edge bg-card p-3">
            <div className="flex-1 space-y-2 overflow-y-auto">
              {messages.length === 0 && (
                <p className="py-8 text-center text-sm text-muted">
                  Empezá la conversación.
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
