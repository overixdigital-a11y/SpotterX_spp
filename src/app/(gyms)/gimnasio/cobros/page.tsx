"use client";

import { useEffect, useState } from "react";
import { Loader2, Wallet, CheckCircle2, AlertTriangle, Printer } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuthState } from "@/lib/auth-context";

interface Gym {
  id: string;
  name: string | null;
}

interface Membership {
  id: string;
  user_id: string;
  plan_name: string;
  pay_status: string;
  status: string;
  expires_on: string | null;
  price: number | null;
  profiles: ProfileRef[] | null;
}

interface ProfileRef {
  full_name: string | null;
  username: string | null;
  email: string | null;
}

interface Payment {
  id: string;
  amount: number | null;
  method: string;
  note: string | null;
  paid_at: string;
  profiles: ProfileRef[] | null;
}

interface Receipt {
  name: string;
  plan: string;
  amount: number;
  paidAt: string;
  gymName: string;
}

function startOfMonth() {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export default function GymCobrosPage() {
  const { userId } = useAuthState();
  const [gym, setGym] = useState<Gym | null>(null);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [monthIncome, setMonthIncome] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);

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

      const [membershipsRes, paymentsRes, incomeRes, plansRes] = await Promise.all([
        supabase
          .from("gym_memberships")
          .select("id, user_id, plan_name, pay_status, status, expires_on, price, profiles:profiles!gym_memberships_user_id_fkey(full_name, username, email)")
          .eq("gym_id", g.id)
          .eq("status", "activa")
          .order("created_at", { ascending: false }),
        supabase
          .from("gym_payments")
          .select("id, amount, method, note, paid_at, profiles:gym_payments_user_id_fkey(full_name, username, email)")
          .eq("gym_id", g.id)
          .order("paid_at", { ascending: false })
          .limit(30),
        supabase
          .from("gym_payments")
          .select("amount")
          .eq("gym_id", g.id)
          .gte("paid_at", startOfMonth()),
        supabase.from("gym_plans").select("id, name, price").eq("gym_id", g.id),
      ]);

      const plans = (plansRes.data ?? []) as { name: string; price: number | null }[];
      const priceFor = (m: Membership) => {
        if (typeof m.price === "number") return m.price;
        const plan = plans.find((p) => p.name === m.plan_name);
        return typeof plan?.price === "number" ? plan.price : null;
      };

      if (active) {
        setMemberships(((membershipsRes.data ?? []) as Membership[]).map((m) => ({ ...m, price: priceFor(m) })));
        setPayments((paymentsRes.data ?? []) as Payment[]);
        setMonthIncome(
          ((incomeRes.data ?? []) as { amount: number | null }[]).reduce((acc, p) => acc + (p.amount ?? 0), 0)
        );
      }
      if (active) setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [userId]);

  const markPaid = async (m: Membership) => {
    if (!gym) return;
    const amountStr = window.prompt("Monto cobrado (ARS):", typeof m.price === "number" ? String(m.price) : "");
    if (amountStr === null) return;
    const amount = Number(amountStr) || 0;
    const note =
      window.prompt("Nota / concepto:", `Cuota ${m.plan_name}`) ?? `Cuota ${m.plan_name}`;
    setBusy(m.id);
    const supabase = createClient();
    const { data: plan } = await supabase
      .from("gym_plans")
      .select("duration_months")
      .eq("gym_id", gym.id)
      .eq("name", m.plan_name)
      .maybeSingle();
    const months = plan?.duration_months ?? 1;

    const base = m.expires_on && new Date(m.expires_on) > new Date() ? new Date(m.expires_on) : new Date();
    base.setMonth(base.getMonth() + months);
    const newExpiry = base.toISOString().split("T")[0];

    await supabase.from("gym_payments").insert({
      gym_id: gym.id,
      membership_id: m.id,
      user_id: m.user_id,
      amount,
      method: "manual",
      note,
    });

    await supabase
      .from("gym_memberships")
      .update({ pay_status: "pagado", expires_on: newExpiry, price: amount })
      .eq("id", m.id);

    setMemberships((prev) =>
      prev.map((x) => (x.id === m.id ? { ...x, pay_status: "pagado", expires_on: newExpiry, price: amount } : x))
    );
    setMonthIncome((prev) => prev + amount);
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

  const todayMs = new Date(new Date().toDateString()).getTime();
  const isDebtor = (m: Membership) =>
    (m.pay_status !== "pagado" && m.pay_status !== "promo") ||
    (m.expires_on ? new Date(m.expires_on).getTime() < todayMs : false);
  const debtors = memberships.filter(isDebtor);
  const totalDeuda = debtors.reduce((acc, m) => acc + (m.price ?? 0), 0);

  return (
    <main className="mx-auto max-w-md px-4 pt-5">
      <h1 className="flex items-center gap-1.5 text-xl font-bold text-ink">
        <Wallet className="h-5 w-5 text-neon" /> Cobros
      </h1>
      <p className="mt-1 text-sm text-muted">Cobrá las cuotas y registrá los pagos.</p>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="rounded-2xl border border-edge bg-card p-4">
          <p className="text-xs font-semibold text-muted">Ingresos del mes</p>
          <p className="mt-1 text-3xl font-extrabold text-ink">${monthIncome}</p>
        </div>
        <div className="rounded-2xl border border-edge bg-card p-4">
          <p className="flex items-center gap-1 text-xs font-semibold text-muted">
            <AlertTriangle className="h-3.5 w-3.5 text-ember" /> Deben
          </p>
          <p className={`mt-1 text-3xl font-extrabold ${debtors.length > 0 ? "text-ember" : "text-ink"}`}>
            ${totalDeuda}
          </p>
        </div>
      </div>

      <div className="mt-6">
        <p className="text-sm font-semibold text-ink">Deudores</p>
        {debtors.length === 0 ? (
          <p className="mt-3 rounded-xl border border-neon/30 bg-neon/10 p-3 text-xs text-neon">
            ¡Sin deudores! Todos los miembros activos están al día.
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            {debtors.map((m) => (
              <div key={m.id} className="rounded-xl border border-ember/30 bg-card p-3">
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink">{nameOf(m.profiles)}</p>
                    <p className="text-xs text-muted">
                      {m.plan_name} · vence {m.expires_on ?? "—"}
                    </p>
                    {typeof m.price === "number" && <p className="text-sm font-bold text-ember">${m.price}</p>}
                  </div>
                  <button
                    onClick={() => markPaid(m)}
                    disabled={busy === m.id}
                    className="shrink-0 rounded-lg bg-ember px-2.5 py-1.5 text-[11px] font-semibold text-bg disabled:opacity-60"
                  >
                    {busy === m.id ? "…" : "Marcar pagó"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-6">
        <p className="text-sm font-semibold text-ink">Al día y en promo</p>
        {memberships.filter((m) => !isDebtor(m)).length === 0 ? (
          <p className="mt-3 text-xs text-muted">No hay miembros al día.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {memberships
              .filter((m) => !isDebtor(m))
              .map((m) => (
                <div key={m.id} className="rounded-xl border border-edge bg-card p-3">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink">{nameOf(m.profiles)}</p>
                      <p className="text-xs text-muted">
                        {m.plan_name} · vence {m.expires_on ?? "—"}
                      </p>
                    </div>
                    <span className="flex shrink-0 items-center gap-1 rounded-full bg-neon/20 px-2 py-0.5 text-[10px] font-semibold text-neon">
                      <CheckCircle2 className="h-3 w-3" />
                      {m.pay_status === "promo" ? "Promo" : "Pagó"}
                    </span>
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
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink">{nameOf(p.profiles)}</p>
                  <p className="truncate text-[11px] text-muted">{p.note}</p>
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
                <div className="flex shrink-0 items-center gap-1.5">
                  <span className="text-sm font-bold text-neon">${p.amount ?? 0}</span>
                  <button
                    onClick={() =>
                      setReceipt({
                        name: nameOf(p.profiles),
                        plan: p.note ?? `Cuota`,
                        amount: p.amount ?? 0,
                        paidAt: p.paid_at,
                        gymName: gym.name ?? "Gimnasio",
                      })
                    }
                    className="rounded-lg border border-edge bg-elevated p-1.5 text-muted hover:text-neon"
                    aria-label="Recibo"
                  >
                    <Printer className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {receipt && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-5">
          <style>{`@media print { body * { visibility: hidden; } #recibo, #recibo * { visibility: visible; } #recibo { position: fixed; inset: 0; margin: 0; border: 0; box-shadow: none; } }`}</style>
          <div id="recibo" className="w-full max-w-sm rounded-2xl border border-edge bg-white p-6 text-ink shadow-neon">
            <div className="border-b border-dashed border-black/20 pb-4 text-center">
              <p className="text-2xl font-extrabold tracking-tight">
                <span className="text-[#00b8c9]">Spotter</span>
                <span className="text-[#ff5e36]">X</span>
              </p>
              <p className="mt-1 text-sm font-bold">{receipt.gymName}</p>
              <p className="text-xs text-black/50">Recibo de pago</p>
            </div>
            <div className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-black/60">Cliente</span>
                <span className="font-semibold">{receipt.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-black/60">Concepto</span>
                <span className="font-semibold">{receipt.plan}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-black/60">Fecha</span>
                <span className="font-semibold">
                  {new Date(receipt.paidAt).toLocaleString("es-AR", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-dashed border-black/20 pt-3">
                <span className="font-bold">Total</span>
                <span className="text-lg font-extrabold text-[#ff5e36]">${receipt.amount}</span>
              </div>
            </div>
            <div className="mt-5 flex gap-2">
              <button
                onClick={() => setReceipt(null)}
                className="flex-1 rounded-xl border border-black/20 py-2.5 text-sm font-semibold text-black"
              >
                Cerrar
              </button>
              <button
                onClick={() => window.print()}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#00b8c9] py-2.5 text-sm font-semibold text-white"
              >
                <Printer className="h-4 w-4" /> Imprimir
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}