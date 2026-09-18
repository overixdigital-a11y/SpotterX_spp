"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BarChart3,
  DollarSign,
  Package,
  ShoppingBag,
  TrendingUp,
  Wallet,
  CheckCircle,
  Loader2,
  Settings,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { createClient } from "@/lib/supabase/client";
import { useAuthState } from "@/lib/auth-context";
import { formatPrice } from "@/lib/market";

interface DashboardData {
  totalProducts: number;
  activeProducts: number;
  totalOrders: number;
  monthlyOrders: number;
  monthlySales: number;
  totalCommission: number;
  topCategories: { name: string; count: number }[];
  monthlySalesChart: { month: string; ventas: number }[];
}

interface WithdrawalRequest {
  id: string;
  wallet_id: string;
  amount: number;
  note: string | null;
  created_at: string;
  user?: { full_name: string | null; username: string | null; email: string | null };
}

export default function MarketAdminPage() {
  const { userId, profile } = useAuthState();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [commissionRate, setCommissionRate] = useState(0.01);
  const [newRate, setNewRate] = useState("");
  const [saving, setSaving] = useState(false);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [loadingWithdrawals, setLoadingWithdrawals] = useState(true);
  const [creditUserId, setCreditUserId] = useState("");
  const [creditAmount, setCreditAmount] = useState("");
  const [creditNote, setCreditNote] = useState("");
  const [crediting, setCrediting] = useState(false);

  useEffect(() => {
    if (!userId || !profile?.is_admin) return;
    const supabase = createClient();

    const load = async () => {
      const [
        productsRes,
        activeRes,
        ordersRes,
        monthlyOrdersRes,
        commissionRes,
        categoriesRes,
        monthlySalesRes,
      ] = await Promise.all([
        supabase.from("market_products").select("id", { count: "exact", head: true }),
        supabase.from("market_products").select("id", { count: "exact", head: true }).eq("status", "active"),
        supabase.from("market_orders").select("id", { count: "exact", head: true }),
        supabase.from("market_orders").select("id", { count: "exact", head: true })
          .gte("created_at", new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
        supabase.from("market_orders").select("total, platform_fee")
          .gte("created_at", new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
        supabase.from("market_products").select("category")
          .eq("status", "active"),
        supabase.from("market_orders").select("total, created_at")
          .gte("created_at", new Date(Date.now() - 6 * 30 * 24 * 60 * 60 * 1000).toISOString()),
      ]);

      const monthlySales = (monthlyOrdersRes.data as { total: number }[] | null)
        ?.reduce((sum, o) => sum + (o.total ?? 0), 0) ?? 0;

      const totalCommission = (commissionRes.data as { platform_fee: number }[] | null)
        ?.reduce((sum, o) => sum + (o.platform_fee ?? 0), 0) ?? 0;

      // Category counts
      const catMap = new Map<string, number>();
      (categoriesRes.data as { category: string }[] | null)?.forEach((p) => {
        catMap.set(p.category, (catMap.get(p.category) ?? 0) + 1);
      });
      const topCategories = [...catMap.entries()]
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      // Monthly sales chart (last 6 months)
      const monthMap = new Map<string, number>();
      (monthlySalesRes.data as { total: number; created_at: string }[] | null)?.forEach((o) => {
        const d = new Date(o.created_at);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        monthMap.set(key, (monthMap.get(key) ?? 0) + (o.total ?? 0));
      });
      const monthlySalesChart = [...monthMap.entries()]
        .map(([month, ventas]) => ({ month, ventas }))
        .sort((a, b) => a.month.localeCompare(b.month));

      // Commission rate
      const { data: configData } = await supabase
        .from("platform_config")
        .select("value")
        .eq("key", "commission_rate")
        .maybeSingle();
      if (configData) {
        const rate = configData.value as unknown as number;
        setCommissionRate(rate);
      }

      setData({
        totalProducts: productsRes.count ?? 0,
        activeProducts: activeRes.count ?? 0,
        totalOrders: ordersRes.count ?? 0,
        monthlyOrders: monthlyOrdersRes.count ?? 0,
        monthlySales,
        totalCommission,
        topCategories,
        monthlySalesChart,
      });
      setLoading(false);
    };

    load();
  }, [userId, profile?.is_admin]);

  // Load withdrawal requests
  useEffect(() => {
    if (!userId || !profile?.is_admin) return;
    const supabase = createClient();
    const load = async () => {
      const { data: txData } = await supabase
        .from("wallet_transactions")
        .select("*")
        .eq("type", "withdrawal_request")
        .order("created_at", { ascending: false })
        .limit(20);

      if (txData) {
        const txs = txData as WithdrawalRequest[];
        // Fetch user profiles
        const walletIds = [...new Set(txs.map((t) => t.wallet_id))];
        const { data: wallets } = await supabase
          .from("wallets")
          .select("id, user_id")
          .in("id", walletIds);
        if (wallets) {
          const userIds = [...new Set(wallets.map((w) => w.user_id))];
          const { data: profiles } = await supabase
            .from("profiles")
            .select("id, full_name, username, email")
            .in("id", userIds);
          if (profiles) {
            const profileMap = new Map(profiles.map((p) => [p.id, p]));
            const walletUserMap = new Map(wallets.map((w) => [w.id, w.user_id]));
            txs.forEach((t) => {
              const uid = walletUserMap.get(t.wallet_id);
              if (uid) t.user = profileMap.get(uid) as WithdrawalRequest["user"];
            });
          }
        }
        setWithdrawals(txs.filter((t) => !t.note?.startsWith("paid")));
      }
      setLoadingWithdrawals(false);
    };
    load();
  }, [userId, profile?.is_admin]);

  const saveCommission = async () => {
    const rate = parseFloat(newRate);
    if (isNaN(rate) || rate < 0 || rate > 0.5) return;
    setSaving(true);
    const supabase = createClient();
    await supabase.rpc("admin_set_commission", { p_rate: rate });
    setCommissionRate(rate);
    setNewRate("");
    setSaving(false);
  };

  const markPaid = async (txId: string) => {
    const supabase = createClient();
    const { error } = await supabase.rpc("admin_mark_withdrawal_paid", { p_tx_id: txId });
    if (!error) {
      setWithdrawals((prev) => prev.filter((w) => w.id !== txId));
    }
  };

  const creditWallet = async () => {
    if (!creditUserId || !creditAmount) return;
    setCrediting(true);
    const supabase = createClient();
    const { error } = await supabase.rpc("admin_credit_wallet", {
      p_user_id: creditUserId,
      p_amount: parseFloat(creditAmount),
      p_note: creditNote || null,
    });
    if (!error) {
      setCreditUserId("");
      setCreditAmount("");
      setCreditNote("");
    }
    setCrediting(false);
  };

  if (!profile?.is_admin) {
    return (
      <main className="mx-auto max-w-md flex flex-col items-center justify-center px-4 py-20">
        <p className="text-sm text-muted">No tenés acceso a esta página</p>
        <Link href="/market" className="mt-3 text-sm font-semibold text-neon">
          Volver al marketplace
        </Link>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-md animate-pulse px-4 pt-5 space-y-4">
        <div className="h-5 w-1/2 rounded bg-card" />
        <div className="grid grid-cols-2 gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 rounded-2xl bg-card" />
          ))}
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md md:max-w-2xl lg:max-w-3xl">
      <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-edge bg-bg/90 px-4 py-3 backdrop-blur">
        <Link href="/market" className="text-muted">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-lg font-bold text-ink">Panel Admin</h1>
      </div>

      <div className="p-4 space-y-5">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-2xl border border-edge bg-card p-4">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-muted">
              <Package className="h-3.5 w-3.5 text-neon" /> Productos
            </p>
            <p className="mt-1 text-3xl font-extrabold text-ink">{data?.totalProducts ?? 0}</p>
            <p className="text-[10px] text-muted">{data?.activeProducts ?? 0} activos</p>
          </div>
          <div className="rounded-2xl border border-edge bg-card p-4">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-muted">
              <ShoppingBag className="h-3.5 w-3.5 text-ember" /> Órdenes
            </p>
            <p className="mt-1 text-3xl font-extrabold text-ink">{data?.totalOrders ?? 0}</p>
            <p className="text-[10px] text-muted">{data?.monthlyOrders ?? 0} este mes</p>
          </div>
          <div className="rounded-2xl border border-edge bg-card p-4">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-muted">
              <TrendingUp className="h-3.5 w-3.5 text-green-400" /> Ventas mes
            </p>
            <p className="mt-1 text-xl font-extrabold text-ink">{formatPrice(data?.monthlySales ?? 0)}</p>
          </div>
          <div className="rounded-2xl border border-edge bg-card p-4">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-muted">
              <DollarSign className="h-3.5 w-3.5 text-neon" /> Comisión
            </p>
            <p className="mt-1 text-xl font-extrabold text-neon">{formatPrice(data?.totalCommission ?? 0)}</p>
            <p className="text-[10px] text-muted">este mes</p>
          </div>
        </div>

        {/* Sales Chart */}
        {data?.monthlySalesChart && data.monthlySalesChart.length > 0 && (
          <div className="rounded-2xl border border-edge bg-card p-4">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
              <BarChart3 className="h-4 w-4 text-neon" /> Ventas últimos meses
            </p>
            <div className="mt-3 h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.monthlySalesChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e2530" />
                  <XAxis dataKey="month" tick={{ fill: "#6b7280", fontSize: 10 }} />
                  <YAxis tick={{ fill: "#6b7280", fontSize: 10 }} width={50} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#161b22", border: "1px solid #1e2530", borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: "#9ca3af" }}
                    formatter={(value) => [formatPrice(Number(value)), "Ventas"]}
                  />
                  <Bar dataKey="ventas" fill="#00f2fe" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Top Categories */}
        {data?.topCategories && data.topCategories.length > 0 && (
          <div className="rounded-2xl border border-edge bg-card p-4">
            <p className="text-sm font-semibold text-ink mb-3">Categorías populares</p>
            <div className="space-y-2">
              {data.topCategories.map((cat) => (
                <div key={cat.name} className="flex items-center justify-between">
                  <span className="text-xs text-muted">{cat.name}</span>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-16 rounded-full bg-bg overflow-hidden">
                      <div
                        className="h-full rounded-full bg-neon"
                        style={{ width: `${Math.min(100, (cat.count / (data.topCategories[0]?.count ?? 1)) * 100)}%` }}
                      />
                    </div>
                    <span className="text-xs font-bold text-ink w-6 text-right">{cat.count}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Commission Rate */}
        <div className="rounded-2xl border border-edge bg-card p-4">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-ink mb-3">
            <Settings className="h-4 w-4 text-muted" /> Comisión actual
          </p>
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <p className="text-3xl font-extrabold text-neon">{(commissionRate * 100).toFixed(1)}%</p>
            </div>
            <div className="flex gap-2">
              <input
                type="number"
                step="0.1"
                min="0"
                max="50"
                value={newRate}
                onChange={(e) => setNewRate(e.target.value)}
                placeholder={`${(commissionRate * 100).toFixed(1)}%`}
                className="w-20 rounded-lg border border-edge bg-bg px-2 py-1.5 text-xs text-ink placeholder:text-muted focus:border-neon focus:outline-none"
              />
              <button
                onClick={saveCommission}
                disabled={saving || !newRate}
                className="flex items-center gap-1 rounded-lg bg-neon px-3 py-1.5 text-xs font-semibold text-bg disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                Guardar
              </button>
            </div>
          </div>
        </div>

        {/* Credit Wallet */}
        <div className="rounded-2xl border border-edge bg-card p-4">
          <p className="text-sm font-semibold text-ink mb-3">
            <Wallet className="mr-1 inline h-4 w-4 text-muted" /> Acreditar saldo
          </p>
          <div className="space-y-2">
            <input
              type="text"
              value={creditUserId}
              onChange={(e) => setCreditUserId(e.target.value)}
              placeholder="User ID del usuario"
              className="w-full rounded-lg border border-edge bg-bg px-3 py-2 text-xs text-ink placeholder:text-muted focus:border-neon focus:outline-none"
            />
            <div className="flex gap-2">
              <div className="relative flex-1">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted">$</span>
                <input
                  type="number"
                  value={creditAmount}
                  onChange={(e) => setCreditAmount(e.target.value)}
                  placeholder="Monto"
                  className="w-full rounded-lg border border-edge bg-bg py-2 pl-6 pr-2 text-xs text-ink placeholder:text-muted focus:border-neon focus:outline-none"
                />
              </div>
              <input
                type="text"
                value={creditNote}
                onChange={(e) => setCreditNote(e.target.value)}
                placeholder="Nota (opcional)"
                className="flex-1 rounded-lg border border-edge bg-bg px-3 py-2 text-xs text-ink placeholder:text-muted focus:border-neon focus:outline-none"
              />
            </div>
            <button
              onClick={creditWallet}
              disabled={crediting || !creditUserId || !creditAmount}
              className="w-full flex items-center justify-center gap-1 rounded-lg bg-neon py-2 text-xs font-semibold text-bg disabled:opacity-50"
            >
              {crediting ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
              Acreditar
            </button>
          </div>
        </div>

        {/* Withdrawal Requests */}
        <div className="rounded-2xl border border-edge bg-card p-4">
          <p className="text-sm font-semibold text-ink mb-3">
            <ArrowLeft className="mr-1 inline h-4 w-4 text-muted" /> Retiros pendientes
          </p>
          {loadingWithdrawals ? (
            <Loader2 className="mx-auto h-5 w-5 animate-spin text-neon" />
          ) : withdrawals.length === 0 ? (
            <p className="py-4 text-center text-xs text-muted">No hay retiros pendientes</p>
          ) : (
            <div className="space-y-2">
              {withdrawals.map((w) => (
                <div key={w.id} className="flex items-center justify-between rounded-xl border border-edge bg-bg p-3">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-ink">
                      {w.user?.full_name ?? w.user?.username ?? "Usuario"}
                    </p>
                    <p className="text-[10px] text-muted">
                      {w.user?.email} · {new Date(w.created_at).toLocaleDateString("es-AR")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-ember">{formatPrice(w.amount)}</span>
                    <button
                      onClick={() => markPaid(w.id)}
                      className="flex items-center gap-1 rounded-lg bg-green-500/15 px-2 py-1 text-[10px] font-semibold text-green-400"
                    >
                      <CheckCircle className="h-3 w-3" /> Pagado
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
