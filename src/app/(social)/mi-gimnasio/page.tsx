"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Dumbbell, Loader2, MapPin, QrCode, X, Ban, CheckCircle2, Gift, Clock3, Megaphone, Tag, ShoppingBag } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuthState } from "@/lib/auth-context";
import { formatPrice } from "@/lib/market";
import { getGymModules } from "@/lib/gym-modules";

const Scanner = dynamic(() => import("@yudiel/react-qr-scanner").then((m) => m.Scanner), {
  ssr: false,
});

interface Gym {
  id: string;
  name: string | null;
  address: string | null;
  city: string | null;
  owner_id: string | null;
}

interface Membership {
  id: string;
  plan_name: string | null;
  status: string | null;
  pay_status: string | null;
  expires_on: string | null;
  price: number | null;
  gym_id: string;
  gyms: Gym[] | null;
}

interface Announcement {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  image_url: string | null;
  product_id: string | null;
  created_at: string;
}

interface PlanPromo {
  name: string;
  price: number;
  duration_months: number;
  promo_type: string;
}

interface ShopProduct {
  id: string;
  name: string;
  price: number;
  images: string[];
}

const PROMO_LABEL: Record<string, string> = { "2x1": "2x1", "3x2": "3x2", "4x3": "4x3" };

export default function MiGimnasioPage() {
  const { userId } = useAuthState();
  const router = useRouter();
  const [membership, setMembership] = useState<Membership | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [promos, setPromos] = useState<PlanPromo[]>([]);
  const [shopProducts, setShopProducts] = useState<ShopProduct[]>([]);
  const [shopOn, setShopOn] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!userId) {
        if (active) setLoading(false);
        return;
      }
      const supabase = createClient();
      const { data } = await supabase
        .from("gym_memberships")
        .select("id, plan_name, status, pay_status, expires_on, price, gym_id, gyms:gyms!gym_memberships_gym_id_fkey(id, name, address, city, owner_id)")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (active) setMembership((data as Membership) ?? null);

      const gymId = (data as Membership | null)?.gym_id;
      if (active && gymId) {
        const [{ data: posts }, { data: planPromos }, modules] = await Promise.all([
          supabase
            .from("gym_announcements")
            .select("*")
            .eq("gym_id", gymId)
            .order("created_at", { ascending: false })
            .limit(10),
          supabase
            .from("gym_plans")
            .select("name, price, duration_months, promo_type")
            .eq("gym_id", gymId)
            .not("promo_type", "is", null)
            .order("created_at", { ascending: false }),
          getGymModules(gymId),
        ]);
        if (active && posts) setAnnouncements((posts as Announcement[]) ?? []);
        if (active && planPromos) setPromos((planPromos as PlanPromo[]) ?? []);
        if (active) setShopOn(modules.spotter_shop);

        const ownerId = (data as Membership | null)?.gyms?.[0]?.owner_id;
        if (active && modules.spotter_shop && ownerId) {
          const { data: products } = await supabase
            .from("market_products")
            .select("id, name, price, images")
            .eq("seller_id", ownerId)
            .eq("status", "active")
            .order("created_at", { ascending: false })
            .limit(12);
          if (active) setShopProducts((products ?? []) as ShopProduct[]);
        }
      }

      if (active) setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [userId]);

  const onScan = useCallback(
    (codes: { rawValue?: string }[]) => {
      const raw = codes?.[0]?.rawValue ?? "";
      const match = raw.match(/\/checkin\/([A-Za-z0-9_-]+)/i) ?? raw.match(/^([A-Za-z0-9_-]{4,})$/);
      if (!match) {
        setScanError("Este QR no es de un gimnasio SpotterX.");
        setTimeout(() => setScanError(null), 2500);
        return;
      }
      router.push(`/checkin/${match[1]}`);
    },
    [router]
  );

  const status = useMemo(() => {
    if (!membership) return null;
    if (membership.status !== "activa") return { tone: "muted", label: "Membresía inactiva", icon: Ban };

    const expires = membership.expires_on ? new Date(membership.expires_on) : null;
    const today = new Date(new Date().toDateString());
    const expired = expires ? expires < today : false;
    const price = membership.price != null ? ` · $${Number(membership.price).toLocaleString("es-AR")}` : "";

    if (expired) {
      return {
        tone: "ember",
        label: `Cuota vencida · debés la cuota${price}`,
        icon: Ban,
      };
    }
    if (membership.pay_status === "pendiente") {
      return { tone: "ember", label: `Debés la cuota${price}`, icon: Clock3 };
    }
    if (membership.pay_status === "promo") {
      return { tone: "ember", label: `Promo de bienvenida · ${expires ? `vence ${membership.expires_on}` : "1º mes"}`, icon: Gift };
    }
    return {
      tone: "neon",
      label: `Cuota al día${expires ? ` · vence ${membership.expires_on}` : ""}`,
      icon: CheckCircle2,
    };
  }, [membership]);

  if (loading) {
    return (
      <main className="flex justify-center pt-20">
        <Loader2 className="h-6 w-6 animate-spin text-neon" />
      </main>
    );
  }

  return (
    <div className="w-full">
      <h1 className="flex items-center gap-1.5 text-xl font-bold text-ink">
        <Dumbbell className="h-5 w-5 text-neon" /> Mi gimnasio
      </h1>

      {!membership ? (
        <div className="mt-6 rounded-2xl border border-edge bg-card p-6 text-center">
          <Ban className="mx-auto h-8 w-8 text-muted/50" />
          <p className="mt-3 text-sm font-semibold text-ink">Todavía no sos miembro de ningún gimnasio</p>
          <p className="mt-1 text-xs text-muted">
            Cuando un gimnasio te dé de alta, vas a ver tu membresía y tu cuota acá.
          </p>
        </div>
      ) : (
        <>
          {/* Card membresía (pasaporte digital) */}
          <div className="mt-5 rounded-2xl border border-neon/40 bg-card p-5 shadow-neon">
            <p className="text-[10px] font-bold uppercase tracking-widest text-neon">Membresía activa</p>
            <h2 className="mt-1 text-2xl font-extrabold text-ink">
              {membership.gyms?.[0]?.name ?? "Gimnasio"}
            </h2>
            {membership.gyms?.[0]?.address && (
              <p className="mt-1 flex items-center gap-1 text-xs text-muted">
                <MapPin className="h-3.5 w-3.5" /> {membership.gyms[0].address}
                {membership.gyms[0].city ? `, ${membership.gyms[0].city}` : ""}
              </p>
            )}
            <div className="mt-4 space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted">Plan</span>
                <span className="font-semibold text-ink">{membership.plan_name ?? "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Precio</span>
                <span className="font-semibold text-ink">
                  {membership.price != null
                    ? `$${Number(membership.price).toLocaleString("es-AR")}`
                    : "—"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Vencimiento</span>
                <span className="font-semibold text-ink">{membership.expires_on ?? "—"}</span>
              </div>
            </div>
            {status && (
              <div
                className={`mt-4 flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold ${
                  status.tone === "neon"
                    ? "bg-neon/15 text-neon"
                    : status.tone === "muted"
                    ? "bg-muted/10 text-muted"
                    : "bg-ember/15 text-ember"
                }`}
              >
                <status.icon className="h-4 w-4" /> {status.label}
              </div>
            )}
          </div>

          {/* Dar el presente */}
          <div className="mt-5 rounded-2xl border border-edge bg-card p-4">
            <p className="text-sm font-semibold text-ink">Dar el presente</p>
            <p className="mt-1 text-xs text-muted">
              Escaneá el QR del gimnasio (en la pantalla de la entrada o el cartel) para registrar tu ingreso
              al gimnasio.
            </p>
            {scanning ? (
              <div className="relative mt-3 overflow-hidden rounded-xl">
                <Scanner onScan={onScan} onError={() => setScanError("No se pudo acceder a la cámara.")} />
                <button
                  onClick={() => setScanning(false)}
                  className="absolute right-2 top-2 rounded-full border border-edge bg-card/90 p-1.5 text-muted"
                  aria-label="Cerrar escáner"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setScanning(true)}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-neon py-3 font-semibold text-bg shadow-neon"
              >
                <QrCode className="h-4 w-4" /> Escanear QR para dar el presente
              </button>
            )}
            {scanError && <p className="mt-2 text-center text-xs font-medium text-ember">{scanError}</p>}
          </div>

          {(announcements.length > 0 || promos.length > 0) && (
            <div className="mt-5 rounded-2xl border border-edge bg-card p-4">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                <Megaphone className="h-4 w-4 text-neon" /> Comunicados y promos
              </p>
              <div className="mt-3 space-y-2">
                {promos.map((p, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between rounded-xl border border-ember/30 bg-ember/5 px-3 py-2"
                  >
                    <div className="flex items-center gap-2">
                      <Tag className="h-3.5 w-3.5 text-ember" />
                      <span className="text-xs font-bold uppercase text-ember">
                        {PROMO_LABEL[p.promo_type] ?? p.promo_type}
                      </span>
                      <span className="text-xs font-medium text-ink">{p.name}</span>
                    </div>
                    <span className="text-[10px] text-muted">
                      ${Number(p.price).toLocaleString("es-AR")} · {p.duration_months} mes
                      {p.duration_months > 1 ? "es" : ""}
                    </span>
                  </div>
                ))}
                {announcements.map((a) => {
                  const isPromo = a.kind === "promo";
                  const product = shopProducts.find((sp) => sp.id === a.product_id);
                  return (
                    <div key={a.id} className="rounded-xl border border-edge px-3 py-2.5">
                      {a.image_url && (
                        <img
                          src={a.image_url}
                          alt=""
                          className="mb-2 h-32 w-full rounded-xl border border-edge object-cover"
                          loading="lazy"
                          decoding="async"
                        />
                      )}
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                            isPromo ? "bg-ember/15 text-ember" : "bg-neon/15 text-neon"
                          }`}
                        >
                          {isPromo ? <Tag className="h-3 w-3" /> : <Megaphone className="h-3 w-3" />}
                          {isPromo ? "Promo" : "Comunicado"}
                        </span>
                        <span className="text-xs font-bold text-ink">{a.title}</span>
                      </div>
                      {a.body && <p className="mt-1 text-xs text-muted whitespace-pre-line">{a.body}</p>}
                      {a.product_id && (
                        <Link
                          href={`/market/${a.product_id}`}
                          className="mt-2 flex items-center justify-between rounded-lg border border-neon/30 bg-neon/5 px-2.5 py-1.5 transition hover:bg-neon/10"
                        >
                          <span className="text-[10px] font-semibold text-neon">
                            {product
                              ? `${product.name} · ${formatPrice(product.price)}`
                              : "Ver en SpotterShop"}
                          </span>
                          <span className="text-[10px] font-bold text-neon">Ver</span>
                        </Link>
                      )}
                      <p className="mt-1.5 text-[10px] text-muted">
                        {new Date(a.created_at).toLocaleDateString("es-AR", {
                          day: "2-digit",
                          month: "short",
                        })}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {shopOn && (
            <div className="mt-5 rounded-2xl border border-edge bg-card p-4">
              <div className="flex items-center justify-between">
                <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                  <ShoppingBag className="h-4 w-4 text-neon" /> SpotterShop del gym
                </p>
                <Link
                  href="/market"
                  className="text-[10px] font-semibold text-neon transition hover:text-glow"
                >
                  Ver tienda
                </Link>
              </div>
              {shopProducts.length === 0 ? (
                <p className="mt-3 rounded-xl border border-dashed border-edge bg-bg px-3 py-4 text-center text-xs text-muted">
                  Tu gimnasio todavía no tiene artículos a la venta.
                </p>
              ) : (
                <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {shopProducts.slice(0, 8).map((p) => (
                    <Link
                      key={p.id}
                      href={`/market/${p.id}`}
                      className="overflow-hidden rounded-xl border border-edge bg-elevated transition hover:border-neon/40"
                    >
                      {p.images[0] ? (
                        <div className="aspect-square w-full bg-bg">
                          <img
                            src={p.images[0]}
                            alt=""
                            className="h-full w-full object-cover"
                            loading="lazy"
                            decoding="async"
                          />
                        </div>
                      ) : (
                        <div className="flex aspect-square w-full items-center justify-center bg-bg text-muted">
                          <ShoppingBag className="h-6 w-6 opacity-40" />
                        </div>
                      )}
                      <div className="px-1.5 py-1.5">
                        <p className="truncate text-[10px] font-medium text-ink">{p.name}</p>
                        <p className="text-[10px] font-bold text-neon">{formatPrice(p.price)}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}