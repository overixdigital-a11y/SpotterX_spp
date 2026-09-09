"use client";

import { useEffect, useRef, useState } from "react";
import { Search, Plus, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuthState } from "@/lib/auth-context";

export interface Food {
  id: string;
  name: string;
  category: string | null;
  kcal: number | null;
  protein_g: number | null;
  fat_g: number | null;
  carbs_g: number | null;
  unit_grams: number | null;
}

const CATEGORY_ORDER = [
  "Proteínas",
  "Carbohidratos",
  "Frutas",
  "Verduras",
  "Lácteos",
  "Grasas y frutos secos",
  "Bebidas",
  "Otros",
];

const fmt = (n: number | null | undefined) => (typeof n === "number" ? (Number.isInteger(n) ? String(n) : String(Number(n.toFixed(1)))) : "");

let cache: Food[] | null = null;

async function loadFoods(): Promise<Food[]> {
  if (cache) return cache;
  const { data, error } = await createClient()
    .from("foods")
    .select("id, name, category, kcal, protein_g, fat_g, carbs_g, unit_grams")
    .order("name");
  if (error) throw error;
  if (!data) return [];
  cache = data as unknown as Food[];
  return cache;
}

interface FoodPickerProps {
  value: string;
  onChange: (value: string) => void;
  onPick: (food: Food) => void;
  placeholder?: string;
  className?: string;
}

export default function FoodPicker({
  value,
  onChange,
  onPick,
  placeholder = "Alimento",
  className = "",
}: FoodPickerProps) {
  const { userId } = useAuthState();
  const [list, setList] = useState<Food[]>([]);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [catFilter, setCatFilter] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [add, setAdd] = useState({ name: "", category: "", kcal: "", protein: "", fat: "", carbs: "", unitGrams: "" });
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    loadFoods().then((items) => {
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

  const resetAdd = () => setAdd({ name: query || "", category: catFilter ?? "", kcal: "", protein: "", fat: "", carbs: "", unitGrams: "" });

  const applyFood = (f: Food, name: string) => {
    onChange(name);
    onPick({ ...f, name });
    setCatFilter(f.category?.toLowerCase() ?? null);
    setAdd({ name: "", category: "", kcal: "", protein: "", fat: "", carbs: "", unitGrams: "" });
    setShowAdd(false);
    setQuery("");
    setOpen(false);
  };

  const createQuick = async (name: string) => {
    const clean = name.trim();
    if (!clean) return;
    try {
      const { data } = await createClient()
        .from("foods")
        .insert({ name: clean, category: catFilter ?? "Otros", kcal: 0, protein_g: 0, fat_g: 0, carbs_g: 0, unit_grams: null })
        .select("id, name, category, kcal, protein_g, fat_g, carbs_g, unit_grams")
        .maybeSingle();
      if (data) {
        const f = data as unknown as Food;
        setList((prev) =>
          prev.some((x) => x.name.toLowerCase() === clean.toLowerCase())
            ? prev
            : [...prev, f].sort((a, b) => a.name.localeCompare(b.name))
        );
        cache = null;
        applyFood(f, clean);
        return;
      }
    } catch {
      // la tabla puede no existir todavía (00021 sin correr)
    }
    onPick({ id: "", name: clean, category: catFilter, kcal: 0, protein_g: 0, fat_g: 0, carbs_g: 0, unit_grams: null });
    onChange(clean);
    setOpen(false);
    setQuery("");
  };

  const submitAdd = async () => {
    const clean = add.name.trim();
    if (!clean) return;
    const f: Food = {
      id: "",
      name: clean,
      category: add.category || catFilter || "Otros",
      kcal: Number(add.kcal) || 0,
      protein_g: Number(add.protein) || 0,
      fat_g: Number(add.fat) || 0,
      carbs_g: Number(add.carbs) || 0,
      unit_grams: add.unitGrams ? Number(add.unitGrams) || null : null,
    };
    try {
      const { data } = await createClient()
        .from("foods")
        .insert({
          name: clean,
          category: f.category,
          kcal: f.kcal,
          protein_g: f.protein_g,
          fat_g: f.fat_g,
          carbs_g: f.carbs_g,
          unit_grams: f.unit_grams,
          created_by: userId,
        })
        .select("id, name, category, kcal, protein_g, fat_g, carbs_g, unit_grams")
        .maybeSingle();
      if (data) {
        const saved = data as unknown as Food;
        setList((prev) =>
          prev.some((x) => x.name.toLowerCase() === clean.toLowerCase())
            ? prev
            : [...prev, saved].sort((a, b) => a.name.localeCompare(b.name))
        );
        cache = null;
        applyFood(saved, clean);
        return;
      }
    } catch {
      // la tabla puede no existir todavía (00021 sin correr)
    }
    applyFood(f, clean);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setQuery(v);
    onChange(v);
    setOpen(true);
  };

  const q = (query || value).trim().toLowerCase();
  const match = (f: Food) =>
    !q ||
    f.name.toLowerCase().includes(q) ||
    (f.category ?? "").toLowerCase().includes(q);
  const catMatch = (f: Food) => !catFilter || (f.category ?? "").toLowerCase() === catFilter;
  const filtered = list
    .filter((f) => match(f) && catMatch(f))
    .sort((a, b) => {
      const ai = CATEGORY_ORDER.indexOf(a.category ?? "");
      const bi = CATEGORY_ORDER.indexOf(b.category ?? "");
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi) || a.name.localeCompare(b.name);
    });
  const exactMatch = filtered.some((f) => f.name.toLowerCase() === q);
  const canCreate = q.length > 0 && !exactMatch && !catFilter;

  const catSet = new Set<string>();
  list.forEach((f) => { if (f.category) catSet.add(f.category); });
  const cats = Array.from(catSet).sort((a, b) => {
    const ai = CATEGORY_ORDER.indexOf(a);
    const bi = CATEGORY_ORDER.indexOf(b);
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  });

  const chip = (active: boolean) =>
    `shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide transition ${
      active
        ? "border-ember bg-ember/15 text-ember"
        : "border-edge bg-edge/40 text-muted hover:text-ink"
    }`;

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
        className="w-full rounded border border-edge bg-bg py-1 pl-7 pr-2 text-xs text-ink placeholder:text-muted focus:border-ember focus:outline-none"
      />
      {open && !showAdd && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 rounded-lg border border-edge bg-elevated shadow-lg">
          {cats.length > 0 && (
            <div className="flex gap-1.5 overflow-x-auto border-b border-edge px-2 py-1.5">
              <button onClick={() => setCatFilter(null)} className={chip(!catFilter)}>
                Todas
              </button>
              {cats.map((c) => (
                <button key={c} onClick={() => setCatFilter(catFilter === c.toLowerCase() ? null : c.toLowerCase())} className={chip(catFilter === c.toLowerCase())}>
                  {c}
                </button>
              ))}
            </div>
          )}
          <div className="max-h-52 overflow-y-auto">
            {canCreate && (
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => createQuick(query)}
                className="flex w-full items-center gap-2 px-2.5 py-2 text-left text-xs text-ember transition hover:bg-ember/10"
              >
                <Plus className="h-3.5 w-3.5" /> Crear &quot;{query}&quot; (0 kcal)
              </button>
            )}
            {filtered.length === 0 && !canCreate && (
              <p className="px-2.5 py-2 text-xs text-muted">Sin alimentos.</p>
            )}
            {cats.length > 0 && filtered.length > 0 && (
              <>
                {CATEGORY_ORDER.concat(Array.from(catSet))
                  .filter((c, i, arr) => arr.indexOf(c) === i)
                  .map((cat) => {
                    const items = filtered.filter((f) => (f.category ?? "") === cat);
                    if (items.length === 0) return null;
                    return (
                      <div key={cat}>
                        <p className="border-t border-edge px-2.5 pt-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted first:border-t-0">
                          {cat}
                        </p>
                        {items.map((f) => (
                          <button
                            key={f.id}
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => applyFood(f, f.name)}
                            className="flex w-full items-center justify-between gap-2 px-2.5 py-1.5 text-left text-xs text-ink transition hover:bg-ember/10"
                          >
                            <span className="flex min-w-0 flex-col items-start">
                              <span className="truncate">{f.name}</span>
                              {f.unit_grams ? (
                                <span className="text-[9px] text-muted">1 unidad ≈ {fmt(f.unit_grams)} g</span>
                              ) : null}
                            </span>
                            <span className="shrink-0 text-[10px] text-muted">
                              {f.kcal ? `${fmt(f.kcal)} kcal · P ${fmt(f.protein_g)} · G ${fmt(f.fat_g)} · C ${fmt(f.carbs_g)}` : ""}
                            </span>
                          </button>
                        ))}
                      </div>
                    );
                  })}
              </>
            )}
          </div>
          <div className="border-t border-edge p-1.5">
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                resetAdd();
                setShowAdd(true);
              }}
              className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-left text-xs text-ember transition hover:bg-ember/10"
            >
              <Plus className="h-3.5 w-3.5" /> Agregar alimento con macros
            </button>
          </div>
        </div>
      )}
      {open && showAdd && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 space-y-2 rounded-lg border border-edge bg-elevated p-2.5 shadow-lg">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
            Nuevo alimento (macros por 100 g)
          </p>
          <input
            value={add.name}
            onChange={(e) => setAdd((v) => ({ ...v, name: e.target.value }))}
            placeholder="Nombre"
            autoFocus
            className="w-full rounded border border-edge bg-bg px-2 py-1.5 text-xs text-ink placeholder:text-muted focus:border-ember focus:outline-none"
          />
          <select
            value={add.category}
            onChange={(e) => setAdd((v) => ({ ...v, category: e.target.value }))}
            className="w-full rounded border border-edge bg-bg px-2 py-1.5 text-xs text-ink focus:border-ember focus:outline-none"
          >
            <option value="">Categoría (opcional)</option>
            {CATEGORY_ORDER.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <div className="grid grid-cols-4 gap-1.5">
            <input
              value={add.kcal}
              onChange={(e) => setAdd((v) => ({ ...v, kcal: e.target.value }))}
              placeholder="kcal"
              type="number"
              min={0}
              className="w-full rounded border border-edge bg-bg px-1.5 py-1.5 text-xs text-ink placeholder:text-muted focus:border-ember focus:outline-none"
            />
            <input
              value={add.protein}
              onChange={(e) => setAdd((v) => ({ ...v, protein: e.target.value }))}
              placeholder="Prot"
              type="number"
              min={0}
              step="0.1"
              className="w-full rounded border border-edge bg-bg px-1.5 py-1.5 text-xs text-ink placeholder:text-muted focus:border-ember focus:outline-none"
            />
            <input
              value={add.fat}
              onChange={(e) => setAdd((v) => ({ ...v, fat: e.target.value }))}
              placeholder="Grasas"
              type="number"
              min={0}
              step="0.1"
              className="w-full rounded border border-edge bg-bg px-1.5 py-1.5 text-xs text-ink placeholder:text-muted focus:border-ember focus:outline-none"
            />
            <input
              value={add.carbs}
              onChange={(e) => setAdd((v) => ({ ...v, carbs: e.target.value }))}
              placeholder="Carbs"
              type="number"
              min={0}
              step="0.1"
              className="w-full rounded border border-edge bg-bg px-1.5 py-1.5 text-xs text-ink placeholder:text-muted focus:border-ember focus:outline-none"
            />
          </div>
          <input
            value={add.unitGrams}
            onChange={(e) => setAdd((v) => ({ ...v, unitGrams: e.target.value }))}
            placeholder="Gramos por 1 unidad (solo si se consume por unidad, ej: huevo = 50)"
            type="number"
            min={0}
            step="0.1"
            className="w-full rounded border border-edge bg-bg px-2 py-1.5 text-xs text-ink placeholder:text-muted focus:border-ember focus:outline-none"
          />
          <div className="flex gap-2 pt-1">
            <button
              onClick={submitAdd}
              disabled={!add.name.trim()}
              className="flex-1 rounded bg-ember px-2 py-1.5 text-xs font-semibold text-bg transition hover:opacity-90 disabled:opacity-40"
            >
              Agregar
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