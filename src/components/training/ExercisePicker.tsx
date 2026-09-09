"use client";

import { useEffect, useRef, useState } from "react";
import { Search, Check, Plus, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuthState } from "@/lib/auth-context";
import { DISCIPLINES } from "@/lib/disciplines";

interface Exercise {
  id: string;
  name: string;
  discipline: string | null;
  muscle: string | null;
}

const MUSCLE_ORDER = [
  "pecho", "espalda", "hombros", "bíceps", "tríceps", "antebrazo",
  "cuádriceps", "femoral", "glúteos", "pantorrilla",
  "core", "full body", "cardio", "técnica", "movilidad", "otro",
];

let cache: Exercise[] | null = null;

async function loadExercises(): Promise<Exercise[]> {
  if (cache) return cache;
  const { data, error } = await createClient()
    .from("exercises")
    .select("id, name, discipline, muscle")
    .order("name");
  if (error) throw error;
  if (!data) return [];
  cache = data as unknown as Exercise[];
  return cache;
}

interface ExercisePickerProps {
  value: string;
  onChange: (value: string) => void;
  discipline?: string | null;
  placeholder?: string;
  className?: string;
}

export default function ExercisePicker({
  value,
  onChange,
  discipline,
  placeholder = "Ejercicio",
  className = "",
}: ExercisePickerProps) {
  const { userId } = useAuthState();
  const [list, setList] = useState<Exercise[]>([]);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [groupFilter, setGroupFilter] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [addName, setAddName] = useState("");
  const [addMuscle, setAddMuscle] = useState("");
  const [addDiscipline, setAddDiscipline] = useState("");
  const [adding, setAdding] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    loadExercises().then((items) => {
      if (!active) return;
      setList(items);
      setAvailable(true);
    }).catch(() => {
      if (active) setAvailable(false);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
        setShowAdd(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const closeAll = () => {
    setOpen(false);
    setShowAdd(false);
    setQuery("");
  };

  const createExercise = async (name: string) => {
    const clean = name.trim();
    if (!clean) return;
    try {
      const { data } = await createClient()
        .from("exercises")
        .insert({
          name: clean,
          discipline: discipline ?? null,
          muscle: groupFilter ?? null,
          created_by: userId,
        })
        .select("id, name, discipline, muscle")
        .maybeSingle();
      if (data) {
        const ex = data as unknown as Exercise;
        setList((prev) =>
          prev.some((e) => e.name.toLowerCase() === clean.toLowerCase())
            ? prev
            : [...prev, ex].sort((a, b) => a.name.localeCompare(b.name))
        );
        cache = null;
      }
    } catch {
      // la tabla puede no existir todavía (00018 sin correr)
    }
    onChange(clean);
    closeAll();
  };

  const submitAdd = async () => {
    const clean = addName.trim();
    if (!clean || adding) return;
    setAdding(true);
    try {
      const { data } = await createClient()
        .from("exercises")
        .insert({
          name: clean,
          discipline: addDiscipline || discipline || null,
          muscle: addMuscle || null,
          created_by: userId,
        })
        .select("id, name, discipline, muscle")
        .maybeSingle();
      if (data) {
        const ex = data as unknown as Exercise;
        setList((prev) =>
          prev.some((e) => e.name.toLowerCase() === clean.toLowerCase())
            ? prev
            : [...prev, ex].sort((a, b) => a.name.localeCompare(b.name))
        );
        cache = null;
      }
      onChange(clean);
      setGroupFilter(addMuscle.toLowerCase() || null);
      setShowAdd(false);
      setQuery("");
    } catch {
      // la tabla puede no existir todavía (00018 sin correr)
    } finally {
      setAdding(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setQuery(v);
    onChange(v);
    setOpen(true);
  };

  const q = (query || value).trim().toLowerCase();
  const match = (e: Exercise) =>
    !q ||
    e.name.toLowerCase().includes(q) ||
    (e.muscle ?? "").toLowerCase().includes(q) ||
    (e.discipline ?? "").toLowerCase().includes(q);
  const groupMatch = (e: Exercise) => !groupFilter || (e.muscle ?? "").toLowerCase() === groupFilter;
  const filtered = list
    .filter((e) => match(e) && groupMatch(e))
    .sort((a, b) => {
      const ad = discipline && a.discipline === discipline ? 0 : 1;
      const bd = discipline && b.discipline === discipline ? 0 : 1;
      if (ad !== bd) return ad - bd;
      const ai = MUSCLE_ORDER.indexOf((a.muscle ?? "").toLowerCase());
      const bi = MUSCLE_ORDER.indexOf((b.muscle ?? "").toLowerCase());
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi) || a.name.localeCompare(b.name);
    });
  const suggested = discipline ? filtered.filter((e) => e.discipline === discipline) : [];
  const others = discipline ? filtered.filter((e) => e.discipline !== discipline) : filtered;
  const exactMatch = filtered.some((e) => e.name.toLowerCase() === q);
  const canCreate = q.length > 0 && !exactMatch && !groupFilter;

  const groupSet = new Set<string>();
  list.forEach((e) => { if (e.muscle) groupSet.add(e.muscle.toLowerCase()); });
  const groups = Array.from(groupSet).sort((a, b) => {
    const ai = MUSCLE_ORDER.indexOf(a);
    const bi = MUSCLE_ORDER.indexOf(b);
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  });

  const chip = (active: boolean) =>
    `shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide transition ${
      active
        ? "border-neon bg-neon/15 text-neon"
        : "border-edge bg-edge/40 text-muted hover:text-ink"
    }`;

  const selectExercise = (name: string) => {
    onChange(name);
    closeAll();
  };

  if (available === false) {
    return (
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={className}
      />
    );
  }

  return (
    <div ref={boxRef} className={`relative ${className}`}>
      <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
      <input
        value={query || value}
        onChange={handleChange}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setOpen(false);
            setShowAdd(false);
          }
        }}
        placeholder={placeholder}
        className="w-full rounded border border-edge bg-bg py-1 pl-7 pr-2 text-xs text-ink placeholder:text-muted focus:border-neon focus:outline-none"
      />
      {open && !showAdd && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 rounded-lg border border-edge bg-elevated shadow-lg">
          {groups.length > 0 && (
            <div className="flex gap-1.5 overflow-x-auto border-b border-edge px-2 py-1.5">
              <button onClick={() => setGroupFilter(null)} className={chip(!groupFilter)}>
                Todas
              </button>
              {groups.map((g) => (
                <button key={g} onClick={() => setGroupFilter(groupFilter === g ? null : g)} className={chip(groupFilter === g)}>
                  {g}
                </button>
              ))}
            </div>
          )}
          <div className="max-h-52 overflow-y-auto">
            {canCreate && (
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => createExercise(query)}
                className="flex w-full items-center gap-2 px-2.5 py-2 text-left text-xs text-neon transition hover:bg-neon/10"
              >
                <Plus className="h-3.5 w-3.5" /> Crear &quot;{query}&quot;
              </button>
            )}
            {filtered.length === 0 && !canCreate && (
              <p className="px-2.5 py-2 text-xs text-muted">Sin ejercicios.</p>
            )}
            {suggested.length > 0 && (
              <>
                <p className="px-2.5 pt-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
                  Sugeridos
                </p>
                {suggested.map((e) => (
                  <button
                    key={e.id}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => selectExercise(e.name)}
                    className="flex w-full items-center justify-between gap-2 px-2.5 py-1.5 text-left text-xs text-ink transition hover:bg-neon/10"
                  >
                    <span className="truncate">{e.name}</span>
                    {e.name.toLowerCase() === q && <Check className="h-3.5 w-3.5 shrink-0 text-neon" />}
                  </button>
                ))}
              </>
            )}
            {others.length > 0 && (
              <>
                {suggested.length > 0 && (
                  <p className="border-t border-edge px-2.5 pt-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
                    Todos
                  </p>
                )}
                {others.map((e) => (
                  <button
                    key={e.id}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => selectExercise(e.name)}
                    className="flex w-full items-center justify-between gap-2 px-2.5 py-1.5 text-left text-xs text-ink transition hover:bg-neon/10"
                  >
                    <span className="truncate">{e.name}</span>
                    {e.name.toLowerCase() === q && <Check className="h-3.5 w-3.5 shrink-0 text-neon" />}
                  </button>
                ))}
              </>
            )}
          </div>
          <div className="border-t border-edge p-1.5">
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setAddName(query || "");
                setAddMuscle(groupFilter ?? "");
                setAddDiscipline(discipline ?? "");
                setShowAdd(true);
              }}
              className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-left text-xs text-neon transition hover:bg-neon/10"
            >
              <Plus className="h-3.5 w-3.5" /> Agregar ejercicio
            </button>
          </div>
        </div>
      )}
      {open && showAdd && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 space-y-2 rounded-lg border border-edge bg-elevated p-2.5 shadow-lg">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
            Nuevo ejercicio
          </p>
          <input
            value={addName}
            onChange={(e) => setAddName(e.target.value)}
            placeholder="Nombre"
            autoFocus
            className="w-full rounded border border-edge bg-bg px-2 py-1.5 text-xs text-ink placeholder:text-muted focus:border-neon focus:outline-none"
          />
          <select
            value={addMuscle}
            onChange={(e) => setAddMuscle(e.target.value)}
            className="w-full rounded border border-edge bg-bg px-2 py-1.5 text-xs text-ink focus:border-neon focus:outline-none"
          >
            <option value="">Grupo muscular (opcional)</option>
            {MUSCLE_ORDER.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          <select
            value={addDiscipline}
            onChange={(e) => setAddDiscipline(e.target.value)}
            className="w-full rounded border border-edge bg-bg px-2 py-1.5 text-xs text-ink focus:border-neon focus:outline-none"
          >
            <option value="">Disciplina (opcional)</option>
            {DISCIPLINES.map((d) => (
              <option key={d.id} value={d.id}>{d.label}</option>
            ))}
          </select>
          <div className="flex gap-2 pt-1">
            <button
              onClick={submitAdd}
              disabled={!addName.trim() || adding}
              className="flex-1 rounded bg-neon px-2 py-1.5 text-xs font-semibold text-bg transition hover:opacity-90 disabled:opacity-40"
            >
              {adding ? "Guardando..." : "Agregar"}
            </button>
            <button
              onClick={() => setShowAdd(false)}
              className="flex items-center gap-1 rounded border border-edge px-2 py-1.5 text-xs text-muted transition hover:text-ink"
            >
              <X className="h-3 w-3" /> Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}