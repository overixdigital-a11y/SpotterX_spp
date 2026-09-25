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
  Minus,
  Plus,
  RotateCcw,
  Search,
  Trophy,
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
import { useToast } from "@/components/core/ToastProvider";
import { formatPrice } from "@/lib/market";

interface DashboardData {
  totalProducts: number;
  activeProducts: number;
  totalOrders: number;
  monthlyOrders: number;
  monthlySales: number;
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

interface SellerRow {
  id: string;
  username: string | null;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  free_limit: number | null;
  active: number;
  total: number;
}

export default function MarketAdminPage() {
  const { userId, profile } = useAuthState();
  const toast = useToast();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [freeCount, setFreeCount] = useState(3);
  const [newFreeCount, setNewFreeCount] = useState("");
  const [publishPrice, setPublishPrice] = useState(100);
  const [newPublishPrice, setNewPublishPrice] = useState("");
  const [savingConfig, setSavingConfig] = useState(false);
  const [publishRevenue, setPublishRevenue] = useState({ total: 0, count: 0 });
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [loadingWithdrawals, setLoadingWithdrawals] = useState(true);
  const [creditUserId, setCreditUserId] = useState("");
  const [creditAmount, setCreditAmount] = useState("");
  const [creditNote, setCreditNote] = useState("");
  const [crediting, setCrediting] = useState(false);
  const [sellers, setSellers] = useState<SellerRow[]>([]);
  const [loadingSellers, setLoadingSellers] = useState(true);
  const [searchQ, setSearchQ] = useState("");
  const [drafts, setDrafts] = useState<Record<string, number>>({});
  const [savingQuota, setSavingQuota] = useState<string | null>(null);

  useEffect(() => {
    if (!userId || !profile?.is_admin) return;
    const supabase = createClient();

    const load = async () => {
      const [
        productsRes,
        activeRes,
        ordersRes,
        monthlyOrdersRes,
        categoriesRes,
        monthlySalesRes,
      ] = await Promise.all([
        supabase.from("market_products").select("id", { count: "exact", head: true }),
        supabase.from("market_products").select("id", { count: "exact", head: true }).eq("status", "active"),
        supabase.from("market_orders").select("id", { count: "exact", head: true }),
        supabase.from("market_orders").select("id", { count: "exact", head: true })
          .gte("created_at", new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
        supabase.from("market_products").select("category")
          .eq("status", "active"),
        supabase.from("market_orders").select("total, created_at")
          .gte("created_at", new Date(Date.now() - 6 * 30 * 24 * 60 * 60 * 1000).toISOString()),
      ]);

      const monthlySales = (monthlyOrdersRes.data as { total: number }[] | null)
        ?.reduce((sum, o) => sum + (o.total ?? 0), 0) ?? 0;

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

      // Monetización SpotterShop (config global + ingresos por publicaciones)
      const [cfgRes, revenueRes] = await Promise.all([
        supabase.from("platform_config").select("key, value").in("key", ["free_publishes", "publish_price"]),
        supabase.rpc("admin_publish_revenue"),
      ]);
      if (cfgRes.data) {
        const map = new Map((cfgRes.data as { key: string; value: unknown }[]).map((r) => [r.key, r.value]));
        setFreeCount(Number(map.get("free_publishes") ?? 3));
        setPublishPrice(Number(map.get("publish_price") ?? 100));
      }
      setPublishRevenue((revenueRes.data as { total: number; count: number }) ?? { total: 0, count: 0 });

      setData({
        totalProducts: productsRes.count ?? 0,
        activeProducts: activeRes.count ?? 0,
        totalOrders: ordersRes.count ?? 0,
        monthlyOrders: monthlyOrdersRes.count ?? 0,
        monthlySales,
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

  // Load sellers ranking (public providers)
  useEffect(() => {
    if (!userId || !profile?.is_admin) return;
    const supabase = createClient();
    const load = async () => {
      setLoadingSellers(true);
      const { data: products } = await supabase
        .from("market_products")
        .select("seller_id, status")
        .limit(5000);
      const activeMap: Record<string, number> = {};
      const totalMap: Record<string, number> = {};
      (products ?? []).forEach((p) => {
        totalMap[p.seller_id] = (totalMap[p.seller_id] ?? 0) + 1;
        if (p.status === "active" || p.status === "paused") {
          activeMap[p.seller_id] = (activeMap[p.seller_id] ?? 0) + 1;
        }
      });
      const ids = Object.keys(totalMap);
      if (ids.length === 0) {
        setSellers([]);
        setLoadingSellers(false);
        return;
      }
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, username, full_name, email, shop_free_limit")
        .in("id", ids);
      const rows: SellerRow[] = ((profs ?? []) as unknown as {
        id: string;
        username: string | null;
        full_name: string | null;
        email: string | null;
        free_limit: number | null;
      }[]).map((p) => ({
        id: p.id,
        username: p.username,
        full_name: p.full_name,
        email: p.email,
        avatar_url: null,
        free_limit: p.free_limit,
        active: activeMap[p.id] ?? 0,
        total: totalMap[p.id] ?? 0,
      }));
      rows.sort((a, b) => b.active - a.active);
      setSellers(rows);
      setLoadingSellers(false);
    };
    load();
  }, [userId, profile?.is_admin]);

  const saveConfig = async () => {
    const hasFree = newFreeCount.trim() !== "";
    const hasPrice = newPublishPrice.trim() !== "";
    if (!hasFree && !hasPrice) return;
    const fc = hasFree ? parseInt(newFreeCount, 10) : null;
    const pp = hasPrice ? parseFloat(newPublishPrice) : null;
    if (fc !== null && (isNaN(fc) || fc < 0 || fc > 100)) return;
    if (pp !== null && (isNaN(pp) || pp <= 0)) return;
    setSavingConfig(true);
    const supabase = createClient();
    const { error } = await supabase.rpc("admin_set_publication_config", {
      p_free_count: fc,
      p_price: pp,
    });
    setSavingConfig(false);
    if (!error) {
      if (fc !== null) setFreeCount(fc);
      if (pp !== null) setPublishPrice(pp);
      setNewFreeCount("");
      setNewPublishPrice("");
      toast("Monetización actualizada", "success");
    } else {
      toast(error.message, "error");
    }
  };

  const applyQuota = async (seller: SellerRow) => {
    const value = drafts[seller.id];
    if (value === undefined || isNaN(value)) return;
    setSavingQuota(seller.id);
    const supabase = createClient();
    const { error } = await supabase.rpc("admin_set_user_free_limit", {
      p_user_id: seller.id,
      p_free_limit: value,
    });
    setSavingQuota(null);
    if (!error) {
      setSellers((prev) => prev.map((r) => (r.id === seller.id ? { ...r, free_limit: value } : r)));
      toast(value === 0 ? "Le quedó sin publicaciones gratis" : "Cupo actualizado", "success");
    } else {
      toast(error.message, "error");
    }
  };

  const resetQuota = async (seller: SellerRow) => {
    setSavingQuota(seller.id);
    const supabase = createClient();
    const { error } = await supabase.rpc("admin_set_user_free_limit", {
      p_user_id: seller.id,
      p_free_limit: null,
    });
    setSavingQuota(null);
    if (!error) {
      setSellers((prev) => prev.map((r) => (r.id === seller.id ? { ...r, free_limit: null } : r)));
      toast("Vuelve a usar el cupo global", "success");
    } else {
      toast(error.message, "error");
    }
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
          Volver a SpotterShop
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
              <DollarSign className="h-3.5 w-3.5 text-ember" /> Ingresos pub.
            </p>
            <p className="mt-1 text-xl font-extrabold text-neon">{formatPrice(publishRevenue.total)}</p>
            <p className="text-[10px] text-muted">{publishRevenue.count} publicaciones pagas</p>
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

        {/* Monetización SpotterShop (global) */}
        <div className="rounded-2xl border border-edge bg-card p-4">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-ink mb-1">
            <Settings className="h-4 w-4 text-ember" /> Monetización SpotterShop
          </p>
          <p className="mb-3 text-[11px] text-muted">
            Sin comisión por venta. Se cobra por publicación una vez agotado el cupo gratis (global o por usuario).
          </p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-semibold text-muted">Publicaciones gratis (global)</label>
              <input
                type="number"
                min="0"
                value={newFreeCount}
                onChange={(e) => setNewFreeCount(e.target.value)}
                placeholder={`${freeCount}`}
                className="mt-1 w-full rounded-lg border border-edge bg-bg px-3 py-2 text-xs text-ink placeholder:text-muted focus:border-neon focus:outline-none"
              />
              <p className="mt-1 text-[10px] text-muted">Valor actual: {freeCount}</p>
            </div>
            <div>
              <label className="text-[10px] font-semibold text-muted">Precio por publicación ($)</label>
              <input
                type="number"
                min="1"
                value={newPublishPrice}
                onChange={(e) => setNewPublishPrice(e.target.value)}
                placeholder={`${publishPrice}`}
                className="mt-1 w-full rounded-lg border border-edge bg-bg px-3 py-2 text-xs text-ink placeholder:text-muted focus:border-neon focus:outline-none"
              />
              <p className="mt-1 text-[10px] text-muted">Valor actual: ${publishPrice}</p>
            </div>
          </div>
          <button
            onClick={saveConfig}
            disabled={savingConfig || (newFreeCount.trim() === "" && newPublishPrice.trim() === "")}
            className="mt-3 flex w-full items-center justify-center gap-1 rounded-lg bg-neon py-2 text-xs font-semibold text-bg disabled:opacity-50"
          >
            {savingConfig ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
            Guardar
          </button>
        </div>

        {/* Publicadores — ranking y premios */}
        <div className="rounded-2xl border border-edge bg-card p-4">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-ink mb-1">
            <Trophy className="h-4 w-4 text-ember" /> Publicadores — ranking y premios
          </p>
          <p className="mb-3 text-[11px] text-muted">
            Ordenados por publicaciones vigentes. Transferí publicaciones gratis (premio) o ajustá el cupo por usuario.
          </p>
          <div className="relative mb-3">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
            <input
              type="text"
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              placeholder="Buscar publicador..."
              className="w-full rounded-lg border border-edge bg-bg py-2 pl-8 pr-3 text-xs text-ink placeholder:text-muted focus:border-neon focus:outline-none"
            />
          </div>
          {loadingSellers ? (
            <Loader2 className="mx-auto h-5 w-5 animate-spin text-neon" />
          ) : (
            <div className="space-y-2">
              {(() => {
                const q = searchQ.trim().toLowerCase();
                const visible = q
                  ? sellers.filter((s) =>
                      [s.username, s.full_name, s.email].some((v) => v?.toLowerCase().includes(q))
                    )
                  : sellers;
                return visible.length === 0 ? (
                  <p className="py-4 text-center text-xs text-muted">Todavía no hay publicadores</p>
                ) : (
                  visible.map((s, i) => {
                    const effective = s.free_limit ?? freeCount;
                    const draft = drafts[s.id];
                    const val = draft !== undefined && !isNaN(draft) ? draft : effective;
                    return (
                      <div key={s.id} className="rounded-xl border border-edge bg-bg p-3">
                        <div className="flex items-center gap-2">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neon/15 text-xs font-bold text-neon">
                            {s.full_name?.[0]?.toUpperCase() ?? s.username?.[0]?.toUpperCase() ?? "#"}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-semibold text-ink">
                              #{i + 1} {s.full_name ?? s.username ?? "Usuario"}
                            </p>
                            <p className="truncate text-[10px] text-muted">
                              @{s.username ?? "—"} · {s.email}
                            </p>
                            <p className="text-[10px] text-muted">
                              {s.active} vigentes · {s.total} publicadas
                            </p>
                          </div>
                          <span
                            className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                              s.free_limit != null ? "bg-ember/15 text-ember" : "bg-neon/15 text-neon"
                            }`}
                          >
                            cupo {effective}
                            {s.free_limit != null ? " · ajustado" : ""}
                          </span>
                        </div>
                        <div className="mt-2 flex items-center gap-1.5">
                          <button
                            onClick={() =>
                              setDrafts((d) => ({ ...d, [s.id]: Math.max(0, (drafts[s.id] ?? effective) - 1) }))
                            }
                            className="flex h-7 w-7 items-center justify-center rounded-lg border border-edge text-muted"
                            title="Quitar una publicación gratis"
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <input
                            type="number"
                            min="0"
                            value={val}
                            onChange={(e) => setDrafts((d) => ({ ...d, [s.id]: Number(e.target.value) }))}
                            className="w-16 rounded-lg border border-edge bg-bg px-2 py-1 text-center text-xs text-ink focus:border-neon focus:outline-none"
                          />
                          <button
                            onClick={() => setDrafts((d) => ({ ...d, [s.id]: (drafts[s.id] ?? effective) + 1 }))}
                            className="flex h-7 w-7 items-center justify-center rounded-lg border border-edge text-muted"
                            title="Agregar una publicación gratis (premio)"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => applyQuota(s)}
                            disabled={savingQuota === s.id || draft === undefined || isNaN(draft) || draft === effective}
                            className="flex items-center gap-1 rounded-lg bg-neon px-2.5 py-1.5 text-[10px] font-semibold text-bg disabled:opacity-50"
                          >
                            {savingQuota === s.id ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                            Aplicar
                          </button>
                          <button
                            onClick={() => resetQuota(s)}
                            disabled={savingQuota === s.id}
                            className="ml-auto flex items-center gap-1 rounded-lg border border-edge px-2.5 py-1.5 text-[10px] font-semibold text-muted disabled:opacity-50"
                            title="Volver al cupo global"
                          >
                            <RotateCcw className="h-3 w-3" />
                            Global
                          </button>
                        </div>
                      </div>
                    );
                  })
                );
              })()}
            </div>
          )}
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
