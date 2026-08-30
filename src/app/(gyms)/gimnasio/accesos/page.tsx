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
    <main className="mx-auto max-w-md px-4 pt-5">
      <h1 className="text-xl font-bold text-ink">Accesos</h1>
      <p className="mt-1 text-sm text-muted">Actividad de tu gimnasio.</p>

      <div className="mt-5 grid grid-cols-2 gap-2">
        <div className="rounded-2xl border border-edge bg-card p-4">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-muted">
            <Users className="h-3.5 w-3.5 text-neon" /> Ahora dentro
          </p>
          <p className="mt-1 text-3xl font-extrabold text-ink">
            {presence}
            {capacity != null && <span className="text-base font-medium text-muted">/{capacity}</span>}
          </p>
        </div>
        <div className="rounded-2xl border border-edge bg-card p-4">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-muted">
            <Activity className="h-3.5 w-3.5 text-ember" /> Hoy
          </p>
          <p className="mt-1 text-3xl font-extrabold text-ink">{attendanceToday}</p>
        </div>
      </div>

      <div className="mt-6">
        <p className="text-sm font-semibold text-ink">Historial</p>
        {logs.length === 0 ? (
          <p className="mt-2 text-xs text-muted">Todavía no hay accesos registrados.</p>
        ) : (
          <div className="mt-3 space-y-1.5">
            {logs.map((l) => (
              <div
                key={l.id}
                className="flex items-center justify-between rounded-xl border border-edge bg-card p-2.5"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className={`rounded-full p-1.5 ${
                      l.type === "ingreso" ? "bg-neon/20 text-neon" : "bg-ember/20 text-ember"
                    }`}
                  >
                    {l.type === "ingreso" ? (
                      <DoorOpen className="h-3.5 w-3.5" />
                    ) : (
                      <DoorClosed className="h-3.5 w-3.5" />
                    )}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">
                      {l.profiles?.[0]?.full_name ?? l.profiles?.[0]?.username ?? "Usuario"}
                    </p>
                    <p className="text-[11px] text-muted">
                      {new Date(l.created_at).toLocaleString("es-AR", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    l.type === "ingreso" ? "bg-neon/20 text-neon" : "bg-ember/20 text-ember"
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
