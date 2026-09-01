"use client";

import { useAuthState } from "@/lib/auth-context";
import Link from "next/link";
import { MapPin, Zap, ChevronRight, Dumbbell } from "lucide-react";

export default function PerfilPage() {
  const { profile } = useAuthState();

  const initial =
    (profile?.full_name || profile?.username || "U").slice(0, 2).toUpperCase();

  return (
    <main className="mx-auto max-w-md">
      <div className="flex items-center gap-4 px-4 pt-4">
        <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-neon bg-neon/20 text-xl font-bold text-neon shadow-neon">
          {initial}
        </div>
        <div>
          <h1 className="text-xl font-bold text-ink">
            {profile?.full_name || profile?.username}
          </h1>
          <p className="text-sm text-muted">@{profile?.username}</p>
          {profile?.location && (
            <p className="mt-1 flex items-center gap-1 text-xs text-neon">
              <MapPin className="h-3.5 w-3.5" /> {profile?.location}
            </p>
          )}
        </div>
      </div>

      {profile?.role === "alumno" && (
        <Link
          href="/mi-gimnasio"
          className="mx-4 mt-4 flex items-center justify-between rounded-2xl border border-neon/30 bg-neon/10 p-3.5"
        >
          <p className="flex items-center gap-2 text-sm font-semibold text-ink">
            <span className="rounded-full bg-neon/20 p-1.5 text-neon">
              <Dumbbell className="h-4 w-4" />
            </span>
            Mi gimnasio
          </p>
          <ChevronRight className="h-4 w-4 text-neon" />
        </Link>
      )}

      {profile?.role === "profesor" && (
        <div className="mx-4 mt-4 rounded-xl border border-ember/30 bg-ember/10 p-3 text-center">
          <p className="text-sm font-semibold text-ember">Profesor</p>
          <p className="text-xs text-muted">
            Gimnasios donde trabajo y zona (próximamente)
          </p>
        </div>
      )}

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
          <div key={i} className="aspect-square rounded-lg bg-card">
            <Zap className="h-full w-full p-4 text-muted/40" />
          </div>
        ))}
      </div>
    </main>
  );
}
