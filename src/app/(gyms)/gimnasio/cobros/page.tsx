"use client";

import { useEffect, useState } from "react";
import { Loader2, Wallet, CheckCircle2, Clock3, ClipboardList } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useAuthState } from "@/lib/auth-context";
import { todayLocal } from "@/lib/format";
import { fetchProfiles, displayName, type ProfileLite } from "@/lib/profiles";

interface Gym {
  id: string;
}

interface Membership {
  id: string;
  user_id: string;
  plan_name: string;
  pay_status: string;
  status: string;
  expires_on: string | null;
}

interface Payment {
  id: string;
  user_id: string;
  amount: number;
  method: string;
  paid_at: string;
}

export default function GymCobrosPage() {
  const { userId } = useAuthState();
  const [gym, setGym] = useState<Gym | null>(null);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [profileMap, setProfileMap] = useState<Map<string, ProfileLite>>(new Map());
  const [monthCollected, setMonthCollected] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!userId) return;
      const supabase = createClient();
      const { data: g } = await supabase
        .from("gyms")
        .select("id")
        .eq("owner_id", userId)
        .maybeSingle();
      if (!active || !g) {
        if (active) setLoading(false);
        return;
      }
      setGym(g as Gym);

      const { data: membershipsData } = await supabase
        .from("gym_memberships")
        .select("id, user_id, plan_name, pay_status, status, expires_on")
        .eq("gym_id", g.id)
        .eq("status", "activa")
        .order("created_at", { ascending: false });

      const { data: paymentsData } = await supabase
        .from("gym_payments")
        .select("id, user_id, amount, method, paid_at")
        .eq("gym_id", g.id)
        .order("paid_at", { ascending: false })
        .limit(30);

      const profileMap = await fetchProfiles(supabase, [
        ...(membershipsData ?? []).map((m) => m.user_id),
        ...(paymentsData ?? []).map((p) => p.user_id),
      ]);

      // "Cobrado este mes" necesita el total REAL del mes, no la suma de los
      // ultimos 30 pagos que se muestran en el historial (bug del Lote 39).
      const monthStartIso = `${todayLocal().slice(0, 7)}-01`;
      const { data: monthRow } = await supabase
        .from("gym_payments")
        .select("amount")
        .eq("gym_id", g.id)
        .gte("paid_at", monthStartIso);
      const monthTotal = (monthRow ?? []).reduce((acc, p) => acc + (p.amount || 0), 0);

      if (active) setMemberships((membershipsData ?? []) as Membership[]);
      if (active) setPayments((paymentsData ?? []) as Payment[]);
      if (active) setProfileMap(profileMap);
      if (active) setMonthCollected(monthTotal);
      if (active) setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [userId]);

  const markPaid = async (m: Membership) => {
    if (!gym) return;
    setBusy(m.id);
    const supabase = createClient();
    const { data: plan } = await supabase
      .from("gym_plans")
      .select("duration_months, price")
      .eq("gym_id", gym.id)
      .eq("name", m.plan_name)
      .maybeSingle();
    const months = plan?.duration_months ?? 1;
    const price = typeof plan?.price === "number" ? plan.price : null;

    const base = m.expires_on && new Date(m.expires_on) > new Date() ? new Date(m.expires_on) : new Date();
    base.setMonth(base.getMonth() + months);
    const newExpiry = base.toISOString().split("T")[0];

    await supabase.from("gym_payments").insert({
      gym_id: gym.id,
      membership_id: m.id,
      user_id: m.user_id,
      amount: price ?? 0,
      method: "manual",
      note: `Cuota ${m.plan_name}`,
    });

    await supabase
      .from("gym_memberships")
      .update({ pay_status: "pagado", expires_on: newExpiry, price })
      .eq("id", m.id);

    setMemberships((prev) => prev.map((x) => (x.id === m.id ? { ...x, pay_status: "pagado", expires_on: newExpiry } : x)));
    setBusy(null);
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

  const nameOf = (userId: string) => displayName(profileMap.get(userId));

  const paidCount = memberships.filter((m) => m.pay_status === "pagado").length;
  const pendingCount = memberships.filter((m) => m.pay_status !== "pagado").length;

  return (
    <main className="mx-auto max-w-5xl px-4 pt-2 md:pt-4">
      <div className="border-b border-edge/60 pb-4">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-ink">
          <Wallet className="h-6 w-6 text-neon" /> Cobros y Cuotas
        </h1>
        <p className="mt-0.5 text-sm text-muted">
          Controlá la cobrabilidad de membresías, acreditá cuotas manuales y revisá el historial de caja.
        </p>
        <Link
          href="/gimnasio/contabilidad"
          className="mt-3 inline-flex items-center gap-2 rounded-lg border border-neon/40 bg-neon/5 px-3 py-2 text-xs font-semibold text-neon transition hover:bg-neon/10"
        >
          <ClipboardList className="h-4 w-4" />
          Ver contabilidad completa
        </Link>
      </div>

      {/* KPI Cards Grid */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-edge bg-card p-4 space-y-1">
          <p className="text-xs font-semibold text-muted">Cobrado este mes</p>
          <p className="text-2xl font-black text-neon">${monthCollected.toLocaleString("es-AR")}</p>
        </div>
        <div className="rounded-2xl border border-edge bg-card p-4 space-y-1">
          <p className="text-xs font-semibold text-muted">Miembros al Día</p>
          <p className="text-2xl font-black text-ink">{paidCount} <span className="text-xs font-normal text-muted">/ {memberships.length}</span></p>
        </div>
        <div className="rounded-2xl border border-edge bg-card p-4 space-y-1">
          <p className="text-xs font-semibold text-muted">Cuotas Pendientes / Promo</p>
          <p className="text-2xl font-black text-ember">{pendingCount}</p>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Miembros Activos & Gestión de Cuotas */}
        <div className="space-y-4 rounded-2xl border border-edge bg-card p-5">
          <div className="flex items-center justify-between">
            <p className="text-base font-bold text-ink">Miembros Activos</p>
            <span className="rounded-full bg-elevated px-2.5 py-1 text-xs font-semibold text-muted">
              {memberships.length} alumnos
            </span>
          </div>

          {memberships.length === 0 ? (
            <p className="py-8 text-center text-xs text-muted">Todavía no hay miembros activos.</p>
          ) : (
            <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
              {memberships.map((m) => (
                <div key={m.id} className="rounded-xl border border-edge bg-bg p-3.5 transition hover:border-neon/30">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink">{nameOf(m.user_id)}</p>
                      <p className="text-xs text-muted">
                        {m.plan_name} · Vence: <span className="font-mono">{m.expires_on ? new Date(m.expires_on).toLocaleDateString("es-AR") : "—"}</span>
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {m.pay_status === "pagado" ? (
                        <span className="flex items-center gap-1 rounded-full bg-neon/20 px-2.5 py-1 text-[10px] font-semibold text-neon border border-neon/30">
                          <CheckCircle2 className="h-3 w-3" /> Pagó
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 rounded-full bg-muted/20 px-2.5 py-1 text-[10px] font-semibold text-muted border border-edge">
                          <Clock3 className="h-3 w-3" />
                          {m.pay_status === "promo" ? "Promo" : "Pendiente"}
                        </span>
                      )}
                      {m.pay_status !== "pagado" && (
                        <button
                          onClick={() => markPaid(m)}
                          disabled={busy === m.id}
                          className="rounded-xl bg-ember px-3 py-1.5 text-xs font-bold text-bg shadow-lg transition hover:opacity-90 disabled:opacity-60"
                        >
                          {busy === m.id ? "…" : "Marcar pagó"}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Historial de Pagos */}
        <div className="space-y-4 rounded-2xl border border-edge bg-card p-5">
          <div className="flex items-center justify-between">
            <p className="text-base font-bold text-ink">Historial de Pagos Recientes</p>
            <span className="text-xs font-semibold text-neon">Últimos {payments.length}</span>
          </div>

          {payments.length === 0 ? (
            <p className="py-8 text-center text-xs text-muted">Todavía no hay pagos registrados.</p>
          ) : (
            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
              {payments.map((p) => (
                <div key={p.id} className="flex items-center justify-between rounded-xl border border-edge bg-bg p-3">
                  <div>
                    <p className="text-sm font-semibold text-ink">{nameOf(p.user_id)}</p>
                    <p className="text-[11px] text-muted">
                      {new Date(p.paid_at).toLocaleString("es-AR", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <span className="text-sm font-black text-neon">
                    ${p.amount > 0 ? p.amount.toLocaleString("es-AR") : "0"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}