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
        supabase
          .from("exercises")
          .select("id, name, muscle, discipline")
          .order("name"),
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
    return (
      e.name.toLowerCase().includes(q) || e.muscle?.toLowerCase().includes(q)
    );
  });

  const filteredFoods = foods.filter((f) => {
    const q = search.toLowerCase();
    return (
      f.name.toLowerCase().includes(q) || f.category.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button
          onClick={() => {
            setTab("ejercicios");
            setSearch("");
          }}
          className={`flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium ${
            tab === "ejercicios"
              ? "bg-[#00e5c7]/10 text-[#00e5c7]"
              : "text-[#9ca3af] hover:bg-[#1a1f2e]"
          }`}
        >
          <Dumbbell className="h-3.5 w-3.5" /> Ejercicios ({exercises.length})
        </button>
        <button
          onClick={() => {
            setTab("alimentos");
            setSearch("");
          }}
          className={`flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium ${
            tab === "alimentos"
              ? "bg-[#f97316]/10 text-[#f97316]"
              : "text-[#9ca3af] hover:bg-[#1a1f2e]"
          }`}
        >
          <UtensilsCrossed className="h-3.5 w-3.5" /> Alimentos ({foods.length})
        </button>
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={`Buscar ${tab}...`}
        className="w-full rounded-lg border border-[#1e2530] bg-[#121722] px-3 py-2.5 text-sm text-[#e4e8ee] placeholder:text-[#6b7280] focus:border-[#00e5c7]/50 focus:outline-none"
      />

      {loading ? (
        <div className="py-16 text-center">
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-[#00e5c7]" />
        </div>
      ) : tab === "ejercicios" ? (
        <div className="overflow-hidden rounded-lg border border-[#1e2530]">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[#1e2530] bg-[#0c1017]">
                <th className="px-4 py-2.5 text-xs font-medium text-[#9ca3af]">
                  Nombre
                </th>
                <th className="hidden px-4 py-2.5 text-xs font-medium text-[#9ca3af] sm:table-cell">
                  Grupo
                </th>
                <th className="hidden px-4 py-2.5 text-xs font-medium text-[#9ca3af] sm:table-cell">
                  Disciplina
                </th>
                <th className="px-4 py-2.5 text-xs font-medium text-[#9ca3af]">
                  Acción
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredExercises.map((e) => (
                <tr
                  key={e.id}
                  className="border-b border-[#1e2530]/50 last:border-0 hover:bg-[#121722]/50"
                >
                  <td className="px-4 py-2.5 text-sm font-medium text-[#e4e8ee]">
                    {e.name}
                  </td>
                  <td className="hidden px-4 py-2.5 sm:table-cell">
                    <span className="rounded-md bg-[#1a1f2e] px-2 py-0.5 text-[11px] text-[#9ca3af]">
                      {e.muscle ?? "—"}
                    </span>
                  </td>
                  <td className="hidden px-4 py-2.5 sm:table-cell">
                    <span className="text-xs text-[#9ca3af]">
                      {e.discipline ?? "—"}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <button
                      onClick={() => deleteExercise(e.id)}
                      disabled={busy === e.id}
                      className="rounded-md p-1.5 text-[#9ca3af] hover:bg-[#ef4444]/10 hover:text-[#ef4444]"
                    >
                      {busy === e.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Trash2 className="h-3 w-3" />
                      )}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-[#1e2530]">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[#1e2530] bg-[#0c1017]">
                <th className="px-4 py-2.5 text-xs font-medium text-[#9ca3af]">
                  Nombre
                </th>
                <th className="hidden px-4 py-2.5 text-xs font-medium text-[#9ca3af] sm:table-cell">
                  Categoría
                </th>
                <th className="hidden px-4 py-2.5 text-xs font-medium text-[#9ca3af] sm:table-cell">
                  Kcal
                </th>
                <th className="px-4 py-2.5 text-xs font-medium text-[#9ca3af]">
                  Acción
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredFoods.map((f) => (
                <tr
                  key={f.id}
                  className="border-b border-[#1e2530]/50 last:border-0 hover:bg-[#121722]/50"
                >
                  <td className="px-4 py-2.5 text-sm font-medium text-[#e4e8ee]">
                    {f.name}
                  </td>
                  <td className="hidden px-4 py-2.5 sm:table-cell">
                    <span className="rounded-md bg-[#1a1f2e] px-2 py-0.5 text-[11px] text-[#9ca3af]">
                      {f.category}
                    </span>
                  </td>
                  <td className="hidden px-4 py-2.5 sm:table-cell">
                    <span className="text-xs text-[#9ca3af]">
                      {f.kcal ?? "—"} kcal/100g
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <button
                      onClick={() => deleteFood(f.id)}
                      disabled={busy === f.id}
                      className="rounded-md p-1.5 text-[#9ca3af] hover:bg-[#ef4444]/10 hover:text-[#ef4444]"
                    >
                      {busy === f.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Trash2 className="h-3 w-3" />
                      )}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
