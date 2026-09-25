"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Package, TrendingUp } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuthState } from "@/lib/auth-context";
import { formatPrice, orderStatusLabel, type MarketProduct, type MarketOrder } from "@/lib/market";

export default function MisPublicacionesPage() {
  const { userId } = useAuthState();
  const [tab, setTab] = useState<"productos" | "ventas">("productos");
  const [products, setProducts] = useState<MarketProduct[]>([]);
  const [orders, setOrders] = useState<MarketOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    const load = async () => {
      const { data: p } = await supabase
        .from("market_products")
        .select("*")
        .eq("seller_id", userId)
        .order("created_at", { ascending: false });
      if (p) setProducts(p as MarketProduct[]);

      const { data: o } = await supabase
        .from("market_orders")
        .select("*")
        .eq("seller_id", userId)
        .order("created_at", { ascending: false });
      if (o) setOrders(o as MarketOrder[]);

      setLoading(false);
    };
    load();
  }, [userId]);

  const toggleStatus = async (id: string, current: string) => {
    const newStatus = current === "active" ? "paused" : "active";
    const supabase = createClient();
    await supabase.from("market_products").update({ status: newStatus }).eq("id", id);
    setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, status: newStatus as MarketProduct["status"] } : p)));
  };

  const markSold = async (id: string) => {
    const supabase = createClient();
    await supabase.from("market_products").update({ status: "sold" }).eq("id", id);
    setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, status: "sold" } : p)));
  };

  const updateOrderStatus = async (id: string, status: string) => {
    const supabase = createClient();
    await supabase.from("market_orders").update({ status }).eq("id", id);
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status: status as MarketOrder["status"] } : o)));
  };

  if (loading) {
    return (
      <main className="mx-auto max-w-md animate-pulse p-4 space-y-4">
        <div className="h-5 w-1/2 rounded bg-card" />
        <div className="h-20 rounded bg-card" />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md md:max-w-2xl lg:max-w-3xl">
      <div className="sticky top-0 z-30 border-b border-edge bg-bg/90 backdrop-blur">
        <div className="flex items-center gap-3 px-4 py-3">
          <Link href="/market" className="text-muted">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-lg font-bold text-ink">Mis ventas</h1>
        </div>
        <div className="flex border-b border-edge">
          <button
            onClick={() => setTab("productos")}
            className={`flex-1 py-2 text-xs font-semibold ${tab === "productos" ? "border-b-2 border-neon text-neon" : "text-muted"}`}
          >
            <Package className="mr-1 inline h-3.5 w-3.5" /> Publicaciones ({products.length})
          </button>
          <button
            onClick={() => setTab("ventas")}
            className={`flex-1 py-2 text-xs font-semibold ${tab === "ventas" ? "border-b-2 border-neon text-neon" : "text-muted"}`}
          >
            <TrendingUp className="mr-1 inline h-3.5 w-3.5" /> Ventas ({orders.length})
          </button>
        </div>
      </div>

      <div className="p-4 space-y-3">
        {tab === "productos" ? (
          products.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted">No publicaste nada todavía</p>
          ) : (
            products.map((p) => (
              <div key={p.id} className="flex gap-3 rounded-xl border border-edge bg-card p-3">
                {p.images[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.images[0]} alt="" className="h-14 w-14 rounded-lg object-cover" />
                ) : (
                  <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-bg text-lg">📷</div>
                )}
                <div className="flex-1">
                  <Link href={`/market/${p.id}`} className="text-sm font-semibold text-ink">
                    {p.name}
                  </Link>
                  <p className="text-xs text-neon font-bold">{formatPrice(p.price)}</p>
                  <div className="mt-1 flex gap-2">
                    <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                      p.status === "active" ? "bg-neon/15 text-neon" : p.status === "sold" ? "bg-ember/15 text-ember" : p.status === "pending" ? "bg-yellow-500/15 text-yellow-400" : "bg-muted/15 text-muted"
                    }`}>
                      {p.status === "active" ? "Activo" : p.status === "sold" ? "Vendido" : p.status === "pending" ? "Pendiente de pago" : "Pausado"}
                    </span>
                    {p.status === "pending" && (
                      <p className="mt-1 text-[10px] text-muted">
                        Se publica cuando el admin confirme el pago.
                      </p>
                    )}
                  </div>
                </div>
                {p.status === "active" && (
                  <div className="flex flex-col gap-1">
                    <button onClick={() => toggleStatus(p.id, p.status)} className="text-[10px] text-muted hover:text-ink">
                      Pausar
                    </button>
                    <button onClick={() => markSold(p.id)} className="text-[10px] text-ember hover:text-ink">
                      Vendido
                    </button>
                  </div>
                )}
                {p.status === "paused" && (
                  <button onClick={() => toggleStatus(p.id, p.status)} className="text-[10px] text-neon hover:text-ink">
                    Activar
                  </button>
                )}
              </div>
            ))
          )
        ) : (
          orders.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted">No tenés ventas todavía</p>
          ) : (
            orders.map((o) => (
              <div key={o.id} className="rounded-xl border border-edge bg-card p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted">#{o.id.slice(0, 8)}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    o.status === "confirmed" ? "bg-neon/15 text-neon" : o.status === "delivered" ? "bg-green-500/15 text-green-400" : "bg-muted/15 text-muted"
                  }`}>
                    {orderStatusLabel(o.status)}
                  </span>
                </div>
                <p className="text-sm font-bold text-neon">{formatPrice(o.total)}</p>
                <div className="flex gap-2">
                  {o.status === "confirmed" && (
                    <button
                      onClick={() => updateOrderStatus(o.id, "delivered")}
                      className="rounded-lg border border-neon/30 bg-neon/10 px-3 py-1.5 text-[11px] font-semibold text-neon"
                    >
                      Marcar entregada
                    </button>
                  )}
                </div>
              </div>
            ))
          )
        )}
      </div>
    </main>
  );
}
