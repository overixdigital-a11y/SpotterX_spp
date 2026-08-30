"use client";

import { useEffect, useState } from "react";
import { Plus, Loader2, Receipt, Trash2, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuthState } from "@/lib/auth-context";

interface Gym {
  id: string;
  name: string | null;
}

interface Plan {
  id: string;
  name: string;
  price: number;
  duration_days: number;
}

export default function GymPlansPage() {
  const { userId } = useAuthState();
  const [gym, setGym] = useState<Gym | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", price: "", duration_days: "30" });

  useEffect(() => {
    let active = true;
    (async () => {
      if (!userId) return;
      const supabase = createClient();
      const { data: g } = await supabase
        .from("gyms")
        .select("id, name")
        .eq("owner_id", userId)
        .maybeSingle();
      if (!active || !g) {
        if (active) setLoading(false);
        return;
      }
      setGym(g as Gym);
      const { data: p } = await supabase
        .from("gym_plans")
        .select("*")
        .eq("gym_id", g.id)
        .order("created_at", { ascending: true });
      if (active) setPlans((p ?? []) as Plan[]);
      if (active) setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [userId]);

  const addPlan = async () => {
    if (!gym || !form.name || !form.price) return;
    setSaving(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("gym_plans")
      .insert({
        gym_id: gym.id,
        name: form.name.trim(),
        price: Number(form.price),
        duration_days: Number(form.duration_days) || 30,
      })
      .select()
      .single();
    if (data) setPlans((prev) => [...prev, data as Plan]);
    setForm({ name: "", price: "", duration_days: "30" });
    setSaving(false);
  };

  const removePlan = async (id: string) => {
    await createClient().from("gym_plans").delete().eq("id", id);
    setPlans((prev) => prev.filter((p) => p.id !== id));
  };

  if (loading) {
    return (
      <main className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-neon" />
      </main>
    );
  }

  if (!gym) {
    return (
      <main className="mx-auto max-w-md px-4 pt-10 text-center">
        <p className="text-sm text-muted">Primero creá tu gimnasio desde el panel.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md px-4 pt-5">
      <h1 className="text-xl font-bold text-ink">Planes / membresías</h1>
      <p className="mt-1 text-sm text-muted">Definí los planes de tu gimnasio.</p>

      <div className="mt-5 rounded-2xl border border-edge bg-card p-4">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
          <Plus className="h-4 w-4 text-neon" /> Nuevo plan
        </p>
        <div className="mt-3 space-y-2">
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Nombre (ej. Mensual)"
            className="w-full rounded-lg border border-edge bg-elevated px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-neon focus:outline-none"
          />
          <div className="flex gap-2">
            <input
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
              placeholder="Precio ($)"
              type="number"
              className="w-full rounded-lg border border-edge bg-elevated px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-neon focus:outline-none"
            />
            <input
              value={form.duration_days}
              onChange={(e) => setForm({ ...form, duration_days: e.target.value })}
              placeholder="Días"
              type="number"
              className="w-24 rounded-lg border border-edge bg-elevated px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-neon focus:outline-none"
            />
          </div>
          <button
            onClick={addPlan}
            disabled={saving || !form.name || !form.price}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-neon py-2.5 text-sm font-semibold text-bg shadow-neon disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Crear plan
          </button>
        </div>
      </div>

      <div className="mt-5">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
          <Receipt className="h-4 w-4 text-neon" /> Planes actuales
        </p>
        {plans.length === 0 ? (
          <p className="mt-3 text-xs text-muted">Todavía no creaste planes.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {plans.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-xl border border-edge bg-card p-3">
                <div>
                  <p className="text-sm font-semibold text-ink">{p.name}</p>
                  <p className="text-xs text-muted">
                    ${p.price} · cada {p.duration_days} días
                  </p>
                </div>
                <button
                  onClick={() => removePlan(p.id)}
                  className="rounded-lg p-2 text-muted hover:text-ember"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
