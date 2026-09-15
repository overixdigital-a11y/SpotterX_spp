"use client";

import { useEffect, useState } from "react";
import { Loader2, Activity, Users, DoorOpen, DoorClosed } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuthState } from "@/lib/auth-context";

interface Gym {
  id: string;
  name: string | null;
  capacity: number | null;
}

interface ProfileRef {
  full_name: string | null;
  username: string | null;
}

interface Log {
  id: string;
  type: string;
  created_at: string;
  profiles: ProfileRef[] | null;
}

export default function GymAccessPage() {
  const { userId } = useAuthState();
  const [gym, setGym] = useState<Gym | null>(null);
  const [logs, setLogs] = useState<Log[]>([]);
  const [presence, setPresence] = useState<number>(0);
  const [attendanceToday, setAttendanceToday] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!userId) return;
      const supabase = createClient();
      const { data: g } = await supabase
        .from("gyms")
        .select("id, name, capacity")
        .eq("owner_id", userId)
        .maybeSingle();
      if (!active || !g) {
        if (active) setLoading(false);
        return;
      }
      setGym(g as Gym);

      const [logRes, presRes, attendanceRes] = await Promise.all([
        supabase
          .from("gym_access_logs")
          .select("id, type, created_at, profiles:gym_access_logs_user_id_fkey(full_name, username)")
          .eq("gym_id", g.id)
          .order("created_at", { ascending: false })
          .limit(40),
        supabase
          .from("gym_presence")
          .select("user_id")
          .eq("gym_id", g.id),
        supabase.rpc("gym_attendance_today", { p_gym: g.id }),
      ]);

      if (active) {
        setLogs((logRes.data ?? []) as Log[]);
        setPresence((presRes.data ?? []).length);
        setAttendanceToday(typeof attendanceRes.data === "number" ? attendanceRes.data : 0);
      }
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

  if (!gym) {
    return (
      <main className="mx-auto max-w-md px-4 pt-10 text-center">
        <p className="text-sm text-muted">Primero creá tu gimnasio desde el panel.</p>
      </main>
    );
  }

  const capacity = gym.capacity ?? null;

  return (
    <main className="mx-auto max-w-5xl px-4 pt-2 md:pt-4">
      <div className="border-b border-edge/60 pb-4">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-ink">
          <Activity className="h-6 w-6 text-neon" /> Control de Accesos y Aforo
        </h1>
        <p className="mt-0.5 text-sm text-muted">
          Monitoreá las entradas, salidas y presencia de miembros en tiempo real.
        </p>
      </div>

      {/* KPI Cards Grid */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-2xl border border-edge bg-card p-5 space-y-1">
          <p className="flex items-center gap-2 text-xs font-bold text-muted uppercase tracking-wider">
            <Users className="h-4 w-4 text-neon" /> Ocupación Actual
          </p>
          <p className="text-3xl font-black text-ink">
            {presence}
            {capacity != null && <span className="text-base font-normal text-muted"> / {capacity} aforo</span>}
          </p>
        </div>

        <div className="rounded-2xl border border-edge bg-card p-5 space-y-1">
          <p className="flex items-center gap-2 text-xs font-bold text-muted uppercase tracking-wider">
            <Activity className="h-4 w-4 text-ember" /> Asistencia Hoy
          </p>
          <p className="text-3xl font-black text-neon">{attendanceToday} <span className="text-xs font-normal text-muted">check-ins</span></p>
        </div>

        <div className="rounded-2xl border border-edge bg-card p-5 space-y-1 sm:col-span-2 lg:col-span-1">
          <p className="text-xs font-bold text-muted uppercase tracking-wider">Estado de Capacidad</p>
          <p className="text-lg font-bold text-ink">
            {capacity ? (
              presence >= capacity ? (
                <span className="text-ember">🔴 Aforo completo ({Math.round((presence / capacity) * 100)}%)</span>
              ) : (
                <span className="text-neon">🟢 {capacity - presence} lugares disponibles</span>
              )
            ) : (
              <span className="text-neon">🟢 Aforo ilimitado</span>
            )}
          </p>
        </div>
      </div>

      {/* Historial de Accesos */}
      <div className="mt-6 space-y-4 rounded-2xl border border-edge bg-card p-5">
        <div className="flex items-center justify-between">
          <p className="text-base font-bold text-ink">Registro de Accesos Recientes</p>
          <span className="text-xs font-semibold text-neon">Últimos {logs.length} registros</span>
        </div>

        {logs.length === 0 ? (
          <p className="py-12 text-center text-xs text-muted">Todavía no hay accesos registrados el día de hoy.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[600px] overflow-y-auto pr-1">
            {logs.map((l) => (
              <div
                key={l.id}
                className="flex items-center justify-between rounded-xl border border-edge bg-bg p-3.5 transition hover:border-neon/30"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className={`rounded-xl p-2 ${
                      l.type === "ingreso" ? "bg-neon/20 text-neon border border-neon/30" : "bg-ember/20 text-ember border border-ember/30"
                    }`}
                  >
                    {l.type === "ingreso" ? (
                      <DoorOpen className="h-4 w-4" />
                    ) : (
                      <DoorClosed className="h-4 w-4" />
                    )}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink">
                      {l.profiles?.[0]?.full_name ?? l.profiles?.[0]?.username ?? "Usuario"}
                    </p>
                    <p className="text-xs font-mono text-muted">
                      {new Date(l.created_at).toLocaleString("es-AR", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                    l.type === "ingreso" ? "bg-neon/20 text-neon border border-neon/30" : "bg-ember/20 text-ember border border-ember/30"
                  }`}
                >
                  {l.type === "ingreso" ? "Entrada" : "Salida"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
