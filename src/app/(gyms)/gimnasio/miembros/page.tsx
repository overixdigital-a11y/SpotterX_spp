"use client";

import { useEffect, useState } from "react";
import { UserPlus, Loader2, KeyRound, Copy, Check, Users, Gift } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuthState } from "@/lib/auth-context";

const FUNC_URL = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/invite-member`;

interface Gym {
  id: string;
  name: string | null;
  qr_code: string | null;
}

interface Plan {
  id: string;
  name: string;
  price: number;
  duration_months: number;
  promo_type: string | null;
}

interface Member {
  user_id: string;
  role: string;
  full_name: string | null;
  email: string | null;
  username: string | null;
  plan_name: string | null;
  status: string | null;
  pay_status: string | null;
  expires_on: string | null;
}

interface MemberRow {
  user_id: string;
  role?: string | null;
  plan_name?: string | null;
  status?: string | null;
  pay_status?: string | null;
  expires_on?: string | null;
  profiles: ProfileRef[] | null;
}

interface ProfileRef {
  full_name: string | null;
  email: string | null;
  username: string | null;
}

const PROMO_COUNT: Record<string, number> = { "2x1": 2, "3x2": 3, "4x3": 4 };

export default function GymMembersPage() {
  const { userId } = useAuthState();
  const [gym, setGym] = useState<Gym | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [results, setResults] = useState<{ email: string; provisional_password: string }[]>([]);
  const [copied, setCopied] = useState(false);

  const [form, setForm] = useState({
    role: "alumno",
    plan_id: "",
  });
  const [people, setPeople] = useState([{ email: "", full_name: "", username: "" }]);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!userId) return;
      const supabase = createClient();
      const { data: gymData } = await supabase
        .from("gyms")
        .select("id, name, qr_code")
        .eq("owner_id", userId)
        .maybeSingle();
      if (!active || !gymData) {
        if (active) setLoading(false);
        return;
      }
      setGym(gymData as Gym);

      const { data: plansData } = await supabase
        .from("gym_plans")
        .select("*")
        .eq("gym_id", gymData.id)
        .order("created_at", { ascending: true });
      if (active) setPlans((plansData ?? []) as Plan[]);

      const { data: staff } = await supabase
        .from("gym_staff")
        .select("user_id, role, profiles:profiles!gym_staff_user_id_fkey(full_name, email, username)")
        .eq("gym_id", gymData.id);

      const { data: memberships } = await supabase
        .from("gym_memberships")
        .select("user_id, plan_name, status, pay_status, expires_on, profiles:profiles!gym_memberships_user_id_fkey(full_name, email, username)")
        .eq("gym_id", gymData.id)
        .order("created_at", { ascending: false });

      const mapMembers = (rows: MemberRow[] | null, type: string): Member[] =>
        (rows ?? []).map((r) => ({
          user_id: r.user_id,
          role: type,
          full_name: r.profiles?.[0]?.full_name ?? null,
          email: r.profiles?.[0]?.email ?? null,
          username: r.profiles?.[0]?.username ?? null,
          plan_name: r.plan_name ?? null,
          status: r.status ?? null,
          pay_status: r.pay_status ?? "pendiente",
          expires_on: r.expires_on ?? null,
        }));

      const all = [...mapMembers(staff, "profesor"), ...mapMembers(memberships, "alumno")];
      if (active) setMembers(all);
      if (active) setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [userId]);

  const selectedPlan = plans.find((p) => p.id === form.plan_id) ?? null;

  const setPromoCount = (n: number) => {
    setPeople((prev) => {
      const base = [{ email: "", full_name: "", username: "" }, ...(prev.slice(1) as typeof prev)];
      while (base.length < n) base.push({ email: "", full_name: "", username: "" });
      while (base.length > n) base.pop();
      return base;
    });
  };

  const createAll = async () => {
    if (!gym) return;
    const email = (i: number) => people[i]?.email?.trim();
    if (!email(0) || !people[0]?.full_name?.trim() || !people[0]?.username?.trim()) return;
    if (!selectedPlan) return;
    for (let i = 0; i < people.length; i++) {
      if (!people[i]?.email?.trim()) continue;
      setCreating(true);
      setResults([]);
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;

      const isExtras = i > 0;
      const member = people[i];
      const res = await fetch(FUNC_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
        },
        body: JSON.stringify({
          gym_id: gym.id,
          role: "alumno",
          full_name: member.full_name.trim(),
          username: member.username.trim(),
          email: member.email.trim(),
          plan_name: selectedPlan.name,
          pay_status: isExtras ? "promo" : "pagado",
          expires_on: calcExpiry(selectedPlan.duration_months),
          price: selectedPlan.price,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data?.error ?? "No se pudo crear el miembro");
        break;
      } else {
        setResults((prev) => [...prev, { email: data.email, provisional_password: data.provisional_password }]);
      }
    }
    setCreating(false);
    setPeople([{ email: "", full_name: "", username: "" }]);
    setForm({ role: "alumno", plan_id: "" });
  };

  const calcExpiry = (months: number) => {
    const d = new Date();
    d.setMonth(d.getMonth() + months);
    return d.toISOString().split("T")[0];
  };

  const copyAll = () => {
    const text = results.map((r) => `${r.email} / ${r.provisional_password}`).join("\n");
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
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

  const badgePay = (s: string | null) => {
    if (s === "pagado") return <span className="rounded-full bg-neon/20 px-2 py-0.5 text-[10px] font-semibold text-neon">💰 Pagó</span>;
    if (s === "promo") return <span className="rounded-full bg-ember/20 px-2 py-0.5 text-[10px] font-semibold text-ember">🎁 Promo</span>;
    return <span className="rounded-full bg-muted/20 px-2 py-0.5 text-[10px] font-semibold text-muted">⏳ Pendiente</span>;
  };

  return (
    <main className="mx-auto max-w-md px-4 pt-5">
      <h1 className="text-xl font-bold text-ink">Miembros</h1>
      <p className="mt-1 text-sm text-muted">Creá las cuentas de tus alumnos y profesores.</p>

      <div className="mt-5 rounded-2xl border border-edge bg-card p-4">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
          <UserPlus className="h-4 w-4 text-neon" /> Alta de miembro
        </p>

        <div className="mt-3 space-y-2">
          <select
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
            className="w-full rounded-lg border border-edge bg-elevated px-3 py-2 text-sm text-ink focus:border-neon focus:outline-none"
          >
            <option value="alumno">Alumno</option>
            <option value="profesor">Profesor</option>
          </select>

          {form.role === "alumno" && (
            <>
              <select
                value={form.plan_id}
                onChange={(e) => {
                  setForm({ ...form, plan_id: e.target.value });
                  const pl = plans.find((p) => p.id === e.target.value);
                  if (pl?.promo_type) setPromoCount(PROMO_COUNT[pl.promo_type] ?? 2);
                }}
                className="w-full rounded-lg border border-edge bg-elevated px-3 py-2 text-sm text-ink focus:border-neon focus:outline-none"
              >
                <option value="">Elegí un plan…</option>
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · ${p.price} ({p.duration_months} mes{p.duration_months > 1 ? "es" : ""})
                  </option>
                ))}
              </select>

              {selectedPlan?.promo_type && (
                <div className="rounded-xl border border-ember/30 bg-ember/10 p-3">
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-ember">
                    <Gift className="h-3.5 w-3.5" />
                    Promo {selectedPlan.promo_type}: el primero paga, {selectedPlan.promo_type === "2x1" ? "el segundo" : "el resto"} entra gratis el primer mes
                  </p>
                </div>
              )}
            </>
          )}

          {people.map((person, i) => (
            <div key={i} className="space-y-2 rounded-xl border border-edge bg-elevated p-2">
              {i > 0 && (
                <p className="text-[10px] font-bold uppercase tracking-wide text-ember">
                  🎁 Extra de promo (gratis ese mes)
                </p>
              )}
              <input
                value={person.full_name}
                onChange={(e) => setPeople((prev) => prev.map((p, j) => (j === i ? { ...p, full_name: e.target.value } : p)))}
                placeholder="Nombre completo"
                className="w-full rounded-lg border border-edge bg-card px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-neon focus:outline-none"
              />
              <input
                value={person.email}
                onChange={(e) => setPeople((prev) => prev.map((p, j) => (j === i ? { ...p, email: e.target.value } : p)))}
                placeholder="Email"
                type="email"
                className="w-full rounded-lg border border-edge bg-card px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-neon focus:outline-none"
              />
              <input
                value={person.username}
                onChange={(e) => setPeople((prev) => prev.map((p, j) => (j === i ? { ...p, username: e.target.value.replace(/\s/g, "") } : p)))}
                placeholder="@usuario"
                className="w-full rounded-lg border border-edge bg-card px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-neon focus:outline-none"
              />
            </div>
          ))}

          <button
            onClick={createAll}
            disabled={creating || people.length === 0 || !people[0].email || !requeried(people[0])}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-neon py-2.5 text-sm font-semibold text-bg shadow-neon disabled:opacity-60"
          >
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            {creating ? "Creando cuentas…" : `Crear ${people.length} cuenta${people.length > 1 ? "s" : ""}`}
          </button>
        </div>

        {results.length > 0 && (
          <div className="mt-3 rounded-xl border border-ember/40 bg-ember/10 p-3">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-ember">
              <KeyRound className="h-3.5 w-3.5" /> Cuentas creadas
            </p>
            <div className="mt-2 space-y-1.5 text-sm text-ink">
              {results.map((r, i) => (
                <div key={i} className="rounded-lg bg-card p-2">
                  <p className="text-xs text-muted">{i === 0 ? "💰 Paga" : "🎁 Promo"}</p>
                  <p className="font-medium">{r.email}</p>
                  <p className="font-mono text-neon">{r.provisional_password}</p>
                </div>
              ))}
            </div>
            <button
              onClick={copyAll}
              className="mt-2 flex items-center gap-1.5 rounded-lg border border-edge bg-card px-3 py-1.5 text-xs font-medium text-ink"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-neon" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copiado" : "Copiar credenciales"}
            </button>
          </div>
        )}
      </div>

      <div className="mt-6">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
          <Users className="h-4 w-4 text-neon" /> Lista de miembros
        </p>
        {members.length === 0 ? (
          <p className="mt-3 text-xs text-muted">Todavía no hay miembros.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {members.map((m) => (
              <div key={m.user_id} className="flex items-center justify-between rounded-xl border border-edge bg-card p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">{m.full_name ?? m.username ?? m.email}</p>
                  <p className="truncate text-xs text-muted">
                    @{m.username} · {m.email}
                  </p>
                  {m.pay_status === "pendiente" && (
                    <p className="mt-0.5 text-[10px] text-muted">{m.plan_name ?? "Plan"} · vence {m.expires_on ?? "—"}</p>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      m.role === "profesor" ? "bg-ember/20 text-ember" : "bg-neon/20 text-neon"
                    }`}
                  >
                    {m.role === "profesor" ? "Profesor" : "Alumno"}
                  </span>
                  {m.role === "alumno" && badgePay(m.pay_status)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function requeried(person: { email: string; full_name: string; username: string }) {
  return !!person.full_name.trim() && !!person.username.trim();
}