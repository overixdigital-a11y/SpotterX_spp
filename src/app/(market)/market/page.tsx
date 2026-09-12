"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Search, ShoppingCart, Store, Shield } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuthState } from "@/lib/auth-context";
import { MARKET_CATEGORIES, type MarketProduct } from "@/lib/market";
import ProductCard from "@/components/market/ProductCard";

export default function MarketPage() {
  const { profile } = useAuthState();
  const [products, setProducts] = useState<MarketProduct[]>([]);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const PAGE = 20;

  const load = useCallback(
    async () => {
      setLoading(true);
      const supabase = createClient();
      let q = supabase
        .from("market_products")
        .select("*")
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .range(0, PAGE - 1);

      if (search.trim()) {
        q = q.ilike("name", `%${search.trim()}%`);
      }
      if (activeCategory) {
        q = q.eq("category", activeCategory);
      }
      const { data } = await q;
      if (data) {
        setProducts(data as MarketProduct[]);
        setHasMore(data.length === PAGE);
      }
      setLoading(false);
    },
    [search, activeCategory]
  );

  useEffect(() => {
    const run = async () => { await load(); };
    void run();
  }, [load]);

  const loadMore = async () => {
    const supabase = createClient();
    let q = supabase
      .from("market_products")
      .select("*")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .range(products.length, products.length + PAGE - 1);
    if (search.trim()) q = q.ilike("name", `%${search.trim()}%`);
    if (activeCategory) q = q.eq("category", activeCategory);
    const { data } = await q;
    if (data) {
      setProducts((prev) => [...prev, ...(data as MarketProduct[])]);
      setHasMore(data.length === PAGE);
    }
  };

  return (
    <main className="mx-auto max-w-md pb-24">
      <div className="sticky top-0 z-30 border-b border-edge bg-bg/90 backdrop-blur">
        <div className="flex items-center gap-3 px-4 py-3">
          <Store className="h-5 w-5 text-ember" />
          <h1 className="text-lg font-bold text-ink">Marketplace</h1>
          <div className="ml-auto flex items-center gap-2">
            {profile?.is_admin && (
              <Link href="/market/admin" className="text-xs font-semibold text-ember">
                <Shield className="inline h-4 w-4" /> Admin
              </Link>
            )}
            <Link href="/market/mis-publicaciones" className="text-xs font-semibold text-neon">
              Mis ventas
            </Link>
            <Link href="/market/carrito" className="relative text-muted">
              <ShoppingCart className="h-5 w-5" />
            </Link>
          </div>
        </div>

        <div className="px-4 pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar productos..."
              className="w-full rounded-xl border border-edge bg-bg py-2 pl-9 pr-3 text-sm text-ink placeholder:text-muted focus:border-neon focus:outline-none"
            />
          </div>
        </div>

        <div className="flex gap-1.5 overflow-x-auto px-4 pb-3 no-scrollbar">
          <button
            onClick={() => setActiveCategory(null)}
            className={`shrink-0 rounded-full border px-3 py-1 text-[11px] font-semibold transition ${
              activeCategory === null
                ? "border-neon bg-neon/15 text-neon"
                : "border-edge bg-card text-muted"
            }`}
          >
            Todos
          </button>
          {MARKET_CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setActiveCategory(c === activeCategory ? null : c)}
              className={`shrink-0 rounded-full border px-3 py-1 text-[11px] font-semibold transition ${
                activeCategory === c
                  ? "border-neon bg-neon/15 text-neon"
                  : "border-edge bg-card text-muted"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4">
        {loading ? (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="animate-pulse rounded-xl border border-edge bg-card">
                <div className="aspect-square bg-bg" />
                <div className="space-y-2 p-2.5">
                  <div className="h-3 w-3/4 rounded bg-bg" />
                  <div className="h-3 w-1/2 rounded bg-bg" />
                </div>
              </div>
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="py-20 text-center">
            <Store className="mx-auto mb-3 h-10 w-10 text-muted" />
            <p className="text-sm text-muted">No hay productos todavía</p>
            <Link href="/market/crear" className="mt-3 inline-block text-sm font-semibold text-neon">
              Publicá el primero
            </Link>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              {products.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
            {hasMore && (
              <button
                onClick={loadMore}
                className="mt-4 w-full rounded-xl border border-edge bg-card py-2.5 text-sm font-semibold text-muted"
              >
                Cargar más
              </button>
            )}
          </>
        )}
      </div>
    </main>
  );
}
