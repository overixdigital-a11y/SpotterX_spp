"use client";

import { useEffect, useState } from "react";
import { useAuthState } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { MapPin, Zap, ChevronRight, Dumbbell, ShoppingBag, Users, GraduationCap, UserRound, Pencil, Store } from "lucide-react";

interface WorkplaceGym {
  gym_id: string;
  name: string | null;
  city: string | null;
}

interface WorkplaceZona {
  id: string;
  name: string | null;
  city: string | null;
}

export default function PerfilPage() {
  const { userId, profile } = useAuthState();
  const [profeUsername, setProfeUsername] = useState<string | null>(null);
  const [profeName, setProfeName] = useState<string | null>(null);
  const [workplaces, setWorkplaces] = useState<{ gyms: WorkplaceGym[]; zonas: WorkplaceZona[] }>({ gyms: [], zonas: [] });

  useEffect(() => {
    if ((profile?.role !== "profesor" && profile?.role !== "admin") || !userId) return;
    let active = true;
    const load = async () => {
      const { data } = await createClient().rpc("get_trainer_workplaces", { p_trainer_id: userId });
      if (active && data) setWorkplaces(data as { gyms: WorkplaceGym[]; zonas: WorkplaceZona[] });
    };
    load();
    return () => {
      active = false;
    };
  }, [profile?.role, userId]);

  useEffect(() => {
    if (profile?.role !== "alumno" || !userId) return;
    const loadProfe = async () => {
      const { data: ts } = await createClient()
        .from("trainer_students")
        .select("trainer_id")
        .eq("student_id", userId);
      const ids = (ts as { trainer_id: string }[] | null)?.map((t) => t.trainer_id) ?? [];
      if (ids.length === 0) return;
      const { data: ps } = await createClient()
        .from("profiles")
        .select("username, full_name")
        .in("id", ids);
      const profe = (ps as { username: string; full_name: string | null }[] | null)?.[0];
      if (profe) {
        setProfeUsername(profe.username);
        setProfeName(profe.full_name || profe.username);
      }
    };
    loadProfe();
  }, [profile?.role, userId]);

  const initial =
    (profile?.full_name || profile?.username || "U").slice(0, 2).toUpperCase();

  return (
    <div className="w-full">
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

      {profile?.role === "alumno" && (
        <Link
          href="/mi-entrenamiento"
          className="mx-4 mt-4 flex items-center justify-between rounded-2xl border border-neon/30 bg-neon/10 p-3.5"
        >
          <p className="flex items-center gap-2 text-sm font-semibold text-ink">
            <span className="rounded-full bg-neon/20 p-1.5 text-neon">
              <GraduationCap className="h-4 w-4" />
            </span>
            Ver a mi profesor
          </p>
          <ChevronRight className="h-4 w-4 text-neon" />
        </Link>
      )}

      {profile?.role === "alumno" && profeUsername && (
        <Link
          href={`/perfil/${profeUsername}`}
          className="mx-4 mt-2 flex items-center gap-1.5 pl-3.5 text-xs text-muted transition hover:text-neon"
        >
          <UserRound className="h-3.5 w-3.5" />
          Ver perfil de {profeName ?? profeUsername}
        </Link>
      )}

      {(profile?.role === "profesor" || profile?.role === "admin") && (
        <Link
          href="/entrenamiento"
          className="mx-4 mt-4 flex items-center justify-between rounded-xl border border-neon/30 bg-neon/10 p-3.5"
        >
          <p className="flex items-center gap-2 text-sm font-semibold text-ink">
            <span className="rounded-full bg-neon/20 p-1.5 text-neon">
              <Users className="h-4 w-4" />
            </span>
            Mis alumnos
          </p>
          <ChevronRight className="h-4 w-4 text-neon" />
        </Link>
      )}

      {(profile?.role === "profesor" || profile?.role === "admin") && (
        <Link
          href="/perfil/editar"
          className="mx-4 mt-4 flex items-center justify-between rounded-xl border border-ember/30 bg-ember/10 p-3.5"
        >
          <p className="flex items-center gap-2 text-sm font-semibold text-ember">
            <span className="rounded-full bg-ember/20 p-1.5">
              <Dumbbell className="h-4 w-4" />
            </span>
            Perfil de profesor
          </p>
          <ChevronRight className="h-4 w-4 text-ember" />
        </Link>
      )}

      {(profile?.role === "profesor" || profile?.role === "admin") && (
        <div className="mx-4 mt-5">
          <Link
            href="/entrenamiento/zona"
            className="flex items-center justify-between rounded-xl border border-ember/30 bg-ember/10 p-3.5"
          >
            <p className="flex items-center gap-2 text-sm font-semibold text-ember">
              <span className="rounded-full bg-ember/20 p-1.5">
                <MapPin className="h-4 w-4" />
              </span>
              Mis lugares de trabajo
            </p>
            <ChevronRight className="h-4 w-4 text-ember" />
          </Link>

          <p className="mt-4 px-1 text-xs font-semibold uppercase tracking-wide text-muted">
            Lugares donde trabajo
          </p>
          <div className="mt-2 divide-y divide-edge rounded-xl border border-edge bg-card">
            {workplaces.gyms.map((g) => (
              <Link
                key={`gym-${g.gym_id}`}
                href="/entrenamiento/zona"
                className="flex items-center gap-3 p-3"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neon/20 text-neon">
                  <Store className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">{g.name || "Gimnasio"}</p>
                  <p className="truncate text-xs text-muted">{g.city || "—"}</p>
                </div>
                <Pencil className="h-3.5 w-3.5 text-ember" />
              </Link>
            ))}
            {workplaces.zonas.map((z) => (
              <Link
                key={`zona-${z.id}`}
                href="/entrenamiento/zona"
                className="flex items-center gap-3 p-3"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ember/20 text-ember">
                  <MapPin className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">{z.name || "Mi zona"}</p>
                  <p className="truncate text-xs text-muted">{z.city || "—"}</p>
                </div>
                <Pencil className="h-3.5 w-3.5 text-ember" />
              </Link>
            ))}
            {workplaces.gyms.length === 0 && workplaces.zonas.length === 0 && (
              <Link
                href="/entrenamiento/zona"
                className="flex items-center justify-between p-3"
              >
                <p className="text-sm text-muted">Todavía no cargaste lugares. Agregá tu primer lugar →</p>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted" />
              </Link>
            )}
          </div>

          <Link
            href={`/perfil/${profile?.username}`}
            className="mt-3 ml-1 inline-flex items-center gap-1.5 text-xs text-muted transition hover:text-neon"
          >
            <UserRound className="h-3.5 w-3.5" />
            Ver mi perfil público
          </Link>
        </div>
      )}

      <Link
        href="/market"
        className="mx-4 mt-4 flex items-center justify-between rounded-xl border border-neon/30 bg-neon/10 p-3.5"
      >
        <p className="flex items-center gap-2 text-sm font-semibold text-ink">
          <span className="rounded-full bg-neon/20 p-1.5 text-neon">
            <ShoppingBag className="h-4 w-4" />
          </span>
          Marketplace
        </p>
        <ChevronRight className="h-4 w-4 text-neon" />
      </Link>

      <div className="mt-5 grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 divide-x divide-edge border-b border-t border-edge text-center">
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

      <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-1 p-1">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="aspect-square rounded-lg bg-card">
            <Zap className="h-full w-full p-4 text-muted/40" />
          </div>
        ))}
      </div>
    </div>
  );
}
