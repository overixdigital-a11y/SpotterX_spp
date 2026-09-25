"use client";

import Link from "next/link";
import { formatPrice, conditionLabel, type MarketProduct } from "@/lib/market";

interface ProductCardProps {
  product: MarketProduct;
}

export default function ProductCard({ product }: ProductCardProps) {
  return (
    <Link href={`/market/${product.id}`} className="block">
      <div className="overflow-hidden rounded-xl border border-edge bg-card transition active:scale-[0.98]">
        {product.images[0] ? (
          <div className="aspect-square w-full bg-bg">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={product.images[0]}
              alt={product.name}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover"
            />
          </div>
        ) : (
          <div className="flex aspect-square w-full items-center justify-center bg-bg text-2xl text-muted">
            📷
          </div>
        )}
        <div className="p-2.5">
          <p className="truncate text-sm font-semibold text-ink">{product.name}</p>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-sm font-bold text-neon">{formatPrice(product.price)}</span>
            <span className="rounded-full bg-bg px-1.5 py-0.5 text-[10px] text-muted">
              {conditionLabel(product.condition)}
            </span>
          </div>
          <p className="mt-1 truncate text-[11px] text-muted">{product.category}</p>
        </div>
      </div>
    </Link>
  );
}
