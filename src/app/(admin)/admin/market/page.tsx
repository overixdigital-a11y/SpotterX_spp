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
  const [publishRevenue, setPublishRevenue] = useState({ total: 0, count: 0 });

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
      }
      const { data: rev } = await supabase.rpc("admin_publish_revenue");
      if (rev) setPublishRevenue(rev as { total: number; count: number });
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
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 animate-pulse rounded-lg bg-[#121722]" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
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
          <p className="mt-1 text-xl font-extrabold text-[#e4e8ee]">
            {formatPrice(totalSales)}
          </p>
        </div>
        <div className="rounded-lg border border-[#00e5c7]/20 bg-[#00e5c7]/5 p-4">
          <p className="flex items-center gap-1.5 text-xs font-medium text-[#9ca3af]">
            <DollarSign className="h-3.5 w-3.5 text-[#00e5c7]" /> Ingresos por publicaciones
          </p>
          <p className="mt-1 text-xl font-extrabold text-[#00e5c7]">
            {formatPrice(publishRevenue.total)}
          </p>
          <p className="text-[10px] text-[#9ca3af]">{publishRevenue.count} publicaciones pagas</p>
        </div>
        <button
          onClick={exportCSV}
          className="flex flex-col items-center justify-center gap-1 rounded-lg border border-[#1e2530] bg-[#121722] p-4 text-xs font-medium text-[#e4e8ee] hover:border-[#00e5c7]/50"
        >
          <Download className="h-5 w-5 text-[#00e5c7]" />
          Exportar CSV
        </button>
      </div>

      <div>
        <h3 className="mb-3 text-sm font-semibold text-[#e4e8ee]">Últimas órdenes</h3>
        <div className="overflow-hidden rounded-lg border border-[#1e2530]">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[#1e2530] bg-[#0c1017]">
                <th className="px-4 py-2.5 text-xs font-medium text-[#9ca3af]">ID</th>
                <th className="px-4 py-2.5 text-xs font-medium text-[#9ca3af]">Fecha</th>
                <th className="hidden px-4 py-2.5 text-xs font-medium text-[#9ca3af] sm:table-cell">Entrega</th>
                <th className="px-4 py-2.5 text-xs font-medium text-[#9ca3af]">Total</th>
                <th className="px-4 py-2.5 text-xs font-medium text-[#9ca3af]">Comisión</th>
              </tr>
            </thead>
            <tbody>
              {orders.slice(0, 50).map((o) => (
                <tr key={o.id} className="border-b border-[#1e2530]/50 last:border-0 hover:bg-[#121722]/50">
                  <td className="px-4 py-2.5 text-xs font-medium text-[#e4e8ee]">
                    #{o.id.slice(0, 8)}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-[#9ca3af]">
                    {new Date(o.created_at).toLocaleDateString("es-AR")}
                  </td>
                  <td className="hidden px-4 py-2.5 text-xs text-[#9ca3af] sm:table-cell">
                    {o.delivery_type}
                  </td>
                  <td className="px-4 py-2.5 text-xs font-medium text-[#e4e8ee]">
                    {formatPrice(o.total)}
                  </td>
                  <td className="px-4 py-2.5 text-xs font-medium text-[#00e5c7]">
                    {formatPrice(o.platform_fee)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
