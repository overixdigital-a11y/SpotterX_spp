import { TopBar } from "@/components/core/TopBar";
import { BottomNav } from "@/components/core/BottomNav";
import { Search } from "lucide-react";

const categories = [
  "#CrossFit",
  "#Running",
  "#Powerlifting",
  "#Calistenia",
  "#Yoga",
  "#Boxeo",
  "#Nutrición",
  "#Cardio",
];

export default function DiscoverPage() {
  return (
    <>
      <TopBar />
      <main className="mx-auto max-w-md px-4 pt-4">
        <div className="flex items-center gap-2 rounded-xl border border-edge bg-card px-3 py-2.5">
          <Search className="h-4 w-4 text-muted" />
          <input
            placeholder="Buscar usuarios, contenido, gimnasios…"
            className="w-full bg-transparent text-sm text-ink placeholder:text-muted focus:outline-none"
          />
        </div>

        <p className="mt-6 text-xs font-semibold uppercase tracking-wider text-muted">
          Categorías
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {categories.map((c) => (
            <button
              key={c}
              className="rounded-full border border-edge bg-card px-3.5 py-1.5 text-sm font-medium text-neon transition hover:border-neon"
            >
              {c}
            </button>
          ))}
        </div>
      </main>
      <BottomNav />
    </>
  );
}
