"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ShoppingCart, MessageCircle, Star, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuthState } from "@/lib/auth-context";
import { useModuleGuard, getBlockedOwners } from "@/lib/gym-modules";
import { getMarketConfig } from "@/lib/market-config";
import { Avatar } from "@/components/core/Avatar";
import {
  formatPrice,
  conditionLabel,
  type MarketProduct,
  type MarketReview,
} from "@/lib/market";

interface Seller {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
}

interface CartItem {
  product_id: string;
  name: string;
  price: number;
  image: string | null;
  quantity: number;
  stock: number;
  seller_id: string;
}

export default function MarketProductPage() {
  const { id } = useParams<{ id: string }>();
  const { userId } = useAuthState();
  const router = useRouter();
  const { busy } = useModuleGuard("spotter_shop");
  const [product, setProduct] = useState<MarketProduct | null>(null);
  const [seller, setSeller] = useState<Seller | null>(null);
  const [reviews, setReviews] = useState<MarketReview[]>([]);
  const [qty, setQty] = useState(1);
  const [loading, setLoading] = useState(true);
  const [allowCart, setAllowCart] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    getMarketConfig().then((cfg) => setAllowCart(cfg.allowCart));
  }, []);

  useEffect(() => {
    if (!id) return;
    const supabase = createClient();
    const load = async () => {
      const { data: p } = await supabase
        .from("market_products")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (!p) { setLoading(false); return; }
      const blocked = new Set(await getBlockedOwners("spotter_shop"));
      if (blocked.has(p.seller_id)) {
        setHidden(true);
        setLoading(false);
        return;
      }
      setProduct(p as MarketProduct);

      const { data: s } = await supabase
        .from("profiles")
        .select("id, full_name, username, avatar_url")
        .eq("id", p.seller_id)
        .maybeSingle();
      if (s) setSeller(s as Seller);

      const { data: r } = await supabase
        .from("market_reviews")
        .select("*")
        .eq("product_id", id)
        .order("created_at", { ascending: false });
      if (r) setReviews(r as MarketReview[]);

      setLoading(false);
    };
    load();
  }, [id]);

  const avgRating = useMemo(() => {
    if (reviews.length === 0) return 0;
    return reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
  }, [reviews]);

  const addToCart = () => {
    if (!product) return;
    const raw = localStorage.getItem("spotterx_cart");
    const cart: CartItem[] = raw ? JSON.parse(raw) : [];
    const existing = cart.find((c) => c.product_id === product.id);
    if (existing) {
      existing.quantity = Math.min(existing.quantity + qty, existing.stock);
    } else {
      cart.push({
        product_id: product.id,
        name: product.name,
        price: product.price,
        image: product.images[0] ?? null,
        quantity: qty,
        stock: product.stock,
        seller_id: product.seller_id,
      });
    }
    localStorage.setItem("spotterx_cart", JSON.stringify(cart));
    router.push("/market/carrito");
  };

  if (busy) {
    return (
      <main className="mx-auto max-w-md p-4 pt-20 text-center">
        <Loader2 className="mx-auto h-6 w-6 animate-spin text-neon" />
      </main>
    );
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-md animate-pulse space-y-4 p-4">
        <div className="aspect-square rounded-xl bg-card" />
        <div className="h-5 w-3/4 rounded bg-card" />
        <div className="h-4 w-1/2 rounded bg-card" />
      </main>
    );
  }

  if (hidden) {
    return (
      <main className="mx-auto max-w-md p-4 text-center py-20">
        <p className="text-muted">Este producto no está disponible</p>
      </main>
    );
  }

  if (!product) {
    return (
      <main className="mx-auto max-w-md p-4 text-center py-20">
        <p className="text-muted">Producto no encontrado</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md md:max-w-2xl lg:max-w-3xl">
      {/* Header */}
      <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-edge bg-bg/90 px-4 py-3 backdrop-blur">
        <button onClick={() => router.back()} className="text-muted">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="flex-1 truncate text-sm font-semibold text-ink">{product.name}</h1>
      </div>

      {/* Gallery */}
      {product.images.length > 0 ? (
        <div className="aspect-square w-full bg-bg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={product.images[0]}
            alt={product.name}
            className="h-full w-full object-cover"
          />
        </div>
      ) : (
        <div className="flex aspect-square w-full items-center justify-center bg-bg text-4xl text-muted">
          📷
        </div>
      )}

      <div className="space-y-4 p-4">
        {/* Price + info */}
        <div>
          <p className="text-2xl font-bold text-neon">{formatPrice(product.price)}</p>
          <div className="mt-1 flex items-center gap-2 text-xs text-muted">
            <span className="rounded-full bg-bg px-2 py-0.5">{conditionLabel(product.condition)}</span>
            <span>{product.stock} disponible{product.stock !== 1 ? "s" : ""}</span>
            <span>· {product.category}</span>
          </div>
        </div>

        {/* Description */}
        {product.description && (
          <p className="text-sm text-ink leading-relaxed">{product.description}</p>
        )}

        {/* Location */}
        {product.location && (
          <p className="text-xs text-muted">📍 {product.location}</p>
        )}

        {/* Seller */}
        {seller && (
          <Link
            href={`/perfil/${seller.username}`}
            className="flex items-center gap-3 rounded-xl border border-edge bg-card p-3"
          >
            <Avatar src={seller.avatar_url} name={seller.full_name} size="sm" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-ink">{seller.full_name ?? seller.username}</p>
              <p className="text-xs text-muted">@{seller.username}</p>
            </div>
          </Link>
        )}

        {/* Quantity + Buy */}
        {product.status === "active" && allowCart && userId !== product.seller_id && (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted">Cantidad:</span>
              <div className="flex items-center rounded-lg border border-edge">
                <button
                  onClick={() => setQty(Math.max(1, qty - 1))}
                  className="px-3 py-1.5 text-sm text-muted"
                >
                  −
                </button>
                <span className="min-w-[2rem] text-center text-sm font-semibold text-ink">{qty}</span>
                <button
                  onClick={() => setQty(Math.min(product.stock, qty + 1))}
                  className="px-3 py-1.5 text-sm text-muted"
                >
                  +
                </button>
              </div>
            </div>
            <button
              onClick={addToCart}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-neon py-3 text-sm font-semibold text-bg shadow-neon active:scale-[0.98]"
            >
              <ShoppingCart className="h-4 w-4" /> Agregar al carrito
            </button>
          </div>
        )}

        {/* Ask seller */}
        {userId && userId !== product.seller_id && (
          <a
            href={`/chat/${product.seller_id}`}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-edge bg-card py-3 text-sm font-semibold text-ink"
          >
            <MessageCircle className="h-4 w-4" /> Preguntar al vendedor
          </a>
        )}

        {/* Reviews */}
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-ink">
            Reseñas {reviews.length > 0 && `(${reviews.length})`}
          </h3>
          {avgRating > 0 && (
            <div className="flex items-center gap-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  className={`h-4 w-4 ${i < Math.round(avgRating) ? "fill-ember text-ember" : "text-muted"}`}
                />
              ))}
              <span className="ml-1 text-xs text-muted">{avgRating.toFixed(1)}</span>
            </div>
          )}
          {reviews.length === 0 ? (
            <p className="text-xs text-muted">Sin reseñas todavía</p>
          ) : (
            reviews.map((r) => (
              <div key={r.id} className="rounded-lg border border-edge bg-card p-2.5">
                <div className="flex items-center gap-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={`h-3 w-3 ${i < r.rating ? "fill-ember text-ember" : "text-muted"}`}
                    />
                  ))}
                </div>
                {r.comment && <p className="mt-1 text-xs text-ink">{r.comment}</p>}
              </div>
            ))
          )}
        </div>
      </div>
    </main>
  );
}
