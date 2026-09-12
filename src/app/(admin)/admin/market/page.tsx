"use client";

import { useEffect, useState } from "react";
import { Download, TrendingUp, ShoppingBag, DollarSign } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatPrice } from "@/lib/market";

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

export default function AdminMarketPage() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalSales, setTotalSales] = useState(0);
  const [totalCommission, setTotalCommission] = useState(0);

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("market_orders")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (data) {
        setOrders(data as OrderRow[]);
        setTotalSales(data.reduce((sum, o) => sum + (o.total ?? 0), 0));
        setTotalCommission(data.reduce((sum, o) => sum + (o.platform_fee ?? 0), 0));
      }
      setLoading(false);
    };
    load();
  }, []);

  const exportCSV = () => {
    const header = "ID;Fecha;Total;Comisión;Estado;Entrega;Comprador;Vendedor";
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

  if (loading) {
    return (
      <main className="animate-pulse px-4 pt-5 space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 rounded-xl bg-card" />
        ))}
      </main>
    );
  }

  return (
    <main className="px-4 pt-5 space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-2xl border border-edge bg-card p-4">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-muted">
            <ShoppingBag className="h-3.5 w-3.5 text-ember" /> Órdenes totales
          </p>
          <p className="mt-1 text-3xl font-extrabold text-ink">{orders.length}</p>
        </div>
        <div className="rounded-2xl border border-edge bg-card p-4">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-muted">
            <TrendingUp className="h-3.5 w-3.5 text-green-400" /> Ventas totales
          </p>
          <p className="mt-1 text-xl font-extrabold text-ink">{formatPrice(totalSales)}</p>
        </div>
        <div className="rounded-2xl border border-neon/30 bg-neon/5 p-4">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-muted">
            <DollarSign className="h-3.5 w-3.5 text-neon" /> Comisión total
          </p>
          <p className="mt-1 text-xl font-extrabold text-neon">{formatPrice(totalCommission)}</p>
        </div>
        <button
          onClick={exportCSV}
          className="flex flex-col items-center justify-center gap-1 rounded-2xl border border-edge bg-card p-4 text-xs font-semibold text-ink"
        >
          <Download className="h-5 w-5 text-neon" />
          Exportar CSV
        </button>
      </div>

      {/* Orders list */}
      <div>
        <h3 className="mb-2 text-sm font-semibold text-ink">Últimas órdenes</h3>
        <div className="space-y-2">
          {orders.slice(0, 50).map((o) => (
            <div key={o.id} className="flex items-center justify-between rounded-xl border border-edge bg-card p-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-ink">#{o.id.slice(0, 8)}</p>
                <p className="text-[10px] text-muted">
                  {new Date(o.created_at).toLocaleDateString("es-AR")} · {o.delivery_type}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-ink">{formatPrice(o.total)}</p>
                <p className="text-[10px] text-neon">com: {formatPrice(o.platform_fee)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
