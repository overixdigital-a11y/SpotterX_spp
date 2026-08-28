import { TopBar } from "@/components/core/TopBar";
import { Dumbbell, Users, Calendar, CreditCard } from "lucide-react";
import Link from "next/link";

export default function TrainingPanel() {
  return (
    <>
      <TopBar />
      <main className="mx-auto max-w-md px-4 pt-6">
        <h1 className="text-2xl font-bold text-ink">Gestión de Alumnos</h1>
        <p className="text-sm text-muted">
          Este módulo llega en la Fase 3. Acá el profesor gestiona sus alumnos
          del gym y propios.
        </p>

        <div className="mt-6 grid grid-cols-2 gap-3">
          {[
            { icon: Users, label: "Alumnos del gym", tone: "text-neon" },
            { icon: Dumbbell, label: "Alumnos propios", tone: "text-ember" },
            { icon: Calendar, label: "Planes y rutinas", tone: "text-neon" },
            { icon: CreditCard, label: "Monetización", tone: "text-ember" },
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
