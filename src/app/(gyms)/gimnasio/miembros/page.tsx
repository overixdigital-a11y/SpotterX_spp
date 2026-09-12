"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { UserPlus, Loader2, KeyRound, Copy, Check, Users, Gift, XCircle, ChevronRight, Search, Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuthState } from "@/lib/auth-context";
import { Avatar } from "@/components/core/Avatar";
import { useToast } from "@/components/core/ToastProvider";

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
  price?: number | null;
}

interface SearchPerson {
  id: string;
  username: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  role: string;
}

const PROMO_COUNT: Record<string, number> = { "2x1": 2, "3x2": 3, "4x3": 4 };

export default function GymMembersPage() {
  const { userId } = useAuthState();
  const toast = useToast();
  const [gym, setGym] = useState<Gym | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [results, setResults] = useState<{ email: string; provisional_password: string; existed?: boolean }[]>([]);
  const [copied, setCopied] = useState(false);
  const [search, setSearch] = useState("");
  const [reactivating, setReactivating] = useState<Member | null>(null);
  const [reactivatePlan, setReactivatePlan] = useState("");
  const [searchQ, setSearchQ] = useState("");
  const [searchRes, setSearchRes] = useState<SearchPerson[]>([]);
  const [memberIds, setMemberIds] = useState<Set<string>>(new Set());
  const [staffIds, setStaffIds] = useState<Set<string>>(new Set());
  const [busyAdd, setBusyAdd] = useState<string | null>(null);
  const [picking, setPicking] = useState<SearchPerson | null>(null);
  const [alumnoPlan, setAlumnoPlan] = useState("");

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
        .select("user_id, role")
        .eq("gym_id", gymData.id);

      const { data: memberships } = await supabase
        .from("gym_memberships")
        .select("user_id, plan_name, status, pay_status, expires_on")
        .eq("gym_id", gymData.id)
        .order("created_at", { ascending: false });

      const userIds = Array.from(
        new Set([
          ...(staff ?? []).map((r) => r.user_id),
          ...(memberships ?? []).map((r) => r.user_id),
        ])
      );

      const { data: profileRows } = userIds.length
        ? await supabase
            .from("profiles")
            .select("id, full_name, email, username")
            .in("id", userIds)
        : { data: null };

      const profileMap = new Map<string, { full_name: string | null; email: string | null; username: string | null }>();
      (profileRows ?? []).forEach((p) =>
        profileMap.set(p.id, {
          full_name: p.full_name ?? null,
          email: p.email ?? null,
          username: p.username ?? null,
        })
      );

      const mapMembers = (rows: { user_id: string; plan_name?: string | null; status?: string | null; pay_status?: string | null; expires_on?: string | null }[] | null, type: string): Member[] =>
        (rows ?? []).map((r) => {
          const prof = profileMap.get(r.user_id);
          return {
            user_id: r.user_id,
            role: type,
            full_name: prof?.full_name ?? null,
            email: prof?.email ?? null,
            username: prof?.username ?? null,
            plan_name: r.plan_name ?? null,
            status: r.status ?? null,
            pay_status: r.pay_status ?? "pendiente",
            expires_on: r.expires_on ?? null,
          };
        });

      const all = [...mapMembers(staff, "profesor"), ...mapMembers(memberships, "alumno")];
      if (active) {
        setMembers(all);
        setMemberIds(new Set((memberships ?? []).map((r) => r.user_id)));
        setStaffIds(new Set((staff ?? []).map((r) => r.user_id)));
      }
      if (active) setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [userId]);

  // Búsqueda estilo Instagram: personas de la app por nombre o @usuario
  useEffect(() => {
    let active = true;
    const t = setTimeout(async () => {
      const q = searchQ.trim();
      if (!q) {
        if (active) setSearchRes([]);
        return;
      }
      const supabase = createClient();
      const { data } = await supabase
        .from("profiles")
        .select("id, username, full_name, email, avatar_url, role")
        .or(`username.ilike.%${q}%,full_name.ilike.%${q}%`)
        .neq("id", userId)
        .limit(12);
      if (active) setSearchRes((data as SearchPerson[] | null) ?? []);
    }, 250);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [searchQ, userId]);

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
    if (form.role === "alumno" && !selectedPlan) return;
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
      const plan = form.role === "alumno" ? selectedPlan : null;
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
          plan_name: plan?.name,
          pay_status: form.role === "alumno" ? (isExtras ? "promo" : "pagado") : "pendiente",
          expires_on: plan ? calcExpiry(plan.duration_months) : null,
          price: plan?.price ?? null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data?.error ?? "No se pudo crear el miembro");
        break;
      } else {
        setResults((prev) => [
          ...prev,
          { email: data.email, provisional_password: data.provisional_password, existed: !!data.existed },
        ]);
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
    const text = results
      .filter((r) => !r.existed)
      .map((r) => `${r.email} / ${r.provisional_password}`)
      .join("\n");
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const cancelMembership = async (m: Member) => {
    if (!gym) return;
    if (!window.confirm(`¿Dar de baja a ${m.full_name ?? m.username ?? m.email}?`)) return;
    const supabase = createClient();
    const { error } = await supabase
      .from("gym_memberships")
      .update({ status: "inactiva" })
      .eq("gym_id", gym.id)
      .eq("user_id", m.user_id);
    if (error) {
      alert("Error al cancelar: " + error.message);
      return;
    }
    setMembers((prev) =>
      prev.map((mem) =>
        mem.user_id === m.user_id ? { ...mem, status: "inactiva" } : mem
      )
    );
  };

  const confirmReactivate = async () => {
    if (!gym || !reactivating) return;
    if (!reactivatePlan) {
      alert("Elegí un plan para reactivar");
      return;
    }
    const plan = plans.find((p) => p.id === reactivatePlan);
    const supabase = createClient();
    const d = new Date();
    d.setMonth(d.getMonth() + (plan?.duration_months ?? 1));
    const newExpiry = d.toISOString().split("T")[0];
    const { error } = await supabase
      .from("gym_memberships")
      .update({ status: "activa", plan_name: plan?.name ?? null, pay_status: "pagado", expires_on: newExpiry, price: plan?.price ?? null })
      .eq("gym_id", gym.id)
      .eq("user_id", reactivating.user_id);
    if (error) {
      alert("Error al reactivar: " + error.message);
      return;
    }
    setMembers((prev) =>
      prev.map((mem) =>
        mem.user_id === reactivating.user_id
          ? { ...mem, status: "activa", plan_name: plan?.name ?? null, pay_status: "pagado", expires_on: newExpiry, price: plan?.price ?? null }
          : mem
      )
    );
    setReactivating(null);
    setReactivatePlan("");
  };

  const confirmAlumno = async () => {
    if (!gym || !picking) return;
    const plan = plans.find((p) => p.id === alumnoPlan);
    if (!plan) {
      toast("Elegí un plan para el alumno", "error");
      return;
    }
    setBusyAdd(picking.id);
    const supabase = createClient();
    const d = new Date();
    d.setMonth(d.getMonth() + (plan.duration_months ?? 1));
    const expires = d.toISOString().split("T")[0];
    const { error } = await supabase.from("gym_memberships").upsert(
      {
        gym_id: gym.id,
        user_id: picking.id,
        plan_name: plan.name,
        price: plan.price,
        status: "activa",
        pay_status: "pagado",
        expires_on: expires,
      },
      { onConflict: "gym_id,user_id" }
    );
    setBusyAdd(null);
    if (error) {
      toast("No se pudo agregar: " + error.message, "error");
      return;
    }
    const { data: staffRows } = await supabase
      .from("gym_staff")
      .select("user_id")
      .eq("gym_id", gym.id)
      .eq("role", "profesor_invitado");
    if (staffRows && staffRows.length > 0) {
      await supabase.from("trainer_students").upsert(
        (staffRows as { user_id: string }[]).map((s) => ({
          trainer_id: s.user_id,
          student_id: picking.id,
          source: "gym",
          active: true,
        })),
        { onConflict: "trainer_id,student_id" }
      );
    }
    setPicking(null);
    setAlumnoPlan("");
    setMemberIds((prev) => new Set(prev).add(picking.id));
    setMembers((prev) => [
      {
        user_id: picking.id,
        role: "alumno",
        full_name: picking.full_name,
        email: picking.email,
        username: picking.username,
        plan_name: plan.name,
        status: "activa",
        pay_status: "pagado",
        expires_on: expires,
        price: plan.price,
      },
      ...prev,
    ]);
    toast(`${picking.full_name ?? picking.username} ahora es alumno del gym`);
  };

  const addProfesor = async (p: SearchPerson) => {
    if (!gym) return;
    setBusyAdd(p.id);
    const supabase = createClient();
    const { error } = await supabase.from("gym_staff").upsert(
      { gym_id: gym.id, user_id: p.id, role: "profesor_invitado", authorized: true },
      { onConflict: "gym_id,user_id" }
    );
    setBusyAdd(null);
    if (error) {
      toast("No se pudo agregar: " + error.message, "error");
      return;
    }
    const { data: memberRows } = await supabase
      .from("gym_memberships")
      .select("user_id")
      .eq("gym_id", gym.id)
      .eq("status", "activa");
    if (memberRows && memberRows.length > 0) {
      await supabase.from("trainer_students").upsert(
        (memberRows as { user_id: string }[]).map((m) => ({
          trainer_id: p.id,
          student_id: m.user_id,
          source: "gym",
          active: true,
        })),
        { onConflict: "trainer_id,student_id" }
      );
    }
    setStaffIds((prev) => new Set(prev).add(p.id));
    setMembers((prev) => [
      {
        user_id: p.id,
        role: "profesor",
        full_name: p.full_name,
        email: p.email,
        username: p.username,
        plan_name: null,
        status: null,
        pay_status: "pendiente",
        expires_on: null,
      },
      ...prev,
    ]);
    toast(`${p.full_name ?? p.username} ahora es profesor del gym`);
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
          <Search className="h-4 w-4 text-neon" /> Agregar por búsqueda
        </p>
        <p className="mt-0.5 text-xs text-muted">
          Buscá por nombre o @usuario a alguien que ya esté en la app y agregalo como alumno o profesor.
        </p>

        <div className="mt-3 flex items-center gap-2 rounded-xl border border-edge bg-elevated px-3 py-2.5">
          <Search className="h-4 w-4 shrink-0 text-muted" />
          <input
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            placeholder="Buscar personas…"
            className="w-full bg-transparent text-sm text-ink placeholder:text-muted focus:outline-none"
          />
        </div>

        {searchQ.trim() && searchRes.length === 0 && (
          <p className="pt-3 text-center text-xs text-muted">Sin resultados para «{searchQ.trim()}».</p>
        )}

        {searchRes.length > 0 && (
          <div className="mt-2 max-h-80 overflow-y-auto">
            {searchRes.map((p) => {
              const isMember = memberIds.has(p.id);
              const isStaff = staffIds.has(p.id);
              return (
                <div key={p.id} className="flex items-center gap-3 border-b border-edge py-2.5 last:border-b-0">
                  <Avatar src={p.avatar_url} name={p.full_name} username={p.username} size="sm" ring={false} />
                  <div className="min-w-0 flex-1 leading-tight">
                    <p className="truncate text-sm font-semibold text-ink">{p.full_name || p.username}</p>
                    <p className="truncate text-xs text-muted">
                      @{p.username} · {p.role}
                      {isMember && <span className="ml-1 text-neon"> · Alumno ✓</span>}
                      {isStaff && <span className="ml-1 text-ember"> · Profesor ✓</span>}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    <button
                      onClick={() => {
                        setPicking(p);
                        setAlumnoPlan("");
                      }}
                      disabled={isMember || busyAdd === p.id}
                      className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition active:scale-95 disabled:opacity-50 ${
                        isMember ? "border border-neon/30 bg-neon/10 text-neon" : "border border-transparent bg-neon text-bg shadow-neon"
                      }`}
                    >
                      {isMember ? (
                        "✓ Alumno"
                      ) : busyAdd === p.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <>
                          <UserPlus className="h-3.5 w-3.5" /> Alumno
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => addProfesor(p)}
                      disabled={isStaff || busyAdd === p.id}
                      className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition active:scale-95 disabled:opacity-50 ${
                        isStaff ? "border border-ember/30 bg-ember/10 text-ember" : "border border-transparent bg-ember text-bg"
                      }`}
                    >
                      {isStaff ? (
                        "✓ Profesor"
                      ) : busyAdd === p.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <>
                          <UserPlus className="h-3.5 w-3.5" /> Profesor
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

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
                  <p className="text-xs text-muted">
                    {form.role === "profesor"
                      ? r.existed
                        ? "Vinculado como profesor"
                        : "Profesor"
                      : r.existed
                        ? "Vincular cuenta existente"
                        : i === 0
                          ? "💰 Paga"
                          : "🎁 Promo"}
                  </p>
                  <p className="font-medium">{r.email}</p>
                  {r.existed ? (
                    <p className="text-xs text-neon">
                      {form.role === "profesor"
                        ? "✓ Vinculado como profesor del gimnasio"
                        : "✓ Vinculada como miembro del gimnasio"}
                    </p>
                  ) : (
                    <p className="font-mono text-neon">{r.provisional_password}</p>
                  )}
                </div>
              ))}
            </div>
            <button
              onClick={copyAll}
              disabled={results.some((r) => r.existed) && results.every((r) => r.existed)}
              className="mt-2 flex items-center gap-1.5 rounded-lg border border-edge bg-card px-3 py-1.5 text-xs font-medium text-ink disabled:opacity-50"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-neon" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copiado" : "Copiar credenciales"}
            </button>
          </div>
        )}
      </div>

      {/* CSV Import */}
      <div className="mt-6 rounded-2xl border border-edge bg-card p-4">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
          <Upload className="h-4 w-4 text-ember" /> Importar desde CSV
        </p>
        <p className="mt-0.5 text-xs text-muted">
          Subí un archivo .csv con columnas: nombre, email, teléfono (opcional), plan (opcional), rol (alumno/profesor, default: alumno).
        </p>
        <label className="mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-ember/40 bg-ember/5 py-3 text-xs font-semibold text-ember">
          <Upload className="h-4 w-4" />
          Elegir archivo CSV
          <input
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = (ev) => {
                const text = ev.target?.result as string;
                const lines = text.split("\n").filter((l) => l.trim());
                const rows = lines.slice(1).map((line) => {
                  const cols = line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
                  return {
                    full_name: cols[0] ?? "",
                    email: cols[1] ?? "",
                    username: (cols[1] ?? "").split("@")[0] || `user_${Math.random().toString(36).slice(2, 6)}`,
                    role: (cols[4] ?? "alumno").toLowerCase().includes("profe") ? "profesor" : "alumno",
                    plan_name: cols[3] || undefined,
                  };
                }).filter((r) => r.full_name && r.email);
                if (rows.length === 0) {
                  alert("No se encontraron filas válidas en el CSV");
                  return;
                }
                if (!confirm(`¿Importar ${rows.length} miembros?`)) return;
                // Import via invite-member batch
                const importAll = async () => {
                  const supa = createClient();
                  const token = (await supa.auth.getSession()).data.session?.access_token;
                  const res = await fetch(FUNC_URL, {
                    method: "POST",
                    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
                    body: JSON.stringify({ gym_id: gym.id, users: rows, as_admin: false }),
                  });
                  const data = await res.json();
                  if (data.error) {
                    alert(`Error: ${data.error}`);
                    return;
                  }
                  const results = data.results ?? [data];
                  const created = results.filter((r: { ok?: boolean }) => r.ok).length;
                  const existed = results.filter((r: { existed?: boolean }) => r.existed).length;
                  const errors = results.filter((r: { ok?: boolean }) => !r.ok);
                  alert(`Importados: ${created} nuevos, ${existed} ya existentes${errors.length > 0 ? `, ${errors.length} errores` : ""}`);
                  window.location.reload();
                };
                importAll();
              };
              reader.readAsText(file);
              e.target.value = "";
            }}
          />
        </label>
      </div>

      <div className="mt-6">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
          <Users className="h-4 w-4 text-neon" /> Lista de miembros
        </p>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre, usuario o email…"
          className="mt-3 w-full rounded-xl border border-edge bg-card px-3.5 py-2.5 text-sm text-ink placeholder:text-muted focus:border-neon focus:outline-none"
        />
        {members.length === 0 ? (
          <p className="mt-3 text-xs text-muted">Todavía no hay miembros.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {members
              .filter((m) => {
                if (!search.trim()) return true;
                const q = search.trim().toLowerCase();
                return (
                  (m.full_name ?? "").toLowerCase().includes(q) ||
                  (m.username ?? "").toLowerCase().includes(q) ||
                  (m.email ?? "").toLowerCase().includes(q)
                );
              })
              .map((m) => (
                <Link
                  key={m.user_id}
                  href={`/gimnasio/miembros/${m.user_id}`}
                  className="flex items-center justify-between gap-2 rounded-xl border border-edge bg-card p-3 transition hover:border-neon/40"
                >
                  <div className="min-w-0">  
                    <p className="truncate text-sm font-semibold text-ink">{m.full_name ?? m.username ?? m.email}</p>
                    <p className="truncate text-xs text-muted">
                      @{m.username} · {m.email}
                    </p>
                    {(m.status === "inactiva" || m.pay_status === "pendiente") && (
                      <p className="mt-0.5 text-[10px] text-muted">
                        {m.plan_name ?? "Plan"} · vence {m.expires_on ?? "—"}
                      </p>
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
                    {m.role === "alumno" && m.status === "activa" && (
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          cancelMembership(m);
                        }}
                        className="flex items-center gap-1 rounded-lg border border-ember/30 py-1 px-2 text-[10px] font-semibold text-ember transition hover:bg-ember/10"
                      >
                        <XCircle className="h-3 w-3" /> Cancelar
                      </button>
                    )}
                    {m.role === "alumno" && m.status === "inactiva" && (
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setReactivating(m);
                          const prev = plans.find((p) => p.name === m.plan_name);
                          setReactivatePlan(prev?.id ?? "");
                        }}
                        className="rounded-lg border border-neon/40 bg-neon/10 py-1 px-2 text-[10px] font-semibold text-neon transition hover:bg-neon/20"
                      >
                        Reactivar
                      </button>
                    )}
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-neon/60" />
                </Link>
              ))}
            {search.trim() &&
              members.filter((m) =>
                (m.full_name ?? "").toLowerCase().includes(search.trim().toLowerCase()) ||
                (m.username ?? "").toLowerCase().includes(search.trim().toLowerCase()) ||
                (m.email ?? "").toLowerCase().includes(search.trim().toLowerCase())
              ).length === 0 && (
                <p className="pt-2 text-center text-xs text-muted">No se encontraron personas con «{search}».</p>
              )}
          </div>
        )}
      </div>

      {reactivating && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl border border-edge bg-elevated p-5">
            <p className="text-sm font-bold text-ink">Reactivar a {reactivating.full_name ?? reactivating.username ?? reactivating.email}</p>
            <p className="mt-1 text-xs text-muted">Elegí el plan para la nueva membresía. Se setea al día y con vencimiento según el plan.</p>
            <div className="mt-4 space-y-2">
              {plans.length === 0 ? (
                <p className="text-xs text-muted">No hay planes. Creá uno en la pestaña Planes.</p>
              ) : (
                plans.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setReactivatePlan(p.id)}
                    className={`flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left transition ${
                      reactivatePlan === p.id ? "border-neon bg-neon/10" : "border-edge bg-card"
                    }`}
                  >
                    <span className="text-sm font-semibold text-ink">{p.name}</span>
                    <span className="text-xs text-muted">
                      {p.duration_months} mes(es) · ${Number(p.price).toLocaleString("es-AR")}
                    </span>
                  </button>
                ))
              )}
            </div>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setReactivating(null)}
                className="flex-1 rounded-xl border border-edge py-2.5 text-sm font-medium text-muted"
              >
                Cancelar
              </button>
              <button
                onClick={confirmReactivate}
                disabled={!reactivatePlan}
                className="flex-1 rounded-xl bg-neon py-2.5 text-sm font-semibold text-bg disabled:opacity-50"
              >
                Reactivar
              </button>
            </div>
          </div>
        </div>
      )}

      {picking && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl border border-edge bg-elevated p-5">
            <p className="text-sm font-bold text-ink">Agregar a {picking.full_name ?? picking.username} como alumno</p>
            <p className="mt-1 text-xs text-muted">Elegí el plan. La membresía sale activa y pagada desde hoy.</p>
            <div className="mt-4 space-y-2">
              {plans.length === 0 ? (
                <p className="text-xs text-muted">No hay planes. Creá uno en la pestaña Planes.</p>
              ) : (
                plans.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setAlumnoPlan(p.id)}
                    className={`flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left transition ${
                      alumnoPlan === p.id ? "border-neon bg-neon/10" : "border-edge bg-card"
                    }`}
                  >
                    <span className="text-sm font-semibold text-ink">{p.name}</span>
                    <span className="text-xs text-muted">
                      {p.duration_months} mes{p.duration_months > 1 ? "es" : ""} · ${Number(p.price).toLocaleString("es-AR")}
                    </span>
                  </button>
                ))
              )}
            </div>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setPicking(null)}
                className="flex-1 rounded-xl border border-edge py-2.5 text-sm font-medium text-muted"
              >
                Cancelar
              </button>
              <button
                onClick={confirmAlumno}
                disabled={!alumnoPlan || busyAdd === picking.id}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-neon py-2.5 text-sm font-semibold text-bg disabled:opacity-50"
              >
                {busyAdd === picking.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                Agregar
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function requeried(person: { email: string; full_name: string; username: string }) {
  return !!person.full_name.trim() && !!person.username.trim();
}