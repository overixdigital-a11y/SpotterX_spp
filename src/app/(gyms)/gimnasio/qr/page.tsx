"use client";

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import Link from "next/link";
import { Loader2, Printer, MonitorPlay } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuthState } from "@/lib/auth-context";

interface Gym {
  name: string | null;
  qr_code: string | null;
}

export default function GymQrPage() {
  const { userId } = useAuthState();
  const [gym, setGym] = useState<Gym | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!userId) return;
      const { data } = await createClient()
        .from("gyms")
        .select("name, qr_code")
        .eq("owner_id", userId)
        .maybeSingle();
      if (active && data) setGym(data as Gym);
      if (active) setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [userId]);

  if (loading) {
    return (
      <main className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-neon" />
      </main>
    );
  }

  if (!gym?.qr_code) {
    return (
      <main className="mx-auto max-w-md px-4 pt-10 text-center">
        <p className="text-sm text-muted">Creá tu gimnasio para generar el QR.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-4 pt-2 md:pt-4">
      <div className="border-b border-edge/60 pb-4 text-center md:text-left">
        <h1 className="text-2xl font-bold text-ink">Código QR de Acceso</h1>
        <p className="mt-0.5 text-sm text-muted">
          Pase de ingreso público para tus miembros y recepción. Escanealo para dar el presente o mostrar en pantalla.
        </p>
      </div>

      <div className="mt-6 space-y-6">
        <div id="qr-print" className="rounded-3xl border border-edge bg-card p-8 text-center shadow-2xl backdrop-blur">
          <span className="rounded-full border border-neon/30 bg-neon/10 px-3 py-1 text-xs font-bold text-neon uppercase tracking-wider">
            {gym.name ?? "Gimnasio"}
          </span>
          <p className="mt-3 text-sm text-muted">Escaneá con tu cámara o la app SpotterX para ingresar</p>
          <div className="mx-auto mt-6 w-fit rounded-2xl bg-white p-6 shadow-2xl">
            <QRCodeSVG
              value={`https://spotterx-five.vercel.app/checkin/${gym.qr_code}`}
              size={240}
              fgColor="#05070a"
            />
          </div>
          <p className="mt-4 font-mono text-base font-bold text-neon">{gym.qr_code}</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            onClick={() => window.print()}
            className="flex items-center justify-center gap-2 rounded-xl bg-neon py-3.5 font-bold text-bg shadow-neon transition hover:opacity-90 active:scale-[0.98]"
          >
            <Printer className="h-4 w-4" /> Imprimir Pase QR
          </button>

          <Link
            href="/gimnasio/pantalla"
            target="_blank"
            className="flex items-center justify-center gap-2 rounded-xl border border-neon/40 bg-neon/10 py-3.5 font-semibold text-neon transition hover:bg-neon/20"
          >
            <MonitorPlay className="h-4 w-4" /> Abrir Pantalla Kiosk
          </Link>
        </div>
      </div>
    </main>
  );
}
