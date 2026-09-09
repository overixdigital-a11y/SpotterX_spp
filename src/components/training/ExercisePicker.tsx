"use client";

import { useEffect, useRef, useState } from "react";
import { Search, Check, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuthState } from "@/lib/auth-context";

interface Exercise {
  id: string;
  name: string;
  discipline: string | null;
}

let cache: Exercise[] | null = null;

async function loadExercises(): Promise<Exercise[]> {
  if (cache) return cache;
  const { data, error } = await createClient()
    .from("exercises")
    .select("id, name, discipline")
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
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const createExercise = async (name: string) => {
    const clean = name.trim();
    if (!clean) return;
    try {
      const { data } = await createClient()
        .from("exercises")
        .insert({ name: clean, discipline: discipline ?? null, created_by: userId })
        .select("id, name, discipline")
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
    setOpen(false);
    setQuery("");
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setQuery(v);
    onChange(v);
    setOpen(true);
  };

  const q = (query || value).trim().toLowerCase();
  const filtered = list
    .filter((e) => e.name.toLowerCase().includes(q))
    .sort((a, b) => {
      if (!discipline) return 0;
      const ad = a.discipline === discipline ? 0 : 1;
      const bd = b.discipline === discipline ? 0 : 1;
      return ad - bd || a.name.localeCompare(b.name);
    });
  const suggested = discipline ? filtered.filter((e) => e.discipline === discipline) : [];
  const others = discipline ? filtered.filter((e) => e.discipline !== discipline) : filtered;
  const exactMatch = filtered.some((e) => e.name.toLowerCase() === q);
  const canCreate = q.length > 0 && !exactMatch;

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
          if (e.key === "Escape") setOpen(false);
        }}
        placeholder={placeholder}
        className="w-full rounded border border-edge bg-bg py-1 pl-7 pr-2 text-xs text-ink placeholder:text-muted focus:border-neon focus:outline-none"
      />
      {open && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-56 overflow-y-auto rounded-lg border border-edge bg-elevated shadow-lg">
          {canCreate && (
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => createExercise(query)}
              className="flex w-full items-center gap-2 rounded-t-lg px-2.5 py-2 text-left text-xs text-neon transition hover:bg-neon/10"
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
                  onClick={() => {
                    onChange(e.name);
                    setOpen(false);
                    setQuery("");
                  }}
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
                  onClick={() => {
                    onChange(e.name);
                    setOpen(false);
                    setQuery("");
                  }}
                  className="flex w-full items-center justify-between gap-2 px-2.5 py-1.5 text-left text-xs text-ink transition hover:bg-neon/10"
                >
                  <span className="truncate">{e.name}</span>
                  {e.name.toLowerCase() === q && <Check className="h-3.5 w-3.5 shrink-0 text-neon" />}
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}