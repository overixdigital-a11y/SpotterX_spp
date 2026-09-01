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
    <main className="mx-auto max-w-md px-4 pt-5">
      <h1 className="text-xl font-bold text-ink">QR de tu gimnasio</h1>
      <p className="mt-1 text-sm text-muted">
        Escanealo con el celular o imprimilo para la entrada.
      </p>

      <div id="qr-print" className="mt-5 rounded-2xl border border-edge bg-card p-6 text-center">
        <p className="text-sm font-semibold text-ink">{gym.name ?? "Gimnasio"}</p>
        <p className="mt-0.5 text-xs text-muted">Escaneá para registrarte</p>
        <div className="mx-auto mt-4 w-fit rounded-xl bg-white p-4">
          <QRCodeSVG
            value={`https://spotterx-five.vercel.app/checkin/${gym.qr_code}`}
            size={220}
            fgColor="#05070a"
          />
        </div>
        <p className="mt-3 font-mono text-sm text-neon">{gym.qr_code}</p>
      </div>

      <button
        onClick={() => window.print()}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-neon py-3 font-semibold text-bg shadow-neon"
      >
        <Printer className="h-4 w-4" /> Imprimir QR
      </button>

      <Link
        href="/gimnasio/pantalla"
        className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-neon/40 bg-neon/10 py-3 font-semibold text-neon"
      >
        <MonitorPlay className="h-4 w-4" /> Abrir en pantalla (kiosk)
      </Link>
    </main>
  );
}
