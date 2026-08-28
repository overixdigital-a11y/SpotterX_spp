import { TopBar } from "@/components/core/TopBar";
import { Building2, Users, QrCode, Wallet } from "lucide-react";
import Link from "next/link";

export default function GymsPanel() {
  return (
    <>
      <TopBar />
      <main className="mx-auto max-w-md px-4 pt-6">
        <h1 className="text-2xl font-bold text-ink">Control de Acceso</h1>
        <p className="text-sm text-muted">
          Este módulo llega en la Fase 4. Acá el gym controla ingresos, members
          y cobro de cuotas.
        </p>

        <div className="mt-6 grid grid-cols-2 gap-3">
          {[
            { icon: QrCode, label: "Check-in QR", tone: "text-neon" },
            { icon: Users, label: "Miembros", tone: "text-neon" },
            { icon: Building2, label: "Mi gimnasio", tone: "text-ember" },
            { icon: Wallet, label: "Cobro de cuota", tone: "text-ember" },
          ].map((c) => {
            const Icon = c.icon;
            return (
              <Link
                key={c.label}
                href="#"
                className="flex flex-col items-center gap-2 rounded-2xl border border-edge bg-card py-6 text-center"
              >
                <Icon className={`h-7 w-7 ${c.tone}`} />
                <span className="px-2 text-sm font-medium text-ink">
                  {c.label}
                </span>
              </Link>
            );
          })}
        </div>
      </main>
    </>
  );
}
