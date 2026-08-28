import { TopBar } from "@/components/core/TopBar";
import { BottomNav } from "@/components/core/BottomNav";
import { MapPin, Zap } from "lucide-react";

export default function PerfilPage() {
  return (
    <>
      <TopBar />
      <main className="mx-auto max-w-md">
        <div className="flex items-center gap-4 px-4 pt-4">
          <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-neon bg-neon/20 text-xl font-bold text-neon shadow-neon">
            AN
          </div>
          <div>
            <h1 className="text-xl font-bold text-ink">Ariel Neón</h1>
            <p className="text-sm text-muted">@ariel.fit</p>
            <p className="mt-1 flex items-center gap-1 text-xs text-neon">
              <MapPin className="h-3.5 w-3.5" /> Córdoba, AR
            </p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-3 divide-x divide-edge border-b border-t border-edge text-center">
          {[
            ["12", "Posts"],
            ["1.2k", "Seguidores"],
            ["890", "Siguiendo"],
          ].map(([n, l]) => (
            <div key={l} className="py-3">
              <p className="text-lg font-bold text-ink">{n}</p>
              <p className="text-xs text-muted">{l}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-1 p-1">
          {Array.from({ length: 9 }).map((_, i) => (
            <div
              key={i}
              className="aspect-square rounded-lg bg-card"
            >
              <Zap className="h-full w-full p-4 text-muted/40" />
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </>
  );
}
