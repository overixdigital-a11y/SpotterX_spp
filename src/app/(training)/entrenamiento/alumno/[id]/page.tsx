"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams } from "next/navigation";
import {
  Loader2,
  FileText,
  ListChecks,
  MessageCircle,
  Plus,
  Trash2,
  Send,
  X,
  ChevronDown,
  LayoutTemplate,
  Copy,
  BookmarkPlus,
  GripVertical,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuthState } from "@/lib/auth-context";
import { DISCIPLINES, getDisciplineFields, type FieldDef } from "@/lib/disciplines";

interface StudentProfile {
  id: string;
  username: string;
  full_name: string | null;
}

interface Plan {
  id: string;
  title: string;
  kind: string;
  content: string | null;
  is_template: boolean | null;
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

interface RoutineDay {
  label: string;
  exercises: {
    exercise: string;
    data: Record<string, unknown>;
    notes: string;
  }[];
}

interface Msg {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
}

const KIND_LABEL: Record<string, string> = {
  entrenamiento: "Entrenamiento",
  alimentacion: "Alimentación",
  general: "General",
};

export default function AlumnoPage() {
  const params = useParams<{ id: string }>();
  const studentId = params.id;
  const { userId, profile } = useAuthState();
  const [student, setStudent] = useState<StudentProfile | null>(null);
  const [tab, setTab] = useState<"planes" | "rutinas" | "chat">("planes");
  const [plans, setPlans] = useState<Plan[]>([]);
  const [items, setItems] = useState<PlanItem[]>([]);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [routineItems, setRoutineItems] = useState<RoutineItem[]>([]);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [msgText, setMsgText] = useState("");
  const [loading, setLoading] = useState(true);

  const [planForm, setPlanForm] = useState<{ open: boolean; title: string; kind: string; content: string }>({
    open: false,
    title: "",
    kind: "entrenamiento",
    content: "",
  });
  const [openPlan, setOpenPlan] = useState<string | null>(null);
  const [itemForm, setItemForm] = useState<{
    planId: string | null;
    day: string;
    exercise: string;
    sets: string;
    reps: string;
    rest: string;
    notes: string;
  }>({ planId: null, day: "", exercise: "", sets: "", reps: "", rest: "", notes: "" });

  const [routineFormOpen, setRoutineFormOpen] = useState(false);
  const [routineForm, setRoutineForm] = useState({
    title: "",
    discipline: "" as string,
    customFields: [] as FieldDef[],
    customDisciplineName: "",
    days: [
      { label: "", exercises: [{ exercise: "", data: {}, notes: "" }] },
    ] as RoutineDay[],
  });
  const [editingRoutineId, setEditingRoutineId] = useState<string | null>(null);
  const [openRoutine, setOpenRoutine] = useState<string | null>(null);

  const [showTemplates, setShowTemplates] = useState(false);
  const [templates, setTemplates] = useState<Plan[]>([]);
  const [tplItems, setTplItems] = useState<PlanItem[]>([]);

  const profDisciplines = useMemo(() => {
    const stored = (profile as unknown as { disciplines?: string[] | null })?.disciplines;
    return Array.isArray(stored) ? stored : [];
  }, [profile]);

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    const load = async () => {
      const { data: p } = await supabase
        .from("profiles")
        .select("id, username, full_name")
        .eq("id", studentId)
        .maybeSingle();
      if (active && p) setStudent(p as StudentProfile);

      const { data: pl } = await supabase
        .from("trainer_plans")
        .select("*")
        .eq("student_id", studentId)
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
        .eq("student_id", studentId)
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
      }

      const { data: ms } = await supabase
        .from("messages")
        .select("*")
        .or(`sender_id.eq.${studentId},recipient_id.eq.${studentId}`)
        .order("created_at", { ascending: true });
      if (!active) return;
      if (ms) setMessages(ms as Msg[]);

      if (userId) {
        await supabase
          .from("messages")
          .update({ read: true })
          .eq("recipient_id", userId)
          .eq("sender_id", studentId)
          .eq("read", false);
      }

      setLoading(false);
    };

    load();

    const channel = supabase
      .channel(`alumno-${studentId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `recipient_id=eq.${userId}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "trainer_routines", filter: `student_id=eq.${studentId}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "trainer_routine_items" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "trainer_plans", filter: `student_id=eq.${studentId}` }, () => load())
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [studentId, userId]);

  const createPlan = async () => {
    if (!userId || !planForm.title.trim()) return;
    const supabase = createClient();
    const { data } = await supabase
      .from("trainer_plans")
      .insert({
        trainer_id: userId,
        student_id: studentId,
        title: planForm.title.trim(),
        kind: planForm.kind,
        content: planForm.content.trim() || null,
      })
      .select()
      .maybeSingle();
    if (data) setPlans((prev) => [data as Plan, ...prev]);
    setPlanForm({ open: false, title: "", kind: "entrenamiento", content: "" });
  };

  const deletePlan = async (id: string) => {
    if (!confirm("¿Eliminar este plan y todos sus ejercicios?")) return;
    await createClient().from("trainer_plans").delete().eq("id", id);
    setPlans((prev) => prev.filter((p) => p.id !== id));
    setItems((prev) => prev.filter((i) => i.plan_id !== id));
  };

  const openItemForm = (planId: string) => {
    setItemForm({ planId, day: "", exercise: "", sets: "", reps: "", rest: "", notes: "" });
  };

  const addItem = async () => {
    if (!itemForm.planId || !itemForm.exercise.trim()) return;
    const supabase = createClient();
    const position = items.filter((i) => i.plan_id === itemForm.planId).length;
    const { data } = await supabase
      .from("trainer_plan_items")
      .insert({
        plan_id: itemForm.planId,
        day: itemForm.day ? parseInt(itemForm.day, 10) : null,
        exercise: itemForm.exercise.trim(),
        sets: itemForm.sets ? parseInt(itemForm.sets, 10) : null,
        reps: itemForm.reps.trim() || null,
        rest_seconds: itemForm.rest ? parseInt(itemForm.rest, 10) : null,
        notes: itemForm.notes.trim() || null,
        position,
      })
      .select()
      .maybeSingle();
    if (data) setItems((prev) => [...prev, data as PlanItem]);
    setItemForm({ planId: null, day: "", exercise: "", sets: "", reps: "", rest: "", notes: "" });
  };

  const deleteItem = async (id: string) => {
    await createClient().from("trainer_plan_items").delete().eq("id", id);
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const openTemplates = async () => {
    if (!userId) return;
    const supabase = createClient();
    const { data } = await supabase
      .from("trainer_plans")
      .select("*")
      .eq("trainer_id", userId)
      .eq("is_template", true)
      .order("created_at", { ascending: false });
    if (data) setTemplates(data as Plan[]);
    const ids = (data as Plan[] | null)?.map((x) => x.id) ?? [];
    if (ids.length > 0) {
      const { data: it } = await supabase
        .from("trainer_plan_items")
        .select("*")
        .in("plan_id", ids);
      if (it) setTplItems(it as PlanItem[]);
    } else {
      setTplItems([]);
    }
    setShowTemplates(true);
  };

  const saveAsTemplate = async (id: string) => {
    await createClient().from("trainer_plans").update({ is_template: true }).eq("id", id);
    setPlans((prev) => prev.map((p) => (p.id === id ? { ...p, is_template: true } : p)));
  };

  const copyTemplate = async (tpl: Plan) => {
    if (!userId) return;
    const supabase = createClient();
    const srcItems = tplItems.filter((i) => i.plan_id === tpl.id);
    const { data } = await supabase
      .from("trainer_plans")
      .insert({
        trainer_id: userId,
        student_id: studentId,
        title: tpl.title,
        kind: tpl.kind,
        content: tpl.content,
      })
      .select()
      .maybeSingle();
    if (!data) return;
    const newPlan = data as Plan;
    if (srcItems.length > 0) {
      await supabase.from("trainer_plan_items").insert(
        srcItems.map((i) => ({
          plan_id: newPlan.id,
          day: i.day,
          exercise: i.exercise,
          sets: i.sets,
          reps: i.reps,
          rest_seconds: i.rest_seconds,
          notes: i.notes,
          position: i.position,
        }))
      );
      const { data: newIts } = await supabase
        .from("trainer_plan_items")
        .select("*")
        .eq("plan_id", newPlan.id);
      if (newIts) setItems((prev) => [...prev, ...(newIts as PlanItem[])]);
    }
    setPlans((prev) => [newPlan, ...prev]);
    setShowTemplates(false);
  };

  const resetRoutineForm = () => {
    setRoutineForm({
      title: "",
      discipline: "",
      customFields: [],
      customDisciplineName: "",
      days: [{ label: "", exercises: [{ exercise: "", data: {}, notes: "" }] }],
    });
    setEditingRoutineId(null);
  };

  const openEditRoutine = (r: Routine) => {
    const itemsForRoutine = routineItems
      .filter((ri) => ri.routine_id === r.id)
      .sort((a, b) => a.day - b.day || a.position - b.position);
    const dayMap = new Map<number, RoutineDay>();
    itemsForRoutine.forEach((ri) => {
      if (!dayMap.has(ri.day)) {
        dayMap.set(ri.day, { label: ri.day_label ?? "", exercises: [] });
      }
      dayMap.get(ri.day)!.exercises.push({
        exercise: ri.exercise,
        data: ri.data ?? {},
        notes: ri.notes ?? "",
      });
    });
    const days = dayMap.size > 0
      ? [...dayMap.entries()].sort((a, b) => a[0] - b[0]).map(([, d]) => d)
      : [{ label: "", exercises: [{ exercise: "", data: {}, notes: "" }] }];

    setRoutineForm({
      title: r.title,
      discipline: r.discipline ?? "",
      customFields: r.custom_fields ?? [],
      customDisciplineName: r.discipline === "otras" ? (r.custom_fields?.[0]?.label ?? "") : "",
      days,
    });
    setEditingRoutineId(r.id);
    setRoutineFormOpen(true);
  };

  const saveRoutine = async () => {
    if (!userId || !routineForm.title.trim()) return;
    const supabase = createClient();
    const discipline = routineForm.discipline || null;
    const customFields = routineForm.discipline === "otras" ? routineForm.customFields : null;

    let routineId = editingRoutineId;

    if (editingRoutineId) {
      await supabase
        .from("trainer_routines")
        .update({ title: routineForm.title.trim(), discipline, custom_fields: customFields })
        .eq("id", editingRoutineId);
      await supabase.from("trainer_routine_items").delete().eq("routine_id", editingRoutineId);
    } else {
      const { data } = await supabase
        .from("trainer_routines")
        .insert({
          trainer_id: userId,
          student_id: studentId,
          title: routineForm.title.trim(),
          discipline,
          custom_fields: customFields,
        })
        .select()
        .maybeSingle();
      if (!data) return;
      routineId = (data as Routine).id;
      setRoutines((prev) => [data as Routine, ...prev]);
    }

    if (routineId) {
      const allItems: {
        routine_id: string;
        day: number;
        day_label: string | null;
        exercise: string;
        position: number;
        notes: string | null;
        data: Record<string, unknown>;
      }[] = [];
      routineForm.days.forEach((day, dayIdx) => {
        day.exercises.forEach((ex, exIdx) => {
          if (ex.exercise.trim()) {
            allItems.push({
              routine_id: routineId!,
              day: dayIdx + 1,
              day_label: day.label.trim() || null,
              exercise: ex.exercise.trim(),
              position: exIdx,
              notes: ex.notes.trim() || null,
              data: ex.data,
            });
          }
        });
      });
      if (allItems.length > 0) {
        await supabase.from("trainer_routine_items").insert(allItems);
      }

      if (editingRoutineId) {
        setRoutines((prev) =>
          prev.map((r) =>
            r.id === editingRoutineId
              ? { ...r, title: routineForm.title.trim(), discipline, custom_fields: customFields }
              : r
          )
        );
      }

      const { data: freshItems } = await supabase
        .from("trainer_routine_items")
        .select("*")
        .eq("routine_id", routineId)
        .order("day", { ascending: true })
        .order("position", { ascending: true });
      if (freshItems) {
        if (editingRoutineId) {
          setRoutineItems((prev) => [
            ...prev.filter((ri) => ri.routine_id !== editingRoutineId),
            ...(freshItems as unknown as RoutineItem[]),
          ]);
        } else {
          setRoutineItems((prev) => [...prev, ...(freshItems as unknown as RoutineItem[])]);
        }
      }
    }

    resetRoutineForm();
    setRoutineFormOpen(false);
  };

  const deleteRoutine = async (id: string) => {
    if (!confirm("¿Eliminar esta rutina y todos sus ejercicios?")) return;
    await createClient().from("trainer_routines").delete().eq("id", id);
    setRoutines((prev) => prev.filter((r) => r.id !== id));
    setRoutineItems((prev) => prev.filter((ri) => ri.routine_id !== id));
  };

  const addRoutineDay = () => {
    setRoutineForm((prev) => ({
      ...prev,
      days: [...prev.days, { label: "", exercises: [{ exercise: "", data: {}, notes: "" }] }],
    }));
  };

  const removeRoutineDay = (dayIdx: number) => {
    setRoutineForm((prev) => ({
      ...prev,
      days: prev.days.filter((_, i) => i !== dayIdx),
    }));
  };

  const addExerciseToDay = (dayIdx: number) => {
    setRoutineForm((prev) => ({
      ...prev,
      days: prev.days.map((d, i) =>
        i === dayIdx
          ? { ...d, exercises: [...d.exercises, { exercise: "", data: {}, notes: "" }] }
          : d
      ),
    }));
  };

  const removeExerciseFromDay = (dayIdx: number, exIdx: number) => {
    setRoutineForm((prev) => ({
      ...prev,
      days: prev.days.map((d, i) =>
        i === dayIdx
          ? { ...d, exercises: d.exercises.filter((_, j) => j !== exIdx) }
          : d
      ),
    }));
  };

  const updateExerciseField = (dayIdx: number, exIdx: number, field: string, value: unknown) => {
    setRoutineForm((prev) => ({
      ...prev,
      days: prev.days.map((d, i) =>
        i === dayIdx
          ? {
              ...d,
              exercises: d.exercises.map((ex, j) =>
                j === exIdx ? { ...ex, data: { ...ex.data, [field]: value } } : ex
              ),
            }
          : d
      ),
    }));
  };

  const routineFields: FieldDef[] = useMemo(() => {
    if (routineForm.discipline === "otras") return routineForm.customFields;
    return getDisciplineFields(routineForm.discipline);
  }, [routineForm.discipline, routineForm.customFields]);

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

      {/* ─── PLANES ─── */}
      {tab === "planes" && (
        <div className="mt-4">
          <div className="mb-3 grid grid-cols-2 gap-2">
            <button
              onClick={() => setPlanForm((v) => ({ ...v, open: !v.open }))}
              className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-edge bg-card py-3 text-sm font-medium text-neon"
            >
              <Plus className="h-4 w-4" /> Nuevo plan
            </button>
            <button
              onClick={openTemplates}
              className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-ember/50 bg-card py-3 text-sm font-medium text-ember"
            >
              <LayoutTemplate className="h-4 w-4" /> Plantillas
            </button>
          </div>

          {planForm.open && (
            <div className="mb-3 space-y-2 rounded-xl border border-neon/30 bg-card p-3">
              <input
                value={planForm.title}
                onChange={(e) => setPlanForm((v) => ({ ...v, title: e.target.value }))}
                placeholder="Título (ej: 4x8 fuerza)"
                className="w-full rounded-lg border border-edge bg-bg px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-neon focus:outline-none"
              />
              <select
                value={planForm.kind}
                onChange={(e) => setPlanForm((v) => ({ ...v, kind: e.target.value }))}
                className="w-full rounded-lg border border-edge bg-bg px-3 py-2 text-sm text-ink focus:border-neon focus:outline-none"
              >
                <option value="entrenamiento">Entrenamiento</option>
                <option value="alimentacion">Alimentación</option>
                <option value="general">General</option>
              </select>
              <textarea
                value={planForm.content}
                onChange={(e) => setPlanForm((v) => ({ ...v, content: e.target.value }))}
                placeholder={
                  planForm.kind === "alimentacion"
                    ? "Guía nutricional (ej: Desayuno: avenida + banana + huevos | Almuerzo: pollo + arroz + ensalada | Merienda: yogur + fruta)"
                    : "Descripción / notas del plan (opcional)"
                }
                rows={planForm.kind === "alimentacion" ? 4 : 2}
                className="w-full resize-none rounded-lg border border-edge bg-bg px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-neon focus:outline-none"
              />
              <div className="flex gap-2">
                <button
                  onClick={createPlan}
                  disabled={!planForm.title.trim()}
                  className="grow rounded-lg bg-neon py-2.5 text-sm font-semibold text-bg shadow-neon disabled:opacity-50"
                >
                  Crear plan
                </button>
                <button
                  onClick={() => setPlanForm((v) => ({ ...v, open: false }))}
                  className="rounded-lg border border-edge px-3 text-muted transition hover:text-ink"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {plans.length === 0 && (
            <p className="py-8 text-center text-sm text-muted">Sin planes todavía.</p>
          )}

          {plans.map((p) => {
            const planItems = items
              .filter((i) => i.plan_id === p.id)
              .sort((a, b) => (a.day ?? 0) - (b.day ?? 0) || a.position - b.position);
            const expanded = openPlan === p.id;
            const groups = new Map<number, PlanItem[]>();
            planItems.forEach((i) => {
              const k = i.day ?? 0;
              groups.set(k, [...(groups.get(k) ?? []), i]);
            });
            return (
              <div key={p.id} className="mb-2 rounded-xl border border-edge bg-card p-3.5">
                <button
                  onClick={() => setOpenPlan(expanded ? null : p.id)}
                  className="flex w-full items-start justify-between gap-2 text-left"
                >
                  <div>
                    <p className="font-semibold text-ink">{p.title}</p>
                    <span className="rounded-full border border-neon/40 bg-neon/10 px-2 py-0.5 text-[11px] text-neon">
                      {KIND_LABEL[p.kind] ?? p.kind}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    {!expanded && <span className="text-[11px] text-muted">{planItems.length} ej.</span>}
                    <ChevronDown className={`h-4 w-4 text-muted transition ${expanded ? "rotate-180" : ""}`} />
                  </div>
                </button>
                <div className="mt-2 flex items-center justify-between pr-1">
                  <div className="flex flex-wrap items-center gap-2 pr-8">
                    {p.content ? <p className="text-sm text-muted">{p.content}</p> : null}
                    {p.is_template && (
                      <span className="rounded-full border border-ember/40 bg-ember/10 px-2 py-0.5 text-[11px] font-medium text-ember">
                        Plantilla
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {!p.is_template && (
                      <button onClick={() => saveAsTemplate(p.id)} title="Guardar como plantilla" className="text-muted transition hover:text-ember">
                        <BookmarkPlus className="h-4 w-4" />
                      </button>
                    )}
                    <button onClick={() => deletePlan(p.id)} className="text-muted hover:text-ember">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {expanded && (
                  <div className="mt-3 border-t border-edge pt-3">
                    {planItems.length === 0 && (
                      <p className="pb-2 text-sm text-muted">Sin ejercicios. Agregá el primero abajo.</p>
                    )}
                    {[...groups.entries()].map(([day, dayItems]) => (
                      <div key={day} className="mb-2">
                        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted">
                          {day === 0 ? "General" : `Día ${day}`}
                        </p>
                        {dayItems.map((it) => (
                          <div key={it.id} className="mb-1 flex items-start gap-2 rounded-lg border-b border-edge py-2">
                            <div className="flex-1">
                              <p className="text-sm font-medium text-ink">{it.exercise}</p>
                              <p className="text-xs text-muted">
                                {it.sets ?? "—"}×{it.reps ?? "—"}
                                {it.rest_seconds ? ` · ${it.rest_seconds}s` : ""}
                                {it.notes ? ` · ${it.notes}` : ""}
                              </p>
                            </div>
                            <button onClick={() => deleteItem(it.id)} className="text-muted hover:text-ember">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    ))}

                    {itemForm.planId === p.id ? (
                      <div className="mt-2 space-y-2 rounded-lg border border-edge bg-bg p-3">
                        <div className="flex gap-2">
                          <input
                            value={itemForm.day}
                            onChange={(e) => setItemForm((v) => ({ ...v, day: e.target.value }))}
                            placeholder="Día"
                            type="number"
                            min={1}
                            className="w-16 rounded-lg border border-edge bg-card px-2 py-1.5 text-sm text-ink placeholder:text-muted focus:border-neon focus:outline-none"
                          />
                          <input
                            value={itemForm.exercise}
                            onChange={(e) => setItemForm((v) => ({ ...v, exercise: e.target.value }))}
                            placeholder="Ejercicio (ej: sentadilla)"
                            className="grow rounded-lg border border-edge bg-card px-3 py-1.5 text-sm text-ink placeholder:text-muted focus:border-neon focus:outline-none"
                          />
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <input
                            value={itemForm.sets}
                            onChange={(e) => setItemForm((v) => ({ ...v, sets: e.target.value }))}
                            placeholder="Series"
                            type="number"
                            min={1}
                            className="rounded-lg border border-edge bg-card px-3 py-1.5 text-sm text-ink placeholder:text-muted focus:border-neon focus:outline-none"
                          />
                          <input
                            value={itemForm.reps}
                            onChange={(e) => setItemForm((v) => ({ ...v, reps: e.target.value }))}
                            placeholder="Reps (ej: 10-12)"
                            className="rounded-lg border border-edge bg-card px-3 py-1.5 text-sm text-ink placeholder:text-muted focus:border-neon focus:outline-none"
                          />
                          <input
                            value={itemForm.rest}
                            onChange={(e) => setItemForm((v) => ({ ...v, rest: e.target.value }))}
                            placeholder="Descanso s"
                            type="number"
                            min={0}
                            className="rounded-lg border border-edge bg-card px-3 py-1.5 text-sm text-ink placeholder:text-muted focus:border-neon focus:outline-none"
                          />
                        </div>
                        <input
                          value={itemForm.notes}
                          onChange={(e) => setItemForm((v) => ({ ...v, notes: e.target.value }))}
                          placeholder="Nota (opcional)"
                          className="w-full rounded-lg border border-edge bg-card px-3 py-1.5 text-sm text-ink placeholder:text-muted focus:border-neon focus:outline-none"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={addItem}
                            disabled={!itemForm.exercise.trim()}
                            className="grow rounded-lg bg-neon py-2 text-xs font-semibold text-bg shadow-neon disabled:opacity-50"
                          >
                            Agregar ejercicio
                          </button>
                          <button onClick={() => setItemForm((v) => ({ ...v, planId: null }))} className="rounded-lg border border-edge px-3 text-muted">
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => openItemForm(p.id)} className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-neon">
                        <Plus className="h-3.5 w-3.5" /> Agregar ejercicio
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ─── TEMPLATES BOTTOM SHEET ─── */}
      {showTemplates && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60" onClick={() => setShowTemplates(false)}>
          <div className="w-full max-w-md rounded-t-2xl border border-edge bg-card p-4 pb-8" onClick={(e) => e.stopPropagation()}>
            <p className="font-semibold text-ink">Tus plantillas</p>
            <p className="mt-0.5 text-xs text-muted">Guardá un plan tocando el ícono de guardado y reusalo en cualquier alumno.</p>
            <div className="mt-3 max-h-72 space-y-2 overflow-y-auto">
              {templates.length === 0 && <p className="py-6 text-center text-sm text-muted">Todavía no guardaste plantillas.</p>}
              {templates.map((t) => (
                <div key={t.id} className="flex items-center gap-3 rounded-xl border border-edge bg-bg p-3">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-ink">{t.title}</p>
                    <span className="rounded-full border border-neon/40 bg-neon/10 px-2 py-0.5 text-[11px] text-neon">
                      {KIND_LABEL[t.kind] ?? t.kind}
                    </span>
                  </div>
                  {tplItems.filter((i) => i.plan_id === t.id).length > 0 && (
                    <span className="text-xs text-muted">{tplItems.filter((i) => i.plan_id === t.id).length} ej.</span>
                  )}
                  <button onClick={() => copyTemplate(t)} className="flex items-center gap-1 rounded-lg bg-ember px-3 py-1.5 text-xs font-semibold text-bg">
                    <Copy className="h-3.5 w-3.5" /> Usar
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─── RUTINAS ─── */}
      {tab === "rutinas" && (
        <div className="mt-4">
          <button
            onClick={() => { resetRoutineForm(); setRoutineFormOpen(!routineFormOpen); }}
            className="mb-3 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-edge bg-card py-3 text-sm font-medium text-neon"
          >
            <Plus className="h-4 w-4" /> {editingRoutineId ? "Editar rutina" : "Nueva rutina"}
          </button>

          {routineFormOpen && (
            <div className="mb-3 space-y-3 rounded-xl border border-neon/30 bg-card p-3">
              <input
                value={routineForm.title}
                onChange={(e) => setRoutineForm((v) => ({ ...v, title: e.target.value }))}
                placeholder="Nombre de la rutina (ej: Programa Fuerza)"
                className="w-full rounded-lg border border-edge bg-bg px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-neon focus:outline-none"
              />

              <div>
                <label className="text-xs font-medium text-muted">Disciplina</label>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {profDisciplines.length > 0 && profDisciplines.map((dId) => {
                    const disc = DISCIPLINES.find((d) => d.id === dId);
                    if (!disc) return (
                      <button
                        key={dId}
                        type="button"
                        onClick={() => setRoutineForm((v) => ({ ...v, discipline: dId }))}
                        className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
                          routineForm.discipline === dId
                            ? "border-neon bg-neon/15 text-neon"
                            : "border-edge bg-card text-muted"
                        }`}
                      >
                        {dId.replace(/_/g, " ")}
                      </button>
                    );
                    return (
                      <button
                        key={dId}
                        type="button"
                        onClick={() => setRoutineForm((v) => ({ ...v, discipline: dId }))}
                        className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
                          routineForm.discipline === dId
                            ? "border-neon bg-neon/15 text-neon"
                            : "border-edge bg-card text-muted"
                        }`}
                      >
                        {disc.label}
                      </button>
                    );
                  })}
                  {profDisciplines.length === 0 && DISCIPLINES.filter((d) => d.id !== "otras").map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => setRoutineForm((v) => ({ ...v, discipline: d.id }))}
                      className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
                        routineForm.discipline === d.id
                          ? "border-neon bg-neon/15 text-neon"
                          : "border-edge bg-card text-muted"
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setRoutineForm((v) => ({ ...v, discipline: "otras" }))}
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
                      routineForm.discipline === "otras"
                        ? "border-ember bg-ember/15 text-ember"
                        : "border-edge bg-card text-muted"
                    }`}
                  >
                    Otras
                  </button>
                </div>
              </div>

              {routineForm.discipline === "otras" && (
                <div className="space-y-2 rounded-lg border border-ember/30 bg-ember/5 p-2.5">
                  <p className="text-[11px] font-semibold text-ember">Campos personalizados</p>
                  {routineForm.customFields.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <span className="text-muted">{f.label} ({f.type})</span>
                      <button onClick={() => setRoutineForm((v) => ({
                        ...v,
                        customFields: v.customFields.filter((_, j) => j !== i),
                      }))} className="text-ember">×</button>
                    </div>
                  ))}
                  <div className="flex gap-1.5">
                    <input
                      value={routineForm.customDisciplineName}
                      onChange={(e) => setRoutineForm((v) => ({ ...v, customDisciplineName: e.target.value }))}
                      placeholder="Nombre del campo"
                      className="flex-1 rounded border border-edge bg-bg px-2 py-1 text-xs text-ink focus:border-neon focus:outline-none"
                    />
                    <button
                      onClick={() => {
                        if (routineForm.customDisciplineName.trim()) {
                          setRoutineForm((v) => ({
                            ...v,
                            customFields: [...v.customFields, { key: v.customDisciplineName.trim().toLowerCase().replace(/\s+/g, "_"), label: v.customDisciplineName.trim(), type: "text" }],
                            customDisciplineName: "",
                          }));
                        }
                      }}
                      className="rounded bg-ember/20 px-2 py-1 text-xs text-ember"
                    >
                      + Campo
                    </button>
                  </div>
                </div>
              )}

              {routineForm.days.map((day, dayIdx) => (
                <div key={dayIdx} className="rounded-lg border border-edge bg-bg p-2.5">
                  <div className="flex items-center gap-2">
                    <GripVertical className="h-4 w-4 text-muted" />
                    <span className="text-xs font-semibold text-neon">Día {dayIdx + 1}</span>
                    <input
                      value={day.label}
                      onChange={(e) => setRoutineForm((v) => ({
                        ...v,
                        days: v.days.map((d, i) => i === dayIdx ? { ...d, label: e.target.value } : d),
                      }))}
                      placeholder="Nombre (ej: Push, Pull)"
                      className="flex-1 rounded border border-edge bg-card px-2 py-1 text-xs text-ink placeholder:text-muted focus:border-neon focus:outline-none"
                    />
                    {routineForm.days.length > 1 && (
                      <button onClick={() => removeRoutineDay(dayIdx)} className="text-muted hover:text-ember">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="mt-2 space-y-2">
                    {day.exercises.map((ex, exIdx) => (
                      <div key={exIdx} className="rounded border border-edge/50 bg-card p-2 space-y-1.5">
                        <div className="flex items-center gap-2">
                          <input
                            value={ex.exercise}
                            onChange={(e) => setRoutineForm((v) => ({
                              ...v,
                              days: v.days.map((d, i) =>
                                i === dayIdx
                                  ? { ...d, exercises: d.exercises.map((x, j) => j === exIdx ? { ...x, exercise: e.target.value } : x) }
                                  : d
                              ),
                            }))}
                            placeholder="Ejercicio"
                            className="flex-1 rounded border border-edge bg-bg px-2 py-1 text-xs text-ink placeholder:text-muted focus:border-neon focus:outline-none"
                          />
                          {day.exercises.length > 1 && (
                            <button onClick={() => removeExerciseFromDay(dayIdx, exIdx)} className="text-muted hover:text-ember">
                              <Trash2 className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                          {routineFields.map((field) => (
                            <input
                              key={field.key}
                              value={String(ex.data[field.key] ?? "")}
                              onChange={(e) => updateExerciseField(dayIdx, exIdx, field.key, field.type === "number" ? (e.target.value ? Number(e.target.value) : "") : e.target.value)}
                              placeholder={field.label}
                              type={field.type === "number" ? "number" : "text"}
                              className="rounded border border-edge bg-bg px-2 py-1 text-[11px] text-ink placeholder:text-muted focus:border-neon focus:outline-none"
                            />
                          ))}
                        </div>
                        <input
                          value={ex.notes}
                          onChange={(e) => setRoutineForm((v) => ({
                            ...v,
                            days: v.days.map((d, i) =>
                              i === dayIdx
                                ? { ...d, exercises: d.exercises.map((x, j) => j === exIdx ? { ...x, notes: e.target.value } : x) }
                                : d
                            ),
                          }))}
                          placeholder="Nota (opcional)"
                          className="w-full rounded border border-edge bg-bg px-2 py-1 text-[11px] text-ink placeholder:text-muted focus:border-neon focus:outline-none"
                        />
                      </div>
                    ))}
                    <button
                      onClick={() => addExerciseToDay(dayIdx)}
                      className="flex items-center gap-1 text-[11px] font-semibold text-neon"
                    >
                      <Plus className="h-3 w-3" /> Ejercicio
                    </button>
                  </div>
                </div>
              ))}

              <button
                onClick={addRoutineDay}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-edge py-2 text-xs font-medium text-muted hover:border-neon/40 hover:text-neon"
              >
                <Plus className="h-3.5 w-3.5" /> Agregar día
              </button>

              <div className="flex gap-2">
                <button
                  onClick={saveRoutine}
                  disabled={!routineForm.title.trim()}
                  className="grow rounded-lg bg-neon py-2.5 text-sm font-semibold text-bg shadow-neon disabled:opacity-50"
                >
                  {editingRoutineId ? "Guardar cambios" : "Crear rutina"}
                </button>
                <button
                  onClick={() => { resetRoutineForm(); setRoutineFormOpen(false); }}
                  className="rounded-lg border border-edge px-3 text-muted transition hover:text-ink"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {routines.length === 0 && (
            <p className="py-8 text-center text-sm text-muted">Sin rutinas todavía.</p>
          )}

          {routines.map((r) => {
            const rItems = routineItems
              .filter((ri) => ri.routine_id === r.id)
              .sort((a, b) => a.day - b.day || a.position - b.position);
            const dayGroups = new Map<number, RoutineItem[]>();
            rItems.forEach((ri) => {
              const existing = dayGroups.get(ri.day) ?? [];
              existing.push(ri);
              dayGroups.set(ri.day, existing);
            });
            const expanded = openRoutine === r.id;
            const disc = DISCIPLINES.find((d) => d.id === r.discipline);
            return (
              <div key={r.id} className="mb-2 rounded-xl border border-edge bg-card p-3.5">
                <button
                  onClick={() => setOpenRoutine(expanded ? null : r.id)}
                  className="flex w-full items-start justify-between gap-2 text-left"
                >
                  <div>
                    <p className="font-semibold text-ink">{r.title}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      {r.discipline && (
                        <span className="rounded-full border border-neon/40 bg-neon/10 px-2 py-0.5 text-[11px] text-neon">
                          {disc?.label ?? r.discipline.replace(/_/g, " ")}
                        </span>
                      )}
                      <span className="text-[11px] text-muted">
                        {dayGroups.size} {dayGroups.size === 1 ? "día" : "días"} · {rItems.length} ej.
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => { openEditRoutine(r); }} className="text-muted text-[11px] hover:text-neon">
                      Editar
                    </button>
                    <button onClick={() => deleteRoutine(r.id)} className="text-muted hover:text-ember">
                      <Trash2 className="h-4 w-4" />
                    </button>
                    <ChevronDown className={`h-4 w-4 text-muted transition ${expanded ? "rotate-180" : ""}`} />
                  </div>
                </button>

                {expanded && (
                  <div className="mt-3 border-t border-edge pt-3">
                    {[...dayGroups.entries()].map(([day, dayItems]) => (
                      <div key={day} className="mb-3">
                        <p className="mb-1.5 text-xs font-semibold text-neon">
                          Día {day}{dayItems[0]?.day_label ? `: ${dayItems[0].day_label}` : ""}
                        </p>
                        {dayItems.map((ri) => {
                          const fields = getDisciplineFields(r.discipline, r.custom_fields ?? undefined);
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
                            <div key={ri.id} className="mb-1 rounded-lg border-b border-edge py-1.5">
                              <p className="text-sm font-medium text-ink">{ri.exercise}</p>
                              {plannedSummary && (
                                <p className="text-xs text-muted">{plannedSummary}</p>
                              )}
                              {ri.notes && <p className="text-[11px] text-muted italic">{ri.notes}</p>}
                            </div>
                          );
                        })}
                      </div>
                    ))}
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
                <p className="py-8 text-center text-sm text-muted">Empezá la conversación.</p>
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
