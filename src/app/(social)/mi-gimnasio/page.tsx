"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { Dumbbell, Loader2, MapPin, QrCode, X, Ban, CheckCircle2, Gift, Clock3 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuthState } from "@/lib/auth-context";

const Scanner = dynamic(() => import("@yudiel/react-qr-scanner").then((m) => m.Scanner), {
  ssr: false,
});

interface Gym {
  id: string;
  name: string | null;
  address: string | null;
  city: string | null;
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

export default function MiGimnasioPage() {
  const { userId } = useAuthState();
  const router = useRouter();
  const [membership, setMembership] = useState<Membership | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

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
        .select("id, plan_name, status, pay_status, expires_on, price, gym_id, gyms:gyms!gym_memberships_gym_id_fkey(id, name, address, city)")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (active) setMembership((data as Membership) ?? null);
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
        </>
      )}
    </div>
  );
}