"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Wallet, PlusCircle, Landmark, TrendingUp, ShoppingBag } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuthState } from "@/lib/auth-context";
import { formatPrice, orderStatusLabel } from "@/lib/market";
import { getMarketConfig } from "@/lib/market-config";

interface WalletTx {
  id: string;
  type: string;
  amount: number;
  reference: string | null;
  note: string | null;
  created_at: string;
}

interface WalletData {
  balance: number;
  tx_count: number;
  wallet_id: string | null;
}

interface MyDeposit {
  id: string;
  pedido: string;
  amount: number;
  status: string;
  created_at: string;
}

interface OrderRow {
  id: string;
  buyer_id: string;
  seller_id: string;
  status: string;
  total: number;
  delivery_type: string;
  created_at: string;
}

interface ItemRow {
  order_id: string;
  product_id: string;
  quantity: number;
  price: number;
}

function OrderCard({ order, products, kind }: { order: OrderRow; products: string[]; kind: "venta" | "compra" }) {
  return (
    <div className="rounded-xl border border-edge bg-card p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className={`flex h-7 w-7 items-center justify-center rounded-full ${
              kind === "venta" ? "bg-neon/15 text-neon" : "bg-ember/15 text-ember"
            }`}
          >
            {kind === "venta" ? <TrendingUp className="h-3.5 w-3.5" /> : <ShoppingBag className="h-3.5 w-3.5" />}
          </span>
          <span className="text-[10px] text-muted">#{order.id.slice(0, 8)}</span>
          <span className="text-[10px] text-muted">
            {new Date(order.created_at).toLocaleDateString("es-AR")}
          </span>
        </div>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
            order.status === "confirmed"
              ? "bg-neon/15 text-neon"
              : order.status === "delivered"
                ? "bg-green-500/15 text-green-400"
                : order.status === "cancelled"
                  ? "bg-ember/15 text-ember"
                  : "bg-muted/15 text-muted"
          }`}
        >
          {orderStatusLabel(order.status)}
        </span>
      </div>
      {products.length > 0 && (
        <p className="mt-1.5 truncate text-xs font-semibold text-ink">{products.join(" · ")}</p>
      )}
      <div className="mt-1 flex items-center justify-between">
        <p className="text-[10px] text-muted">{kind === "venta" ? "Vendiste" : "Compraste"}</p>
        <p className="text-sm font-bold text-neon">{formatPrice(order.total)}</p>
      </div>
    </div>
  );
}

export default function BilleteraPage() {
  const { userId } = useAuthState();
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [txs, setTxs] = useState<WalletTx[]>([]);
  const [deposits, setDeposits] = useState<MyDeposit[]>([]);
  const [allowCart, setAllowCart] = useState(false);
  const [sales, setSales] = useState<OrderRow[]>([]);
  const [purchases, setPurchases] = useState<OrderRow[]>([]);
  const [salesProducts, setSalesProducts] = useState<Record<string, string[]>>({});
  const [purchaseProducts, setPurchaseProducts] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;

    const buildProductsMap = async (orders: OrderRow[]) => {
      if (orders.length === 0) return;
      const supabase = createClient();
      const ids = orders.map((o) => o.id);
      const { data: itemsData } = await supabase
        .from("market_order_items")
        .select("*")
        .in("order_id", ids);
      if (!itemsData) return;
      const items = itemsData as ItemRow[];
      const productIds = [...new Set(items.map((i) => i.product_id))];
      const { data: productsData } = await supabase
        .from("market_products")
        .select("id, name")
        .in("id", productIds);
      const names = new Map((productsData ?? []).map((p) => [p.id as string, p.name as string]));
      const map: Record<string, string[]> = {};
      for (const o of orders) {
        const namesForOrder = items.filter((i) => i.order_id === o.id).map((i) => names.get(i.product_id) ?? i.product_id.slice(0, 8));
        if (namesForOrder.length > 0) map[o.id] = namesForOrder;
      }
      return map;
    };

    const load = async () => {
      const supabase = createClient();
      const cfg = await getMarketConfig();
      setAllowCart(cfg.allowCart);

      const [salesRes, purchasesRes] = await Promise.all([
        supabase.from("market_orders").select("*").eq("seller_id", userId).order("created_at", { ascending: false }).limit(30),
        supabase.from("market_orders").select("*").eq("buyer_id", userId).order("created_at", { ascending: false }).limit(30),
      ]);
      const s = (salesRes.data ?? []) as OrderRow[];
      const p = (purchasesRes.data ?? []) as OrderRow[];
      setSales(s);
      setPurchases(p);

      const [sMap, pMap] = await Promise.all([buildProductsMap(s), buildProductsMap(p)]);
      if (sMap) setSalesProducts(sMap);
      if (pMap) setPurchaseProducts(pMap);

      if (cfg.allowCart) {
        const [{ data }, depRes] = await Promise.all([
          supabase.rpc("get_my_wallet"),
          supabase
            .from("publish_deposits")
            .select("*")
            .eq("user_id", userId)
            .order("created_at", { ascending: false })
            .limit(20),
        ]);
        if (data) {
          setWallet(data as WalletData);
          if ((data as WalletData).wallet_id) {
            const { data: txData } = await supabase
              .from("wallet_transactions")
              .select("*")
              .eq("wallet_id", (data as WalletData).wallet_id)
              .order("created_at", { ascending: false })
              .limit(50);
            if (txData) setTxs(txData as WalletTx[]);
          }
        }
        if (depRes.data) setDeposits(depRes.data as MyDeposit[]);
      }

      setLoading(false);
    };

    void load();
    const supabase = createClient();
    const channel = supabase
      .channel("billetera-live")
      .on(
        "postgres_changes" as const,
        { event: "*", schema: "public", table: "market_orders", filter: `seller_id=eq.${userId}` },
        () => {
          void load();
        }
      )
      .on(
        "postgres_changes" as const,
        { event: "*", schema: "public", table: "market_orders", filter: `buyer_id=eq.${userId}` },
        () => {
          void load();
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  if (loading) {
    return (
      <main className="mx-auto max-w-md animate-pulse p-4 space-y-4">
        <div className="h-5 w-1/2 rounded bg-card" />
        <div className="h-24 rounded bg-card" />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md md:max-w-2xl lg:max-w-3xl">
      <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-edge bg-bg/90 px-4 py-3 backdrop-blur">
        <Link href="/market">
          <ArrowLeft className="h-5 w-5 cursor-pointer text-muted" />
        </Link>
        <h1 className="text-lg font-bold text-ink">Billetera</h1>
      </div>

      <div className="p-4 space-y-4">
        {!allowCart && (
          <div className="rounded-xl border border-edge bg-card p-3 text-[11px] text-muted">
            Acá ves el resumen de tus <b className="text-ink">ventas y compras</b> en SpotterShop. La
            función de saldo está desactivada por ahora; reaparece cuando el admin habilite el modo
            carrito.
          </div>
        )}

        {allowCart && (
          <>
            <div className="rounded-2xl border border-neon/30 bg-neon/5 p-5 text-center">
              <Wallet className="mx-auto mb-2 h-8 w-8 text-neon" />
              <p className="text-xs text-muted">Tu saldo</p>
              <p className="mt-1 text-3xl font-bold text-neon">{formatPrice(wallet?.balance ?? 0)}</p>
              <p className="mt-1 text-[10px] text-muted">
                {wallet?.tx_count ?? 0} movimiento{wallet?.tx_count !== 1 ? "s" : ""}
              </p>
            </div>

            <div className="rounded-xl border border-edge bg-card p-4 space-y-3">
              <p className="text-sm font-semibold text-ink">¿Cómo cargo saldo?</p>
              <p className="text-[11px] text-muted leading-relaxed">
                Cuando te quede una publicación paga, vas a ver los datos de la cuenta del
                administrador para transferirle. Al confirmar, tu publicación queda{" "}
                <b className="text-ink">pendiente</b> hasta que el admin confirme el pago.
              </p>
              <Link
                href="/market/crear"
                className="flex items-center justify-center gap-1.5 rounded-lg bg-neon py-2 text-xs font-bold text-bg"
              >
                <PlusCircle className="h-4 w-4" /> Publicar un producto
              </Link>
            </div>

            {deposits.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-semibold text-ink">Mis depósitos</h3>
                <div className="space-y-2">
                  {deposits.map((d) => (
                    <div key={d.id} className="flex items-center justify-between gap-3 rounded-xl border border-edge bg-card p-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-yellow-500/15 text-yellow-400">
                          <Landmark className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-ink">{d.pedido}</p>
                          <p className="text-[10px] text-muted">
                            {new Date(d.created_at).toLocaleDateString("es-AR", {
                              day: "numeric",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold text-ink">{formatPrice(d.amount)}</p>
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            d.status === "acreditado"
                              ? "bg-green-500/15 text-green-400"
                              : "bg-yellow-500/15 text-yellow-400"
                          }`}
                        >
                          {d.status === "acreditado" ? "Acreditado" : "Pendiente"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <h3 className="mb-2 text-sm font-semibold text-ink">Historial</h3>
              {txs.length === 0 ? (
                <p className="py-6 text-center text-xs text-muted">Sin movimientos todavía</p>
              ) : (
                <div className="space-y-2">
                  {txs.map((tx) => (
                    <div key={tx.id} className="flex items-center gap-3 rounded-xl border border-edge bg-card p-3">
                      <div className={`flex h-8 w-8 items-center justify-center rounded-full ${
                        tx.type === "credit" ? "bg-green-500/15 text-green-400"
                          : tx.type === "debit" ? "bg-neon/15 text-neon"
                          : tx.type === "commission" ? "bg-ember/15 text-ember"
                          : tx.type === "withdrawal_request" ? "bg-yellow-500/15 text-yellow-400"
                          : "bg-muted/15 text-muted"
                      }`}>
                        {tx.type === "credit" ? "↓" : tx.type === "debit" || tx.type === "commission" ? "↑" : "⟳"}
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-semibold text-ink">
                          {tx.note ?? tx.type}
                        </p>
                        <p className="text-[10px] text-muted">
                          {new Date(tx.created_at).toLocaleDateString("es-AR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                      <span className={`text-xs font-bold ${tx.amount >= 0 ? "text-green-400" : "text-ember"}`}>
                        {tx.amount >= 0 ? "+" : ""}{formatPrice(tx.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        <div>
          <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-ink">
            <TrendingUp className="h-4 w-4 text-neon" /> Ventas realizadas
          </h3>
          {sales.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted">Todavía no vendiste nada</p>
          ) : (
            <div className="space-y-2">
              {sales.map((o) => (
                <OrderCard key={o.id} order={o} products={salesProducts[o.id] ?? []} kind="venta" />
              ))}
            </div>
          )}
        </div>

        <div>
          <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-ink">
            <ShoppingBag className="h-4 w-4 text-ember" /> Compras
          </h3>
          {purchases.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted">Todavía no compraste nada</p>
          ) : (
            <div className="space-y-2">
              {purchases.map((o) => (
                <OrderCard key={o.id} order={o} products={purchaseProducts[o.id] ?? []} kind="compra" />
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}