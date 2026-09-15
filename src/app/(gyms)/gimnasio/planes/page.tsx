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
    <main className="mx-auto max-w-5xl px-4 pt-2 md:pt-4">
      <div className="border-b border-edge/60 pb-4">
        <h1 className="text-2xl font-bold text-ink">Planes y Membresías</h1>
        <p className="mt-0.5 text-sm text-muted">
          Definí tus opciones de suscripción, duraciones, precios y promociones de captación.
        </p>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Formulario de Plan */}
        <div className="lg:col-span-1 space-y-4 rounded-2xl border border-edge bg-card p-5 h-fit">
          <p className="flex items-center gap-2 text-base font-bold text-ink">
            {editingId ? <Pencil className="h-5 w-5 text-neon" /> : <Plus className="h-5 w-5 text-neon" />}
            {editingId ? "Editar Plan" : "Crear Nuevo Plan"}
          </p>

          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-muted">Nombre del Plan</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ej: Trimestral Musculación"
                className="w-full rounded-xl border border-edge bg-bg px-3.5 py-2.5 text-sm text-ink placeholder:text-muted focus:border-neon focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-muted">Duración</label>
                <select
                  value={form.duration_months}
                  onChange={(e) => setForm({ ...form, duration_months: e.target.value })}
                  className="w-full rounded-xl border border-edge bg-bg px-3.5 py-2.5 text-sm text-ink focus:border-neon focus:outline-none"
                >
                  {MONTHS.map((m) => (
                    <option key={m} value={m}>
                      {monthLabel(m)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-muted">Precio ($)</label>
                <input
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                  placeholder="0"
                  type="number"
                  className="w-full rounded-xl border border-edge bg-bg px-3.5 py-2.5 text-sm text-ink placeholder:text-muted focus:border-neon focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-muted">Promo de Captación</label>
              <select
                value={form.promo_type}
                onChange={(e) => setForm({ ...form, promo_type: e.target.value })}
                className="w-full rounded-xl border border-edge bg-bg px-3.5 py-2.5 text-sm text-ink focus:border-neon focus:outline-none"
              >
                {PROMOS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={submit}
                disabled={saving || !form.name || !form.price}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-neon py-3 font-semibold text-bg shadow-neon transition hover:opacity-90 disabled:opacity-60"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                {editingId ? "Guardar Cambios" : "Crear Plan"}
              </button>
              {editingId && (
                <button
                  onClick={resetForm}
                  className="flex items-center justify-center gap-1 rounded-xl border border-edge bg-elevated px-3.5 py-3 text-sm font-medium text-muted transition hover:text-ink"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Lista / Grid de Planes */}
        <div className="lg:col-span-2 space-y-4 rounded-2xl border border-edge bg-card p-5">
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-2 text-base font-bold text-ink">
              <Receipt className="h-5 w-5 text-neon" /> Planes Habilitados
            </p>
            <span className="rounded-full bg-elevated px-3 py-1 text-xs font-bold text-neon border border-neon/20">
              Total: {plans.length}
            </span>
          </div>

          {plans.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted">
              Todavía no creaste ningún plan de membresía.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {plans.map((p) => (
                <div key={p.id} className="rounded-2xl border border-edge bg-bg p-4 flex flex-col justify-between transition hover:border-neon/40">
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-bold text-ink text-base">{p.name}</p>
                      {p.promo_type && (
                        <span className="rounded-full bg-ember/20 px-2.5 py-0.5 text-[11px] font-bold text-ember border border-ember/30">
                          {p.promo_type}
                        </span>
                      )}
                    </div>
                    <p className="text-2xl font-black text-neon">
                      ${p.price.toLocaleString("es-AR")}
                      <span className="text-xs font-normal text-muted ml-1">/ {monthLabel(p.duration_months)}</span>
                    </p>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-4 border-t border-edge/40 mt-4">
                    <button
                      onClick={() => startEdit(p)}
                      className="flex items-center gap-1 rounded-xl border border-edge bg-card px-3 py-1.5 text-xs font-medium text-ink transition hover:border-neon/40 hover:text-neon"
                    >
                      <Pencil className="h-3.5 w-3.5" /> Editar
                    </button>
                    <button
                      onClick={() => removePlan(p.id)}
                      className="flex items-center gap-1 rounded-xl border border-edge bg-card px-2.5 py-1.5 text-xs font-medium text-muted hover:border-ember/40 hover:text-ember transition"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
