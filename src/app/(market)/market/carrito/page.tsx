"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Trash2, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuthState } from "@/lib/auth-context";
import { formatPrice, commissionFor, type CartItem } from "@/lib/market";

export default function MarketCarritoPage() {
  const { userId } = useAuthState();
  const router = useRouter();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState(false);
  const [deliveryType, setDeliveryType] = useState<"retiro" | "envio">("retiro");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [commissionRate, setCommissionRate] = useState(0.01);

  useEffect(() => {
    const init = () => {
      const raw = localStorage.getItem("spotterx_cart");
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          setCart(parsed);
        } catch { /* ignore */ }
      }
      setLoading(false);

      const supabase = createClient();
      supabase
        .from("platform_config")
        .select("value")
        .eq("key", "commission_rate")
        .maybeSingle()
        .then(({ data }) => {
          if (data) setCommissionRate((data.value as unknown as number));
        });
    };
    init();
  }, []);

  const total = cart.reduce((sum, c) => sum + c.price * c.quantity, 0);
  const fee = commissionFor(total, commissionRate);

  const updateQty = (idx: number, delta: number) => {
    setCart((prev) => {
      const next = [...prev];
      next[idx].quantity = Math.max(1, Math.min(next[idx].stock, next[idx].quantity + delta));
      localStorage.setItem("spotterx_cart", JSON.stringify(next));
      return next;
    });
  };

  const remove = (idx: number) => {
    setCart((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      localStorage.setItem("spotterx_cart", JSON.stringify(next));
      return next;
    });
  };

  const buy = async () => {
    if (!userId || cart.length === 0 || buying) return;
    setBuying(true);
    const supabase = createClient();

    // Group by seller
    const bySeller = new Map<string, CartItem[]>();
    cart.forEach((c) => {
      const arr = bySeller.get(c.seller_id) ?? [];
      arr.push(c);
      bySeller.set(c.seller_id, arr);
    });

    let success = true;
    for (const [, items] of bySeller) {
      // Create order via RPC
      const { data: orderId, error } = await supabase.rpc("market_checkout", {
        p_items: items.map((i) => ({ product_id: i.product_id, quantity: i.quantity })),
        p_delivery: deliveryType,
        p_address: address.trim() || null,
        p_notes: notes.trim() || null,
      });

      if (error || !orderId) {
        alert(error?.message ?? "Error al crear la orden");
        success = false;
        break;
      }

      // Pay from wallet
      const { error: payErr } = await supabase.rpc("buy_from_wallet", {
        p_order_id: orderId,
      });

      if (payErr) {
        alert(payErr.message ?? "Error al pagar con billetera");
        success = false;
        break;
      }
    }

    if (success) {
      localStorage.removeItem("spotterx_cart");
      router.push("/market/mis-compras");
    }
    setBuying(false);
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
    <main className="mx-auto max-w-md pb-24">
      <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-edge bg-bg/90 px-4 py-3 backdrop-blur">
        <button onClick={() => router.back()} className="text-muted">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-bold text-ink">Carrito</h1>
      </div>

      <div className="space-y-4 p-4">
        {cart.length === 0 ? (
          <div className="py-20 text-center text-sm text-muted">
            <p>El carrito está vacío</p>
            <Link href="/market" className="mt-2 inline-block text-neon font-semibold">
              Ver productos
            </Link>
          </div>
        ) : (
          <>
            {cart.map((item, idx) => (
              <div key={item.product_id} className="flex gap-3 rounded-xl border border-edge bg-card p-3">
                {item.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.image} alt="" className="h-16 w-16 rounded-lg object-cover" />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-bg text-xl">📷</div>
                )}
                <div className="flex-1">
                  <p className="truncate text-sm font-semibold text-ink">{item.name}</p>
                  <p className="text-sm font-bold text-neon">{formatPrice(item.price)}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <button
                      onClick={() => updateQty(idx, -1)}
                      className="rounded border border-edge px-2 text-xs text-muted"
                    >
                      −
                    </button>
                    <span className="text-xs font-semibold text-ink">{item.quantity}</span>
                    <button
                      onClick={() => updateQty(idx, 1)}
                      className="rounded border border-edge px-2 text-xs text-muted"
                    >
                      +
                    </button>
                  </div>
                </div>
                <button onClick={() => remove(idx)} className="text-muted hover:text-ember">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}

            {/* Delivery */}
            <div>
              <label className="text-xs font-medium text-muted">Entrega</label>
              <div className="mt-1.5 flex gap-2">
                <button
                  onClick={() => setDeliveryType("retiro")}
                  className={`flex-1 rounded-lg border py-2 text-xs font-medium transition ${
                    deliveryType === "retiro"
                      ? "border-neon bg-neon/15 text-neon"
                      : "border-edge text-muted"
                  }`}
                >
                  Retiro en persona
                </button>
                <button
                  onClick={() => setDeliveryType("envio")}
                  className={`flex-1 rounded-lg border py-2 text-xs font-medium transition ${
                    deliveryType === "envio"
                      ? "border-neon bg-neon/15 text-neon"
                      : "border-edge text-muted"
                  }`}
                >
                  Envío
                </button>
              </div>
              {deliveryType === "envio" && (
                <input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Dirección de envío..."
                  className="mt-2 w-full rounded-lg border border-edge bg-bg px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-neon focus:outline-none"
                />
              )}
              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notas para el vendedor (opcional)..."
                className="mt-2 w-full rounded-lg border border-edge bg-bg px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-neon focus:outline-none"
              />
            </div>

            {/* Totals */}
            <div className="space-y-1 rounded-xl border border-edge bg-card p-3">
              <div className="flex justify-between text-xs text-muted">
                <span>Subtotal ({cart.reduce((s, c) => s + c.quantity, 0)} items)</span>
                <span>{formatPrice(total)}</span>
              </div>
              <div className="flex justify-between text-xs text-muted">
                <span>Comisión SpotterX (1%)</span>
                <span>{formatPrice(fee)}</span>
              </div>
              <div className="border-t border-edge pt-1 flex justify-between text-sm font-bold text-ink">
                <span>Total</span>
                <span>{formatPrice(total)}</span>
              </div>
            </div>

            <button
              onClick={buy}
              disabled={buying || cart.length === 0}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-neon py-3 text-sm font-semibold text-bg shadow-neon disabled:opacity-50"
            >
              {buying ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Confirmar compra
            </button>
          </>
        )}
      </div>
    </main>
  );
}
