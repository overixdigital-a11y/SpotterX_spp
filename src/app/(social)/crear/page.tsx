import { TopBar } from "@/components/core/TopBar";
import { BottomNav } from "@/components/core/BottomNav";
import { Camera, Film, Type } from "lucide-react";

export default function CrearPage() {
  return (
    <>
      <TopBar />
      <main className="mx-auto max-w-md px-4 pt-4">
        <div className="rounded-2xl border border-dashed border-edge bg-card p-8 text-center">
          <Camera className="mx-auto h-12 w-12 text-neon" />
          <p className="mt-3 text-sm text-muted">
            Subí un video o foto para compartir tu progreso
          </p>
          <button className="mt-4 w-full rounded-xl bg-neon px-4 py-3 font-semibold text-bg shadow-neon">
            Seleccionar video
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <button className="flex items-center justify-center gap-2 rounded-xl border border-edge bg-card py-4 text-sm font-medium text-ink">
            <Film className="h-4 w-4 text-ember" /> Reels
          </button>
          <button className="flex items-center justify-center gap-2 rounded-xl border border-edge bg-card py-4 text-sm font-medium text-ink">
            <Type className="h-4 w-4 text-neon" /> Texto
          </button>
        </div>
      </main>
      <BottomNav />
    </>
  );
}
