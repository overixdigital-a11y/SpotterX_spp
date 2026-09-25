"use client";

import { useEffect, useState } from "react";
import {
  Download,
  TrendingUp,
  ShoppingBag,
  DollarSign,
  Settings,
  Users,
  Wallet,
  Loader2,
  Search,
  Minus,
  Plus,
  RotateCcw,
  BarChart3,
  Landmark,
  Mail,
  Phone,
  ShoppingCart,
  Trash2,
  Star,
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
import { formatPrice } from "@/lib/market";
import {
  getMarketConfig,
  resetMarketConfigCache,
  type PaymentAccount,
  type AdminContact,
} from "@/lib/market-config";

interface OrderRow {
  id: string;
  buyer_id: string;
  seller_id: string;
  total: number;
  platform_fee: number;
  status: string;
  delivery_type: string;
  created_at: string;
}

interface SellerRow {
  id: string;
  email: string;
  username: string;
  full_name: string;
  shop_free_limit: number | null;
  active: number;
  total: number;
}

interface DepositRow {
  id: string;
  pedido: string;
  amount: number;
  status: string;
  note: string | null;
  created_at: string;
  acredited_at: string | null;
  user_id: string;
  username: string | null;
  full_name: string | null;
  email: string;
}

function newAccountKey() {
  return `acc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function AdminMarketPage() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalSales, setTotalSales] = useState(0);
  const [monthlySales, setMonthlySales] = useState(0);
  const [publishRevenue, setPublishRevenue] = useState({ total: 0, count: 0 });
  const [chartData, setChartData] = useState<{ label: string; total: number }[]>([]);
  const [topCategories, setTopCategories] = useState<{ category: string; count: number }[]>([]);

  const [freeCount, setFreeCount] = useState<number | null>(null);
  const [publishPrice, setPublishPrice] = useState<number | null>(null);
  const [newFreeCount, setNewFreeCount] = useState<number | null>(null);
  const [newPublishPrice, setNewPublishPrice] = useState<number | null>(null);
  const [savingConfig, setSavingConfig] = useState(false);

  const [sellers, setSellers] = useState<SellerRow[]>([]);
  const [sellersLoading, setSellersLoading] = useState(true);
  const [searchQ, setSearchQ] = useState("");
  const [drafts, setDrafts] = useState<Record<string, number>>({});
  const [savingQuota, setSavingQuota] = useState<string | null>(null);

  const [creditUserId, setCreditUserId] = useState("");
  const [creditAmount, setCreditAmount] = useState("");
  const [creditNote, setCreditNote] = useState("");
  const [crediting, setCrediting] = useState(false);

  const [accounts, setAccounts] = useState<PaymentAccount[]>([]);
  const [contact, setContact] = useState<AdminContact>({ email: "", whatsapp: "" });
  const [allowCart, setAllowCart] = useState(false);
  const [savingPaymentConfig, setSavingPaymentConfig] = useState(false);
  const [accForm, setAccForm] = useState({
    bank: "",
    account_type: "CBU",
    number: "",
    holder: "",
    note: "",
  });
  const [editingKey, setEditingKey] = useState<string | null>(null);

  const [deposits, setDeposits] = useState<DepositRow[]>([]);
  const [accredited, setAccredited] = useState<DepositRow[]>([]);
  const [depositsLoading, setDepositsLoading] = useState(true);
  const [approving, setApproving] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      const supabase = createClient();
      const [ordersRes, revRes, cfgRes, monthlyRes, catsRes] = await Promise.all([
        supabase
          .from("market_orders")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(200),
        supabase.rpc("admin_publish_revenue"),
        supabase
          .from("platform_config")
          .select("key, value")
          .in("key", ["free_publishes", "publish_price"]),
        supabase
          .from("market_orders")
          .select("total")
          .gte(
            "created_at",
            new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
          ),
        supabase.from("market_products").select("category").eq("status", "active"),
      ]);

      if (ordersRes.data) {
        const rows = ordersRes.data as OrderRow[];
        setOrders(rows);
        setTotalSales(rows.reduce((sum, o) => sum + (o.total ?? 0), 0));
        setChartData(buildMonthlyChart(rows));
      }
      if (revRes.data) {
        setPublishRevenue(revRes.data as { total: number; count: number });
      }
      if (cfgRes.data) {
        const map = new Map<string, number>();
        for (const row of cfgRes.data) {
          map.set(row.key as string, row.value as number);
        }
        const fc = map.get("free_publishes") ?? 3;
        const pp = map.get("publish_price") ?? 100;
        setFreeCount(fc);
        setPublishPrice(pp);
        setNewFreeCount(fc);
        setNewPublishPrice(pp);
      }
      if (monthlyRes.data) {
        const rows = monthlyRes.data as { total: number }[];
        setMonthlySales(rows.reduce((sum, o) => sum + (o.total ?? 0), 0));
      }
      if (catsRes.data) {
        const counts = new Map<string, number>();
        for (const row of catsRes.data as { category: string }[]) {
          counts.set(row.category, (counts.get(row.category) ?? 0) + 1);
        }
        setTopCategories(
          [...counts.entries()]
            .map(([category, count]) => ({ category, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 6)
        );
      }

      const cfg = await getMarketConfig(true);
      setAccounts(cfg.accounts.map((a) => ({ ...a })));
      setContact({ ...cfg.contact });
      setAllowCart(cfg.allowCart);
      setLoading(false);
    };
    run();
  }, []);

  useEffect(() => {
    const run = async () => {
      const supabase = createClient();
      const [productRows, pend, acc] = await Promise.all([
        supabase.from("market_products").select("seller_id, status").limit(500),
        supabase.rpc("admin_list_deposits", { p_status: "pendiente" }),
        supabase.rpc("admin_list_deposits", { p_status: "acreditado" }),
      ]);
      if (productRows.data) {
        const per = new Map<string, { active: number; total: number }>();
        for (const row of productRows.data as { seller_id: string; status: string }[]) {
          const cur = per.get(row.seller_id) ?? { active: 0, total: 0 };
          cur.total += 1;
          if (row.status === "active" || row.status === "paused") cur.active += 1;
          per.set(row.seller_id, cur);
        }
        const ids = [...per.keys()];
        if (ids.length > 0) {
          const profiles = await supabase
            .from("profiles")
            .select("id, email, username, full_name, shop_free_limit")
            .in("id", ids);
          if (profiles.data) {
            const rows = (profiles.data as SellerRow[]).map((p) => ({
              ...p,
              active: per.get(p.id)?.active ?? 0,
              total: per.get(p.id)?.total ?? 0,
            }));
            setSellers(rows.sort((a, b) => b.active - a.active));
          }
        }
      }
      if (pend.data) setDeposits(pend.data as DepositRow[]);
      if (acc.data) setAccredited((acc.data as DepositRow[]).slice(0, 5));
      setDepositsLoading(false);
      setSellersLoading(false);
    };
    run();
  }, []);

  const exportCSV = () => {
    const header = "ID;Fecha;Total;Comision;Estado;Entrega;Comprador;Vendedor";
    const rows = orders.map((o) =>
      [
        o.id.slice(0, 8),
        new Date(o.created_at).toLocaleDateString("es-AR"),
        o.total,
        o.platform_fee,
        o.status,
        o.delivery_type,
        o.buyer_id.slice(0, 8),
        o.seller_id.slice(0, 8),
      ].join(";")
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `spotterx_ventas_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const saveConfig = async () => {
    const supabase = createClient();
    setSavingConfig(true);
    const { error } = await supabase.rpc("admin_set_publication_config", {
      p_free_count: newFreeCount,
      p_price: newPublishPrice,
    });
    setSavingConfig(false);
    if (error) {
      window.alert("No se pudo guardar: " + error.message);
      return;
    }
    setFreeCount(newFreeCount);
    setPublishPrice(newPublishPrice);
  };

  const savePaymentConfig = async () => {
    const supabase = createClient();
    setSavingPaymentConfig(true);
    const { error } = await supabase.rpc("admin_set_payment_config", {
      p_accounts: accounts,
      p_allow_cart: allowCart,
      p_contact: contact,
    });
    setSavingPaymentConfig(false);
    if (error) {
      window.alert("No se pudo guardar la configuración: " + error.message);
      return;
    }
    resetMarketConfigCache();
    await getMarketConfig();
  };

  const addOrUpdateAccount = () => {
    if (!accForm.bank.trim() || !accForm.number.trim()) return;
    const acc: PaymentAccount = {
      key: editingKey ?? newAccountKey(),
      bank: accForm.bank.trim(),
      account_type: accForm.account_type,
      number: accForm.number.trim(),
      holder: accForm.holder.trim(),
      note: accForm.note.trim(),
      active: false,
    };
    setAccounts((prev) =>
      editingKey ? prev.map((a) => (a.key === editingKey ? { ...a, ...acc } : a)) : [...prev, acc]
    );
    setAccForm({ bank: "", account_type: "CBU", number: "", holder: "", note: "" });
    setEditingKey(null);
  };

  const startEditAccount = (key: string) => {
    const a = accounts.find((x) => x.key === key);
    if (!a) return;
    setEditingKey(key);
    setAccForm({ bank: a.bank, account_type: a.account_type, number: a.number, holder: a.holder, note: a.note });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const removeAccount = (key: string) => {
    setAccounts((prev) => prev.filter((a) => a.key !== key));
    if (editingKey === key) {
      setEditingKey(null);
      setAccForm({ bank: "", account_type: "CBU", number: "", holder: "", note: "" });
    }
  };

  const setActiveAccount = (key: string) => {
    setAccounts((prev) => prev.map((a) => ({ ...a, active: a.key === key })));
  };

  const approveDeposit = async (d: DepositRow) => {
    const supabase = createClient();
    setApproving(d.id);
    const { error } = await supabase.rpc("admin_approve_deposit", { p_deposit_id: d.id });
    setApproving(null);
    if (error) {
      window.alert("No se pudo acreditar: " + error.message);
      return;
    }
    setDeposits((prev) => prev.filter((x) => x.id !== d.id));
    setAccredited((prev) => [d, ...prev].slice(0, 5));
  };

  const effectiveQuota = (s: SellerRow) => drafts[s.id] ?? s.shop_free_limit ?? freeCount ?? 3;

  const applyQuota = async (s: SellerRow) => {
    const buyer = drafts[s.id];
    if (buyer === undefined) return;
    const supabase = createClient();
    setSavingQuota(s.id);
    const { error } = await supabase.rpc("admin_set_user_free_limit", {
      p_user_id: s.id,
      p_free_limit: buyer,
    });
    setSavingQuota(null);
    if (error) {
      window.alert("No se pudo aplicar: " + error.message);
      return;
    }
    setSellers((prev) => prev.map((x) => (x.id === s.id ? { ...x, shop_free_limit: buyer } : x)));
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[s.id];
      return next;
    });
  };

  const resetQuota = async (s: SellerRow) => {
    const supabase = createClient();
    setSavingQuota(s.id);
    const { error } = await supabase.rpc("admin_set_user_free_limit", {
      p_user_id: s.id,
      p_free_limit: null,
    });
    setSavingQuota(null);
    if (error) {
      window.alert("No se pudo resetear: " + error.message);
      return;
    }
    setSellers((prev) => prev.map((x) => (x.id === s.id ? { ...x, shop_free_limit: null } : x)));
  };

  const creditWallet = async () => {
    const amt = Number(creditAmount);
    if (!creditUserId.trim() || !amt || amt <= 0) return;
    const supabase = createClient();
    setCrediting(true);
    const { error } = await supabase.rpc("admin_credit_wallet", {
      p_user_id: creditUserId.trim(),
      p_amount: amt,
      p_note: creditNote.trim() || null,
    });
    setCrediting(false);
    if (error) {
      window.alert("No se pudo acreditar: " + error.message);
      return;
    }
    setCreditUserId("");
    setCreditAmount("");
    setCreditNote("");
  };

  const filteredSellers = sellers.filter(
    (s) =>
      (s.full_name ?? "").toLowerCase().includes(searchQ.toLowerCase()) ||
      (s.username ?? "").toLowerCase().includes(searchQ.toLowerCase()) ||
      (s.email ?? "").toLowerCase().includes(searchQ.toLowerCase())
  );

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 animate-pulse rounded-lg bg-[#121722]" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold text-[#e4e8ee]">SpotterShop — Administración</h2>
        <button
          onClick={exportCSV}
          className="flex items-center gap-1.5 rounded-lg border border-[#00e5c7]/30 bg-[#00e5c7]/10 px-3 py-1.5 text-xs font-semibold text-[#00e5c7] hover:bg-[#00e5c7]/20"
        >
          <Download className="h-3.5 w-3.5" /> Exportar CSV
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        <div className="rounded-lg border border-[#1e2530] bg-[#121722] p-4">
          <p className="flex items-center gap-1.5 text-xs font-medium text-[#9ca3af]">
            <ShoppingBag className="h-3.5 w-3.5 text-[#f97316]" /> Órdenes
          </p>
          <p className="mt-1 text-2xl font-extrabold text-[#e4e8ee]">{orders.length}</p>
        </div>
        <div className="rounded-lg border border-[#1e2530] bg-[#121722] p-4">
          <p className="flex items-center gap-1.5 text-xs font-medium text-[#9ca3af]">
            <TrendingUp className="h-3.5 w-3.5 text-[#22c55e]" /> Ventas totales
          </p>
          <p className="mt-1 text-xl font-extrabold text-[#e4e8ee]">{formatPrice(totalSales)}</p>
        </div>
        <div className="rounded-lg border border-[#1e2530] bg-[#121722] p-4">
          <p className="flex items-center gap-1.5 text-xs font-medium text-[#9ca3af]">
            <BarChart3 className="h-3.5 w-3.5 text-[#38bdf8]" /> Ventas este mes
          </p>
          <p className="mt-1 text-xl font-extrabold text-[#38bdf8]">{formatPrice(monthlySales)}</p>
        </div>
        <div className="rounded-lg border border-[#00e5c7]/20 bg-[#00e5c7]/5 p-4">
          <p className="flex items-center gap-1.5 text-xs font-medium text-[#9ca3af]">
            <DollarSign className="h-3.5 w-3.5 text-[#00e5c7]" /> Ingresos por publicaciones
          </p>
          <p className="mt-1 text-xl font-extrabold text-[#00e5c7]">{formatPrice(publishRevenue.total)}</p>
          <p className="text-[10px] text-[#9ca3af]">{publishRevenue.count} publicaciones pagas</p>
        </div>
        <div className="rounded-lg border border-[#1e2530] bg-[#121722] p-4">
          <p className="flex items-center gap-1.5 text-xs font-medium text-[#9ca3af]">
            <Users className="h-3.5 w-3.5 text-[#eab308]" /> Publicadores
          </p>
          <p className="mt-1 text-2xl font-extrabold text-[#e4e8ee]">{sellers.length}</p>
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-sm font-semibold text-[#e4e8ee]">Últimas órdenes</h3>
        <div className="overflow-hidden rounded-lg border border-[#1e2530]">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[#1e2530] bg-[#0c1017]">
                <th className="px-4 py-2.5 text-xs font-medium text-[#9ca3af]">ID</th>
                <th className="px-4 py-2.5 text-xs font-medium text-[#9ca3af]">Fecha</th>
                <th className="hidden px-4 py-2.5 text-xs font-medium text-[#9ca3af] sm:table-cell">
                  Entrega
                </th>
                <th className="px-4 py-2.5 text-xs font-medium text-[#9ca3af]">Total</th>
                <th className="px-4 py-2.5 text-xs font-medium text-[#9ca3af]">Comisión</th>
              </tr>
            </thead>
            <tbody>
              {orders.slice(0, 50).map((o) => (
                <tr key={o.id} className="border-b border-[#1e2530]/50 last:border-0 hover:bg-[#121722]/50">
                  <td className="px-4 py-2.5 text-xs font-medium text-[#e4e8ee]">#{o.id.slice(0, 8)}</td>
                  <td className="px-4 py-2.5 text-xs text-[#9ca3af]">
                    {new Date(o.created_at).toLocaleDateString("es-AR")}
                  </td>
                  <td className="hidden px-4 py-2.5 text-xs text-[#9ca3af] sm:table-cell">
                    {o.delivery_type}
                  </td>
                  <td className="px-4 py-2.5 text-xs font-medium text-[#e4e8ee]">{formatPrice(o.total)}</td>
                  <td className="px-4 py-2.5 text-xs font-medium text-[#00e5c7]">
                    {formatPrice(o.platform_fee)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {chartData.length > 0 && (
        <div className="rounded-lg border border-[#1e2530] bg-[#121722] p-4">
          <h3 className="mb-3 text-sm font-semibold text-[#e4e8ee]">Resumen de ventas</h3>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid stroke="#1e2530" vertical={false} />
                <XAxis dataKey="label" stroke="#9ca3af" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="#9ca3af" fontSize={10} tickLine={false} axisLine={false} width={40} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0c1017",
                    border: "1px solid #1e2530",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  labelStyle={{ color: "#9ca3af" }}
                  formatter={(value) => formatPrice(Number(value ?? 0))}
                />
                <Bar dataKey="total" name="Ventas" fill="#00e5c7" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          {topCategories.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {topCategories.map((c) => (
                <span
                  key={c.category}
                  className="rounded-full border border-[#1e2530] bg-[#0c1017] px-3 py-1 text-xs text-[#9ca3af]"
                >
                  {c.category} <span className="font-bold text-[#00e5c7]">{c.count}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="rounded-lg border border-[#1e2530] bg-[#121722] p-4">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#e4e8ee]">
          <Settings className="h-4 w-4 text-[#00e5c7]" /> Monetización SpotterShop
        </h3>
        <p className="mb-3 text-xs text-[#9ca3af]">
          El vendedor cobra el 100% de cada venta. Se cobra por publicación una vez agotado el cupo
          gratis. El cupo puede ajustarse por publicador más abajo.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-[11px] font-medium text-[#9ca3af]">
              Publicaciones gratis (global)
            </label>
            <input
              type="number"
              min={0}
              value={newFreeCount ?? ""}
              onChange={(e) => setNewFreeCount(e.target.value === "" ? null : Number(e.target.value))}
              className="rounded-lg border border-[#1e2530] bg-[#0c1017] px-3 py-2 text-sm text-[#e4e8ee]"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-[#9ca3af]">Precio por publicación ($)</label>
            <input
              type="number"
              min={0}
              value={newPublishPrice ?? ""}
              onChange={(e) => setNewPublishPrice(e.target.value === "" ? null : Number(e.target.value))}
              className="rounded-lg border border-[#1e2530] bg-[#0c1017] px-3 py-2 text-sm text-[#e4e8ee]"
            />
          </div>
          <button
            onClick={saveConfig}
            disabled={savingConfig}
            className="flex items-center gap-1.5 rounded-lg bg-[#00e5c7] px-4 py-2 text-sm font-bold text-[#0c1017] hover:bg-[#00e5c7]/90 disabled:opacity-50"
          >
            {savingConfig && <Loader2 className="h-4 w-4 animate-spin" />} Guardar
          </button>
        </div>
        <p className="mt-3 text-xs text-[#9ca3af]">
          Actual: {freeCount ?? 3} gratis · ${publishPrice ?? 100} por publicación.
        </p>
      </div>

      <div className="rounded-lg border border-[#1e2530] bg-[#121722] p-4">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#e4e8ee]">
          <Landmark className="h-4 w-4 text-[#eab308]" /> Configuración del cobro y modo carrito
        </h3>
        <p className="mb-3 text-xs text-[#9ca3af]">
          Estos datos se muestran al publicador cuando se le acaban las publicaciones gratis, junto
          con el aviso de depósito.
        </p>

        <div className="space-y-3">
          <div>
            <p className="mb-2 text-xs font-semibold text-[#e4e8ee]">Cuentas donde recibís los depósitos</p>
            <div className="space-y-2">
              {accounts.length === 0 && (
                <p className="text-xs text-[#9ca3af]">Sin cuentas cargadas todavía.</p>
              )}
              {accounts.map((a) => (
                <div
                  key={a.key}
                  className="flex items-center justify-between gap-2 rounded-lg border border-[#1e2530] bg-[#0c1017] p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-[#e4e8ee]">
                      {a.bank} · {a.account_type}
                      {a.active && (
                        <span className="ml-1.5 rounded-full bg-[#00e5c7]/15 px-2 py-0.5 text-[10px] text-[#00e5c7]">
                          activa
                        </span>
                      )}
                    </p>
                    <p className="truncate text-[11px] text-[#9ca3af]">
                      {a.number}
                      {a.holder ? ` · ${a.holder}` : ""}
                      {a.note ? ` · ${a.note}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      onClick={() => setActiveAccount(a.key)}
                      disabled={a.active}
                      className="rounded-md border border-[#1e2530] p-1.5 text-[#9ca3af] hover:text-[#00e5c7] disabled:opacity-40"
                      title="Usar esta cuenta"
                    >
                      <Star className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => startEditAccount(a.key)}
                      className="rounded-md border border-[#1e2530] p-1.5 text-[#9ca3af] hover:text-[#e4e8ee]"
                      title="Editar"
                    >
                      <Settings className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => removeAccount(a.key)}
                      className="rounded-md border border-[#1e2530] p-1.5 text-[#9ca3af] hover:text-[#f87171]"
                      title="Quitar"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-2 grid grid-cols-2 gap-2">
              <input
                value={accForm.bank}
                onChange={(e) => setAccForm({ ...accForm, bank: e.target.value })}
                placeholder="Banco (ej: Banco Nación)"
                className="rounded-lg border border-[#1e2530] bg-[#0c1017] px-3 py-2 text-sm text-[#e4e8ee]"
              />
              <select
                value={accForm.account_type}
                onChange={(e) => setAccForm({ ...accForm, account_type: e.target.value })}
                className="rounded-lg border border-[#1e2530] bg-[#0c1017] px-3 py-2 text-sm text-[#e4e8ee]"
              >
                {["CBU", "Alias", "CVU", "Transferencia"].map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <input
                value={accForm.number}
                onChange={(e) => setAccForm({ ...accForm, number: e.target.value })}
                placeholder="CBU / Alias / CVU / número"
                className="rounded-lg border border-[#1e2530] bg-[#0c1017] px-3 py-2 text-sm text-[#e4e8ee]"
              />
              <input
                value={accForm.holder}
                onChange={(e) => setAccForm({ ...accForm, holder: e.target.value })}
                placeholder="Titular"
                className="rounded-lg border border-[#1e2530] bg-[#0c1017] px-3 py-2 text-sm text-[#e4e8ee]"
              />
              <input
                value={accForm.note}
                onChange={(e) => setAccForm({ ...accForm, note: e.target.value })}
                placeholder="Nota (opcional)"
                className="col-span-2 rounded-lg border border-[#1e2530] bg-[#0c1017] px-3 py-2 text-sm text-[#e4e8ee]"
              />
            </div>
            <button
              onClick={addOrUpdateAccount}
              disabled={!accForm.bank.trim() || !accForm.number.trim()}
              className="mt-2 flex items-center gap-1.5 rounded-lg border border-[#00e5c7]/30 bg-[#00e5c7]/10 px-3 py-1.5 text-xs font-semibold text-[#00e5c7] hover:bg-[#00e5c7]/20 disabled:opacity-40"
            >
              <Plus className="h-3.5 w-3.5" /> {editingKey ? "Guardar cambios de cuenta" : "Agregar cuenta"}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 flex items-center gap-1 text-[11px] font-medium text-[#9ca3af]">
                <Mail className="h-3 w-3" /> Email de contacto
              </label>
              <input
                value={contact.email}
                onChange={(e) => setContact({ ...contact, email: e.target.value })}
                placeholder="admin@spotterx.com"
                className="w-full rounded-lg border border-[#1e2530] bg-[#0c1017] px-3 py-2 text-sm text-[#e4e8ee]"
              />
            </div>
            <div>
              <label className="mb-1 flex items-center gap-1 text-[11px] font-medium text-[#9ca3af]">
                <Phone className="h-3 w-3" /> WhatsApp (para alertas de depósito)
              </label>
              <input
                value={contact.whatsapp}
                onChange={(e) => setContact({ ...contact, whatsapp: e.target.value })}
                placeholder="5491100000000"
                className="w-full rounded-lg border border-[#1e2530] bg-[#0c1017] px-3 py-2 text-sm text-[#e4e8ee]"
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-[#1e2530] bg-[#0c1017] p-3">
            <div>
              <p className="flex items-center gap-1.5 text-xs font-semibold text-[#e4e8ee]">
                <ShoppingCart className="h-4 w-4 text-[#38bdf8]" /> Modo carrito
              </p>
              <p className="text-[11px] text-[#9ca3af]">
                Oculto ahora. Lo habilitás cuando quieras implementar el carrito de compras a futuro.
              </p>
            </div>
            <button
              onClick={() => setAllowCart((v) => !v)}
              className={`relative h-6 w-11 shrink-0 rounded-full transition ${
                allowCart ? "bg-[#00e5c7]" : "bg-[#1e2530]"
              }`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${
                  allowCart ? "left-[22px]" : "left-0.5"
                }`}
              />
            </button>
          </div>

          <button
            onClick={savePaymentConfig}
            disabled={savingPaymentConfig}
            className="flex items-center gap-1.5 rounded-lg bg-[#00e5c7] px-4 py-2 text-sm font-bold text-[#0c1017] hover:bg-[#00e5c7]/90 disabled:opacity-50"
          >
            {savingPaymentConfig && <Loader2 className="h-4 w-4 animate-spin" />} Guardar configuración
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-[#1e2530] bg-[#121722] p-4">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#e4e8ee]">
          <Users className="h-4 w-4 text-[#f97316]" /> Publicadores — ranking y premios
        </h3>
        <div className="relative mb-3">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9ca3af]" />
          <input
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            placeholder="Buscar publicador..."
            className="w-full rounded-lg border border-[#1e2530] bg-[#0c1017] py-2 pl-9 pr-3 text-sm text-[#e4e8ee]"
          />
        </div>
        <div className="overflow-hidden rounded-lg border border-[#1e2530]">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[#1e2530] bg-[#0c1017]">
                <th className="px-4 py-2.5 text-xs font-medium text-[#9ca3af]">#</th>
                <th className="px-4 py-2.5 text-xs font-medium text-[#9ca3af]">Publicador</th>
                <th className="px-4 py-2.5 text-xs font-medium text-[#9ca3af]">Vigentes</th>
                <th className="px-4 py-2.5 text-xs font-medium text-[#9ca3af]">Publicadas</th>
                <th className="px-4 py-2.5 text-xs font-medium text-[#9ca3af]">Cupo</th>
                <th className="px-4 py-2.5 text-xs font-medium text-[#9ca3af]">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {sellersLoading && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-xs text-[#9ca3af]">
                    Cargando publicadores...
                  </td>
                </tr>
              )}
              {!sellersLoading && filteredSellers.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-xs text-[#9ca3af]">
                    Sin publicadores todavía.
                  </td>
                </tr>
              )}
              {!sellersLoading &&
                filteredSellers.map((s, idx) => (
                  <tr key={s.id} className="border-b border-[#1e2530]/50 last:border-0 hover:bg-[#121722]/50">
                    <td className="px-4 py-2.5 text-xs font-bold text-[#00e5c7]">{idx + 1}</td>
                    <td className="px-4 py-2.5">
                      <p className="text-xs font-semibold text-[#e4e8ee]">
                        {s.full_name || s.username || "—"}
                      </p>
                      <p className="text-[11px] text-[#9ca3af]">
                        {s.username ? `@${s.username}` : ""} {s.email}
                        {s.shop_free_limit !== null && (
                          <span className="ml-1.5 rounded-full bg-[#00e5c7]/15 px-2 py-0.5 text-[10px] text-[#00e5c7]">
                            ajustado
                          </span>
                        )}
                      </p>
                    </td>
                    <td className="px-4 py-2.5 text-xs font-bold text-[#e4e8ee]">{s.active}</td>
                    <td className="px-4 py-2.5 text-xs text-[#9ca3af]">{s.total}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() =>
                            setDrafts((prev) => ({
                              ...prev,
                              [s.id]: Math.max(0, effectiveQuota(s) - 1),
                            }))
                          }
                          className="rounded-md border border-[#1e2530] bg-[#0c1017] p-1 text-[#9ca3af] hover:text-[#00e5c7]"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <input
                          type="number"
                          min={0}
                          value={effectiveQuota(s)}
                          onChange={(e) =>
                            setDrafts((prev) => ({
                              ...prev,
                              [s.id]: Math.max(0, Number(e.target.value) || 0),
                            }))
                          }
                          className="w-14 rounded-md border border-[#1e2530] bg-[#0c1017] px-2 py-1 text-center text-xs text-[#e4e8ee]"
                        />
                        <button
                          onClick={() =>
                            setDrafts((prev) => ({ ...prev, [s.id]: effectiveQuota(s) + 1 }))
                          }
                          className="rounded-md border border-[#1e2530] bg-[#0c1017] p-1 text-[#9ca3af] hover:text-[#00e5c7]"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <button
                        onClick={() => applyQuota(s)}
                        disabled={drafts[s.id] === undefined || savingQuota === s.id}
                        className="rounded-md bg-[#00e5c7] px-3 py-1.5 text-xs font-bold text-[#0c1017] hover:bg-[#00e5c7]/90 disabled:opacity-40"
                      >
                        {savingQuota === s.id ? "..." : "Aplicar"}
                      </button>
                      {s.shop_free_limit !== null && (
                        <button
                          onClick={() => resetQuota(s)}
                          disabled={savingQuota === s.id}
                          className="ml-1 inline-flex items-center rounded-md border border-[#1e2530] px-2.5 py-1.5 text-xs text-[#9ca3af] hover:text-[#e4e8ee] disabled:opacity-40"
                          title="Volver al cupo global"
                        >
                          <RotateCcw className="h-3 w-3" /> Global
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-[#1e2530] bg-[#121722] p-4">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#e4e8ee]">
            <Wallet className="h-4 w-4 text-[#22c55e]" /> Acreditar saldo
          </h3>
          <div className="space-y-2">
            <input
              value={creditUserId}
              onChange={(e) => setCreditUserId(e.target.value)}
              placeholder="User ID del usuario"
              className="w-full rounded-lg border border-[#1e2530] bg-[#0c1017] px-3 py-2 text-sm text-[#e4e8ee]"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                min={0}
                value={creditAmount}
                onChange={(e) => setCreditAmount(e.target.value)}
                placeholder="Monto ($)"
                className="rounded-lg border border-[#1e2530] bg-[#0c1017] px-3 py-2 text-sm text-[#e4e8ee]"
              />
              <input
                value={creditNote}
                onChange={(e) => setCreditNote(e.target.value)}
                placeholder="Nota (opcional)"
                className="rounded-lg border border-[#1e2530] bg-[#0c1017] px-3 py-2 text-sm text-[#e4e8ee]"
              />
            </div>
            <button
              onClick={creditWallet}
              disabled={crediting || !creditUserId.trim() || !Number(creditAmount)}
              className="flex items-center justify-center gap-1.5 rounded-lg bg-[#22c55e] px-4 py-2 text-sm font-bold text-[#0c1017] hover:bg-[#22c55e]/90 disabled:opacity-40"
            >
              {crediting && <Loader2 className="h-4 w-4 animate-spin" />} Acreditar
            </button>
          </div>
        </div>

        <div className="rounded-lg border border-[#1e2530] bg-[#121722] p-4">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#e4e8ee]">
            <Landmark className="h-4 w-4 text-[#eab308]" /> Depósitos pendientes de acreditar
          </h3>
          {depositsLoading && <p className="py-4 text-xs text-[#9ca3af]">Cargando depósitos...</p>}
          {!depositsLoading && deposits.length === 0 && (
            <p className="py-4 text-xs text-[#9ca3af]">Sin depósitos pendientes.</p>
          )}
          <div className="space-y-2">
            {deposits.map((d) => (
              <div
                key={d.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-[#1e2530] bg-[#0c1017] p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-[#e4e8ee]">
                    {d.pedido} · {formatPrice(d.amount)}
                  </p>
                  <p className="truncate text-[11px] text-[#9ca3af]">
                    {d.full_name || d.username || "—"} · {d.email} ·{" "}
                    {new Date(d.created_at).toLocaleString("es-AR")}
                  </p>
                </div>
                <button
                  onClick={() => approveDeposit(d)}
                  disabled={approving === d.id}
                  className="flex shrink-0 items-center gap-1 rounded-md bg-[#eab308] px-3 py-1.5 text-xs font-bold text-[#0c1017] hover:bg-[#eab308]/90 disabled:opacity-40"
                >
                  {approving === d.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  Acreditar
                </button>
              </div>
            ))}
          </div>
          {accredited.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-[#9ca3af]">
                Últimos acreditados
              </p>
              <div className="space-y-1.5">
                {accredited.map((d) => (
                  <div key={d.id} className="flex items-center justify-between rounded-lg bg-[#0c1017] px-3 py-2">
                    <p className="truncate text-xs text-[#9ca3af]">
                      {d.pedido} · {formatPrice(d.amount)} · {d.full_name || d.username}
                    </p>
                    <span className="shrink-0 text-[10px] font-semibold text-[#22c55e]">Acreditado</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function buildMonthlyChart(rows: OrderRow[]) {
  const now = new Date();
  const months: { key: string; label: string; total: number }[] = [];
  for (let i = 5; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      key: `${d.getFullYear()}-${d.getMonth()}`,
      label: d.toLocaleDateString("es-AR", { month: "short" }),
      total: 0,
    });
  }
  const map = new Map(months.map((m) => [m.key, m]));
  for (const o of rows) {
    const d = new Date(o.created_at);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    const m = map.get(key);
    if (m) m.total += o.total ?? 0;
  }
  return months;
}