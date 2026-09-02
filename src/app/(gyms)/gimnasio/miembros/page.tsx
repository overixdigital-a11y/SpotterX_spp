"use client";

import { useEffect, useState } from "react";
import { UserPlus, Loader2, KeyRound, Copy, Check, Users, Gift } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuthState } from "@/lib/auth-context";

const FUNC_URL = "/api/invite-member";

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
  const [results, setResults] = useState<{ email: string; provisional_password?: string; existing?: boolean; message?: string }[]>([]);
  const [copied, setCopied] = useState(false);

  const [form, setForm] = useState({
    role: "alumno",
    plan_id: "",
  });
  const [people, setPeople] = useState([{ email: "", full_name: "", username: "" }]);

  const loadMembers = async (gymId: string) => {
    const supabase = createClient();
    const { data: staff } = await supabase
      .from("gym_staff")
      .select("user_id, role, profiles:profiles!gym_staff_user_id_fkey(full_name, email, username)")
      .eq("gym_id", gymId);

    const { data: memberships } = await supabase
      .from("gym_memberships")
      .select("user_id, plan_name, status, pay_status, expires_on, profiles:profiles!gym_memberships_user_id_fkey(full_name, email, username)")
      .eq("gym_id", gymId)
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

    setMembers([...mapMembers(staff, "profesor"), ...mapMembers(memberships, "alumno")]);
  };

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

      await loadMembers(gymData.id);
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
    if (!email(0)) return;
    setCreating(true);
    setResults([]);

    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token;

    for (let i = 0; i < people.length; i++) {
      if (!people[i]?.email?.trim()) continue;
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
          role: form.role,
          full_name: member.full_name.trim(),
          username: member.username.trim(),
          email: member.email.trim(),
          plan_name: form.role === "alumno" ? (selectedPlan?.name ?? "General") : null,
          pay_status: isExtras ? "promo" : "pagado",
          expires_on: selectedPlan ? calcExpiry(selectedPlan.duration_months) : null,
          price: selectedPlan?.price ?? null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data?.error ?? "No se pudo procesar el miembro");
        break;
      } else {
        setResults((prev) => [
          ...prev,
          {
            email: data.email,
            provisional_password: data.provisional_password,
            existing: data.existing,
            message: data.message,
          },
        ]);
      }
    }

    await loadMembers(gym.id);
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
    const text = results
      .filter((r) => !r.existing && r.provisional_password)
      .map((r) => `${r.email} / ${r.provisional_password}`)
      .join("\n");
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
    <main className="mx-auto max-w-5xl px-4 pt-2 md:pt-4">
      <div className="border-b border-edge/60 pb-4">
        <h1 className="text-2xl font-bold text-ink">Gestión de Miembros</h1>
        <p className="mt-0.5 text-sm text-muted">
          Creá cuentas para tus alumnos y profesores, configurá sus planes y controla sus accesos.
        </p>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Formulario Alta de Miembros */}
        <div className="lg:col-span-1 space-y-4 rounded-2xl border border-edge bg-card p-5 h-fit">
          <p className="flex items-center gap-2 text-base font-bold text-ink">
            <UserPlus className="h-5 w-5 text-neon" /> Alta de Miembro
          </p>

          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-muted">Rol de Usuario</label>
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                className="w-full rounded-xl border border-edge bg-bg px-3.5 py-2.5 text-sm text-ink focus:border-neon focus:outline-none"
              >
                <option value="alumno">Alumno</option>
                <option value="profesor">Profesor / Staff</option>
              </select>
            </div>

            {form.role === "alumno" && (
              <div key="plan-select-block" className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-muted">Plan de Membresía</label>
                  <select
                    value={form.plan_id}
                    onChange={(e) => {
                      setForm({ ...form, plan_id: e.target.value });
                      const pl = plans.find((p) => p.id === e.target.value);
                      if (pl?.promo_type) setPromoCount(PROMO_COUNT[pl.promo_type] ?? 2);
                    }}
                    className="w-full rounded-xl border border-edge bg-bg px-3.5 py-2.5 text-sm text-ink focus:border-neon focus:outline-none"
                  >
                    <option value="">Elegí un plan…</option>
                    {plans.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} · ${p.price} ({p.duration_months} mes{p.duration_months > 1 ? "es" : ""})
                      </option>
                    ))}
                  </select>
                </div>

                {selectedPlan?.promo_type && (
                  <div key="promo-banner" className="rounded-xl border border-ember/30 bg-ember/10 p-3 space-y-1">
                    <p className="flex items-center gap-1.5 text-xs font-semibold text-ember">
                      <Gift className="h-4 w-4" />
                      Promo {selectedPlan.promo_type} activa
                    </p>
                    <p className="text-[11px] text-ember/80">
                      El primer miembro abona el plan y los demás entran gratis el primer mes.
                    </p>
                  </div>
                )}
              </div>
            )}

            <div key="people-inputs-list" className="space-y-3">
              {people.map((person, i) => (
                <div key={`person-field-${i}`} className="space-y-2 rounded-xl border border-edge bg-bg p-3">
                  {i > 0 && (
                    <p className="text-[11px] font-bold uppercase tracking-wide text-ember">
                      🎁 Beneficiario Extra de Promo
                    </p>
                  )}
                  <div>
                    <input
                      value={person.full_name}
                      onChange={(e) => setPeople((prev) => prev.map((p, j) => (j === i ? { ...p, full_name: e.target.value } : p)))}
                      placeholder="Nombre y apellido"
                      className="w-full rounded-lg border border-edge bg-card px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-neon focus:outline-none"
                    />
                  </div>
                  <div>
                    <input
                      value={person.email}
                      onChange={(e) => setPeople((prev) => prev.map((p, j) => (j === i ? { ...p, email: e.target.value } : p)))}
                      placeholder="correo@ejemplo.com"
                      type="email"
                      className="w-full rounded-lg border border-edge bg-card px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-neon focus:outline-none"
                    />
                  </div>
                  <div>
                    <input
                      value={person.username}
                      onChange={(e) => setPeople((prev) => prev.map((p, j) => (j === i ? { ...p, username: e.target.value.replace(/\s/g, "") } : p)))}
                      placeholder="@usuario"
                      className="w-full rounded-lg border border-edge bg-card px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-neon focus:outline-none"
                    />
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={createAll}
              disabled={creating || people.length === 0 || !people[0].email || !requeried(people[0])}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-neon py-3 font-semibold text-bg shadow-neon transition hover:opacity-90 disabled:opacity-60"
            >
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
              {creating ? "Procesando…" : `Registrar ${people.length} cuenta${people.length > 1 ? "s" : ""}`}
            </button>
          </div>

          {results.length > 0 && (
            <div key="results-summary-card" className="mt-4 rounded-xl border border-neon/40 bg-neon/10 p-3 space-y-2">
              <p className="flex items-center gap-1.5 text-xs font-bold text-neon">
                <KeyRound className="h-4 w-4" /> Resultado del Registro
              </p>
              <div className="space-y-1.5 text-sm text-ink">
                {results.map((r, i) => (
                  <div key={`result-item-${i}`} className="rounded-lg bg-card p-2.5 text-xs border border-edge space-y-1">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-ink">{r.email}</p>
                      {r.existing ? (
                        <span className="rounded-full bg-neon/20 px-2 py-0.5 text-[9px] font-bold text-neon border border-neon/30">
                          🟢 Usuario existente
                        </span>
                      ) : (
                        <span className="rounded-full bg-ember/20 px-2 py-0.5 text-[9px] font-bold text-ember border border-ember/30">
                          🔑 Cuenta nueva
                        </span>
                      )}
                    </div>
                    {r.existing ? (
                      <p className="text-[11px] text-muted">
                        {r.message || "El usuario ya estaba registrado en SpotterX y fue vinculado a tu gimnasio."}
                      </p>
                    ) : (
                      <p className="font-mono text-neon text-xs">
                        Clave provisoria: <span className="font-bold">{r.provisional_password}</span>
                      </p>
                    )}
                  </div>
                ))}
              </div>
              {results.some((r) => !r.existing) && (
                <button
                  onClick={copyAll}
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-edge bg-card py-2 text-xs font-medium text-ink transition hover:border-neon/40 hover:text-neon"
                >
                  {copied ? <Check className="h-4 w-4 text-neon" /> : <Copy className="h-4 w-4" />}
                  {copied ? "¡Copias al portapapeles!" : "Copiar credenciales nuevas"}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Tabla / Lista de Miembros */}
        <div className="lg:col-span-2 space-y-4 rounded-2xl border border-edge bg-card p-5">
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-2 text-base font-bold text-ink">
              <Users className="h-5 w-5 text-neon" /> Miembros Registrados
            </p>
            <span className="rounded-full bg-elevated px-3 py-1 text-xs font-bold text-neon border border-neon/20">
              Total: {members.length}
            </span>
          </div>

          {members.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted">
              Todavía no registraste miembros en tu gimnasio.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-ink">
                <thead className="border-b border-edge bg-elevated/40 text-[11px] font-bold uppercase tracking-wider text-muted">
                  <tr>
                    <th className="px-3 py-3">Usuario / Email</th>
                    <th className="px-3 py-3">Rol</th>
                    <th className="px-3 py-3">Plan</th>
                    <th className="px-3 py-3">Estado Pago</th>
                    <th className="px-3 py-3 text-right">Vencimiento</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-edge/60">
                  {members.map((m, idx) => (
                    <tr key={`${m.user_id}-${m.role}-${idx}`} className="hover:bg-elevated/30 transition">
                      <td className="px-3 py-3">
                        <p className="font-semibold text-ink">{m.full_name ?? m.username ?? m.email}</p>
                        <p className="text-xs text-muted">@{m.username || "sin_username"} · {m.email}</p>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
                            m.role === "profesor" ? "bg-ember/20 text-ember border border-ember/30" : "bg-neon/20 text-neon border border-neon/30"
                          }`}
                        >
                          {m.role === "profesor" ? "Profesor" : "Alumno"}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-xs text-muted whitespace-nowrap">
                        {m.plan_name ?? "General"}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        {m.role === "alumno" ? badgePay(m.pay_status) : <span className="text-xs text-muted">—</span>}
                      </td>
                      <td className="px-3 py-3 text-right text-xs font-mono text-muted whitespace-nowrap">
                        {m.expires_on ? new Date(m.expires_on).toLocaleDateString("es-AR") : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function requeried(person: { email: string; full_name: string; username: string }) {
  return !!person.full_name.trim() && !!person.username.trim();
}