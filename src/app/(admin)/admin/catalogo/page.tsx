"use client";

import { useEffect, useState } from "react";
import { Dumbbell, UtensilsCrossed, Trash2, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Tab = "ejercicios" | "alimentos";

interface Exercise {
  id: string;
  name: string;
  muscle: string | null;
  discipline: string | null;
}

interface Food {
  id: string;
  name: string;
  category: string;
  kcal: number | null;
}

export default function AdminCatalogoPage() {
  const [tab, setTab] = useState<Tab>("ejercicios");
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [foods, setFoods] = useState<Food[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const [exRes, foodRes] = await Promise.all([
        supabase.from("exercises").select("id, name, muscle, discipline").order("name"),
        supabase.from("foods").select("id, name, category, kcal").order("name"),
      ]);
      if (exRes.data) setExercises(exRes.data as Exercise[]);
      if (foodRes.data) setFoods(foodRes.data as Food[]);
      setLoading(false);
    };
    load();
  }, []);

  const deleteExercise = async (id: string) => {
    if (!confirm("¿Eliminar este ejercicio?")) return;
    setBusy(id);
    const supabase = createClient();
    await supabase.rpc("admin_delete_exercise", { p_exercise_id: id });
    setExercises((prev) => prev.filter((e) => e.id !== id));
    setBusy(null);
  };

  const deleteFood = async (id: string) => {
    if (!confirm("¿Eliminar este alimento?")) return;
    setBusy(id);
    const supabase = createClient();
    await supabase.rpc("admin_delete_food", { p_food_id: id });
    setFoods((prev) => prev.filter((f) => f.id !== id));
    setBusy(null);
  };

  const filteredExercises = exercises.filter((e) => {
    const q = search.toLowerCase();
    return e.name.toLowerCase().includes(q) || e.muscle?.toLowerCase().includes(q);
  });

  const filteredFoods = foods.filter((f) => {
    const q = search.toLowerCase();
    return f.name.toLowerCase().includes(q) || f.category.toLowerCase().includes(q);
  });

  return (
    <main className="px-4 pt-5 space-y-3">
      {/* Tab switcher */}
      <div className="flex gap-2">
        <button
          onClick={() => { setTab("ejercicios"); setSearch(""); }}
          className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold ${
            tab === "ejercicios" ? "bg-neon/15 text-neon" : "text-muted"
          }`}
        >
          <Dumbbell className="h-3.5 w-3.5" /> Ejercicios ({exercises.length})
        </button>
        <button
          onClick={() => { setTab("alimentos"); setSearch(""); }}
          className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold ${
            tab === "alimentos" ? "bg-ember/15 text-ember" : "text-muted"
          }`}
        >
          <UtensilsCrossed className="h-3.5 w-3.5" /> Alimentos ({foods.length})
        </button>
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={`Buscar ${tab}...`}
        className="w-full rounded-xl border border-edge bg-bg py-2 px-3 text-sm text-ink placeholder:text-muted focus:border-neon focus:outline-none"
      />

      {loading ? (
        <div className="py-12 text-center">
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-neon" />
        </div>
      ) : tab === "ejercicios" ? (
        <div className="space-y-2">
          {filteredExercises.map((e) => (
            <div key={e.id} className="flex items-center justify-between rounded-xl border border-edge bg-card p-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink">{e.name}</p>
                <p className="text-[10px] text-muted">{e.muscle ?? "—"} · {e.discipline ?? "—"}</p>
              </div>
              <button
                onClick={() => deleteExercise(e.id)}
                disabled={busy === e.id}
                className="rounded-lg border border-edge p-1.5 text-muted hover:border-ember hover:text-ember"
              >
                {busy === e.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredFoods.map((f) => (
            <div key={f.id} className="flex items-center justify-between rounded-xl border border-edge bg-card p-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink">{f.name}</p>
                <p className="text-[10px] text-muted">{f.category} · {f.kcal ?? "—"} kcal/100g</p>
              </div>
              <button
                onClick={() => deleteFood(f.id)}
                disabled={busy === f.id}
                className="rounded-lg border border-edge p-1.5 text-muted hover:border-ember hover:text-ember"
              >
                {busy === f.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
              </button>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
