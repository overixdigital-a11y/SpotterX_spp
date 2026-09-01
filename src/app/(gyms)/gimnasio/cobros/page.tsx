"use client";

import { useEffect, useState } from "react";
import { Loader2, Wallet, CheckCircle2, Clock3 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuthState } from "@/lib/auth-context";

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
  profiles: ProfileRef[] | null;
}

interface ProfileRef {
  full_name: string | null;
  username: string | null;
  email: string | null;
}

interface Payment {
  id: string;
  amount: number;
  method: string;
  paid_at: string;
  profiles: ProfileRef[] | null;
}

export default function GymCobrosPage() {
  const { userId } = useAuthState();
  const [gym, setGym] = useState<Gym | null>(null);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
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
        .select("id, user_id, plan_name, pay_status, status, expires_on, profiles:profiles!gym_memberships_user_id_fkey(full_name, username, email)")
        .eq("gym_id", g.id)
        .eq("status", "activa")
        .order("created_at", { ascending: false });

      const { data: paymentsData } = await supabase
        .from("gym_payments")
        .select("id, amount, method, paid_at, profiles:gym_payments_user_id_fkey(full_name, username, email)")
        .eq("gym_id", g.id)
        .order("paid_at", { ascending: false })
        .limit(30);

      if (active) setMemberships((membershipsData ?? []) as Membership[]);
      if (active) setPayments((paymentsData ?? []) as Payment[]);
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

  const nameOf = (profiles: ProfileRef[] | null | undefined) =>
    profiles?.[0]?.full_name ?? profiles?.[0]?.username ?? profiles?.[0]?.email ?? "Usuario";

  return (
    <main className="mx-auto max-w-md px-4 pt-5">
      <h1 className="flex items-center gap-1.5 text-xl font-bold text-ink">
        <Wallet className="h-5 w-5 text-neon" /> Cobros
      </h1>
      <p className="mt-1 text-sm text-muted">Cobrá las cuotas y registrá los pagos.</p>

      <div className="mt-5">
        <p className="text-sm font-semibold text-ink">Miembros activos</p>
        {memberships.length === 0 ? (
          <p className="mt-3 text-xs text-muted">Todavía no hay miembros activos.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {memberships.map((m) => (
              <div key={m.id} className="rounded-xl border border-edge bg-card p-3">
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink">{nameOf(m.profiles)}</p>
                    <p className="text-xs text-muted">
                      {m.plan_name} · vence {m.expires_on ?? "—"}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {m.pay_status === "pagado" ? (
                      <span className="flex items-center gap-1 rounded-full bg-neon/20 px-2 py-0.5 text-[10px] font-semibold text-neon">
                        <CheckCircle2 className="h-3 w-3" /> Pagó
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 rounded-full bg-muted/20 px-2 py-0.5 text-[10px] font-semibold text-muted">
                        <Clock3 className="h-3 w-3" />
                        {m.pay_status === "promo" ? "Promo" : "Pendiente"}
                      </span>
                    )}
                    {m.pay_status !== "pagado" && (
                      <button
                        onClick={() => markPaid(m)}
                        disabled={busy === m.id}
                        className="rounded-lg bg-ember px-2.5 py-1.5 text-[11px] font-semibold text-bg disabled:opacity-60"
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

      <div className="mt-6">
        <p className="text-sm font-semibold text-ink">Historial de pagos</p>
        {payments.length === 0 ? (
          <p className="mt-3 text-xs text-muted">Todavía no hay pagos registrados.</p>
        ) : (
          <div className="mt-3 space-y-1.5">
            {payments.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-xl border border-edge bg-card p-2.5">
                <div>
                  <p className="text-sm font-medium text-ink">{nameOf(p.profiles)}</p>
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
                <span className="text-sm font-bold text-neon">
                  ${p.amount > 0 ? p.amount : "—"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}