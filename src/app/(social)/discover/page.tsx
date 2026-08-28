"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

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

interface Result {
  id: string;
  username: string;
  full_name: string | null;
  role: string;
}

export default function DiscoverPage() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    if (!q.trim()) return;
    const supabase = createClient();
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, username, full_name, role")
        .or(`username.ilike.%${q}%,full_name.ilike.%${q}%`)
        .limit(12);
      setResults((data as Result[]) ?? []);
      setSearched(true);
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <main className="mx-auto max-w-md px-4 pt-4">
      <div className="flex items-center gap-2 rounded-xl border border-edge bg-card px-3 py-2.5">
        <Search className="h-4 w-4 text-muted" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar usuarios, contenido, gimnasios…"
          className="w-full bg-transparent text-sm text-ink placeholder:text-muted focus:outline-none"
        />
      </div>

      {q.trim() ? (
        <div className="mt-4">
          {results.length === 0 && searched ? (
            <p className="py-8 text-center text-sm text-muted">
              Sin resultados para “{q}”
            </p>
          ) : (
            results.map((r) => (
              <Link
                key={r.id}
                href={`/perfil/${r.username}`}
                className="flex items-center gap-3 border-b border-edge py-3"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-neon/20 text-sm font-bold text-neon">
                  {(r.full_name || r.username).slice(0, 2).toUpperCase()}
                </div>
                <div className="leading-tight">
                  <p className="text-sm font-semibold text-ink">
                    {r.full_name || r.username}
                  </p>
                  <p className="text-xs text-muted">
                    @{r.username} · {r.role}
                  </p>
                </div>
              </Link>
            ))
          )}
        </div>
      ) : (
        <>
          <p className="mt-6 text-xs font-semibold uppercase tracking-wider text-muted">
            Categorías
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setQ(c)}
                className="rounded-full border border-edge bg-card px-3.5 py-1.5 text-sm font-medium text-neon transition hover:border-neon"
              >
                {c}
              </button>
            ))}
          </div>
          <p className="mt-8 text-center text-xs text-muted">
            Buscá gente por nombre o usuario 🔍
          </p>
        </>
      )}
    </main>
  );
}
