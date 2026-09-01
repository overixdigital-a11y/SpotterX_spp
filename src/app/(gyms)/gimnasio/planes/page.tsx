"use client";

import { useEffect, useState } from "react";
import { Plus, Loader2, Receipt, Trash2, Check, Pencil, X } from "lucide-react";
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
  duration_months: number;
  promo_type: string | null;
}

const MONTHS = [1, 2, 3, 6, 12];
const PROMOS = [
  { value: "", label: "Sin promo" },
  { value: "2x1", label: "2x1 (paga 1, entran 2)" },
  { value: "3x2", label: "3x2 (pagan 2, entran 3)" },
  { value: "4x3", label: "4x3 (pagan 3, entran 4)" },
];

export default function GymPlansPage() {
  const { userId } = useAuthState();
  const [gym, setGym] = useState<Gym | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", price: "", duration_months: "1", promo_type: "" });

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

  const resetForm = () => {
    setForm({ name: "", price: "", duration_months: "1", promo_type: "" });
    setEditingId(null);
  };

  const startEdit = (p: Plan) => {
    setEditingId(p.id);
    setForm({
      name: p.name,
      price: String(p.price),
      duration_months: String(p.duration_months),
      promo_type: p.promo_type ?? "",
    });
  };

  const submit = async () => {
    if (!gym || !form.name || !form.price) return;
    setSaving(true);
    const supabase = createClient();
    const payload = {
      name: form.name.trim(),
      price: Number(form.price),
      duration_months: Number(form.duration_months) || 1,
      promo_type: form.promo_type || null,
    };
    if (editingId) {
      const { data } = await supabase.from("gym_plans").update(payload).eq("id", editingId).select().single();
      if (data) setPlans((prev) => prev.map((p) => (p.id === editingId ? (data as Plan) : p)));
    } else {
      const { data } = await supabase.from("gym_plans").insert({ ...payload, gym_id: gym.id }).select().single();
      if (data) setPlans((prev) => [...prev, data as Plan]);
    }
    resetForm();
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

  const monthLabel = (m: number) => (m === 1 ? "1 mes" : `${m} meses`);

  return (
    <main className="mx-auto max-w-md px-4 pt-5">
      <h1 className="text-xl font-bold text-ink">Planes / membresías</h1>
      <p className="mt-1 text-sm text-muted">
        Definí tus planes, promociones y precios.
      </p>

      <div className="mt-5 rounded-2xl border border-edge bg-card p-4">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
          {editingId ? <Pencil className="h-4 w-4 text-neon" /> : <Plus className="h-4 w-4 text-neon" />}
          {editingId ? "Editar plan" : "Nuevo plan"}
        </p>
        <div className="mt-3 space-y-2">
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Nombre (ej. Trimestral Confort)"
            className="w-full rounded-lg border border-edge bg-elevated px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-neon focus:outline-none"
          />
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-[11px] font-medium text-muted">Duración</label>
              <select
                value={form.duration_months}
                onChange={(e) => setForm({ ...form, duration_months: e.target.value })}
                className="mt-1 w-full rounded-lg border border-edge bg-elevated px-3 py-2 text-sm text-ink focus:border-neon focus:outline-none"
              >
                {MONTHS.map((m) => (
                  <option key={m} value={m}>
                    {monthLabel(m)}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="text-[11px] font-medium text-muted">Precio ($)</label>
              <input
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                placeholder="0"
                type="number"
                className="mt-1 w-full rounded-lg border border-edge bg-elevated px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-neon focus:outline-none"
              />
            </div>
          </div>
          <div>
            <label className="text-[11px] font-medium text-muted">Promo de captación</label>
            <select
              value={form.promo_type}
              onChange={(e) => setForm({ ...form, promo_type: e.target.value })}
              className="mt-1 w-full rounded-lg border border-edge bg-elevated px-3 py-2 text-sm text-ink focus:border-neon focus:outline-none"
            >
              {PROMOS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <button
              onClick={submit}
              disabled={saving || !form.name || !form.price}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-neon py-2.5 text-sm font-semibold text-bg shadow-neon disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {editingId ? "Guardar" : "Crear plan"}
            </button>
            {editingId && (
              <button
                onClick={resetForm}
                className="flex items-center justify-center gap-1 rounded-xl border border-edge bg-elevated px-3 py-2.5 text-sm font-medium text-muted"
              >
                <X className="h-4 w-4" /> Cancelar
              </button>
            )}
          </div>
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
              <div key={p.id} className="rounded-xl border border-edge bg-card p-3">
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink">{p.name}</p>
                    <p className="text-xs text-muted">
                      ${p.price} · {monthLabel(p.duration_months)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {p.promo_type && (
                      <span className="rounded-full bg-ember/20 px-2 py-0.5 text-[10px] font-bold text-ember">
                        {p.promo_type}
                      </span>
                    )}
                    <button onClick={() => startEdit(p)} className="rounded-lg p-2 text-muted hover:text-neon">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button onClick={() => removePlan(p.id)} className="rounded-lg p-2 text-muted hover:text-ember">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
