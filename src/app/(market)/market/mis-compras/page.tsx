"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ShoppingBag } from "lucide-react";
import { MarketNavHamburger } from "@/components/market/MarketNavContext";
import { createClient } from "@/lib/supabase/client";
import { useAuthState } from "@/lib/auth-context";
import { formatPrice, orderStatusLabel, type MarketOrder, type MarketOrderItem, type MarketProduct } from "@/lib/market";

interface OrderWithItems extends MarketOrder {
  items?: (MarketOrderItem & { product?: MarketProduct })[];
}

export default function MisComprasPage() {
  const { userId } = useAuthState();
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    const load = async () => {
      const { data: o } = await supabase
        .from("market_orders")
        .select("*")
        .eq("buyer_id", userId)
        .order("created_at", { ascending: false });
      if (!o) { setLoading(false); return; }

      const orderList = o as OrderWithItems[];
      for (const order of orderList) {
        const { data: items } = await supabase
          .from("market_order_items")
          .select("*")
          .eq("order_id", order.id);
        if (items) {
          order.items = items as MarketOrderItem[];
          for (const item of order.items) {
            const { data: prod } = await supabase
              .from("market_products")
              .select("id, name, images")
              .eq("id", item.product_id)
              .maybeSingle();
            if (prod) item.product = prod as MarketProduct;
          }
        }
      }
      setOrders(orderList);
      setLoading(false);
    };
    load();
  }, [userId]);

  const cancelOrder = async (id: string) => {
    const supabase = createClient();
    await supabase.from("market_orders").update({ status: "cancelled" }).eq("id", id);
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status: "cancelled" } : o)));
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
      <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-edge bg-bg/90 px-4 py-3 backdrop-blur">
        <MarketNavHamburger />
        <Link href="/market" className="text-muted">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-lg font-bold text-ink">Mis compras</h1>
      </div>

      <div className="p-4 space-y-3">
        {orders.length === 0 ? (
          <div className="py-20 text-center">
            <ShoppingBag className="mx-auto mb-3 h-10 w-10 text-muted" />
            <p className="text-sm text-muted">No hiciste compras todavía</p>
            <Link href="/market" className="mt-3 inline-block text-sm font-semibold text-neon">
              Ver productos
            </Link>
          </div>
        ) : (
          orders.map((o) => (
            <div key={o.id} className="rounded-xl border border-edge bg-card p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted">#{o.id.slice(0, 8)} · {new Date(o.created_at).toLocaleDateString("es-AR")}</span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  o.status === "pending" ? "bg-yellow-500/15 text-yellow-400"
                    : o.status === "confirmed" ? "bg-neon/15 text-neon"
                    : o.status === "delivered" ? "bg-green-500/15 text-green-400"
                    : "bg-muted/15 text-muted"
                }`}>
                  {orderStatusLabel(o.status)}
                </span>
              </div>

              {o.items?.map((item) => (
                <div key={item.id} className="flex items-center gap-2">
                  {item.product?.images[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.product.images[0]} alt="" className="h-10 w-10 rounded-lg object-cover" />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-bg text-sm">📷</div>
                  )}
                  <div className="flex-1">
                    <p className="truncate text-xs font-semibold text-ink">{item.product?.name ?? "Producto"}</p>
                    <p className="text-[10px] text-muted">×{item.quantity}</p>
                  </div>
                  <p className="text-xs font-bold text-ink">{formatPrice(item.price * item.quantity)}</p>
                </div>
              ))}

              <div className="border-t border-edge pt-1 flex justify-between text-xs font-bold text-ink">
                <span>Total</span>
                <span>{formatPrice(o.total)}</span>
              </div>

              {o.status === "pending" && (
                <button
                  onClick={() => cancelOrder(o.id)}
                  className="rounded-lg border border-ember/30 bg-ember/10 px-3 py-1.5 text-[11px] font-semibold text-ember"
                >
                  Cancelar
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </main>
  );
}
