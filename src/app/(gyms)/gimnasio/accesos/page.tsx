"use client";

import { useEffect, useState } from "react";
import { Loader2, Activity, Users, DoorOpen, DoorClosed, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuthState } from "@/lib/auth-context";
import { Avatar } from "@/components/core/Avatar";
import { BottomSheet } from "@/components/core/BottomSheet";
import { useToast } from "@/components/core/ToastProvider";

interface Gym {
  id: string;
  name: string | null;
  capacity: number | null;
}

interface Person {
  user_id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
}

interface Log {
  id: string;
  type: string;
  created_at: string;
  profiles: Person[] | null;
}

interface InsideUser {
  user_id: string;
  last_in: string;
  person: Person | null;
  isStaff: boolean;
}

const nowHHMM = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

export default function GymAccessPage() {
  const { userId } = useAuthState();
  const toast = useToast();
  const [gym, setGym] = useState<Gym | null>(null);
  const [logs, setLogs] = useState<Log[]>([]);
  const [presence, setPresence] = useState<number>(0);
  const [attendanceToday, setAttendanceToday] = useState<number>(0);
  const [inside, setInside] = useState<InsideUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [target, setTarget] = useState<InsideUser | null>(null);
  const [useNow, setUseNow] = useState(true);
  const [exitTime, setExitTime] = useState(nowHHMM());
  const [saving, setSaving] = useState(false);

  const refreshInside = async (supabase: ReturnType<typeof createClient>, gymId: string) => {
    const [presRes, staffRes] = await Promise.all([
      supabase.from("gym_presence").select("user_id, last_in").eq("gym_id", gymId),
      supabase.from("gym_staff").select("user_id").eq("gym_id", gymId),
    ]);
    const presRows = (presRes.data ?? []) as { user_id: string; last_in: string }[];
    const sIds = new Set(((staffRes.data ?? []) as { user_id: string }[]).map((r) => r.user_id));
    setPresence(presRows.length);

    let next: InsideUser[] = [];
    if (presRows.length > 0) {
      const ids = presRows.map((r) => r.user_id);
      const personMap = new Map<string, Person>();
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name, username, avatar_url")
        .in("id", ids);
      for (const p of (profs ?? []) as (Person & { id: string })[]) {
        personMap.set(p.id, {
          user_id: p.id,
          full_name: p.full_name,
          username: p.username,
          avatar_url: p.avatar_url,
        });
      }
      next = presRows
        .map((r) => ({
          user_id: r.user_id,
          last_in: r.last_in,
          person: personMap.get(r.user_id) ?? null,
          isStaff: sIds.has(r.user_id),
        }))
        .sort((a, b) => new Date(b.last_in).getTime() - new Date(a.last_in).getTime());
    }
    setInside(next);
  };

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

      const [logRes, attendanceRes] = await Promise.all([
        supabase
          .from("gym_access_logs")
          .select("id, type, created_at, profiles:gym_access_logs_user_id_fkey(full_name, username)")
          .eq("gym_id", g.id)
          .order("created_at", { ascending: false })
          .limit(40),
        supabase.rpc("gym_attendance_today", { p_gym: g.id }),
      ]);
      if (active) {
        setLogs((logRes.data ?? []) as Log[]);
        setAttendanceToday(typeof attendanceRes.data === "number" ? attendanceRes.data : 0);
      }

      await refreshInside(supabase, g.id);
      if (active) setLoading(false);

      const channel = supabase
        .channel("accesos-presence")
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "gym_access_logs",
            filter: `gym_id=eq.${g.id}`,
          },
          async () => {
            if (!active) return;
            await refreshInside(supabase, g.id);
          }
        )
        .subscribe();

      return () => channel.unsubscribe();
    })();
    return () => {
      active = false;
    };
  }, [userId]);

  const openExit = (u: InsideUser) => {
    setTarget(u);
    setUseNow(true);
    setExitTime(nowHHMM());
  };

  const confirmExit = async () => {
    if (!gym || !target || saving) return;
    const supabase = createClient();
    const exitIso = useNow
      ? new Date().toISOString()
      : (() => {
          const d = new Date();
          const [h, m] = exitTime.split(":").map(Number);
          d.setHours(h, m, 0, 0);
          return d.toISOString();
        })();

    if (!useNow) {
      const lastIn = new Date(target.last_in).getTime();
      const exitTs = new Date(exitIso).getTime();
      if (exitTs < lastIn) {
        toast("La salida no puede ser anterior a la entrada", "error");
        return;
      }
    }

    setSaving(true);
    const { error } = await supabase
      .from("gym_access_logs")
      .insert({ gym_id: gym.id, user_id: target.user_id, type: "egreso", created_at: exitIso });
    setSaving(false);
    if (error) {
      toast("No se pudo registrar la salida", "error");
      return;
    }
    toast("Salida registrada");
    setTarget(null);
    setUseNow(true);
    setExitTime(nowHHMM());
    await refreshInside(supabase, gym.id);
  };

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
  const alumnos = inside.filter((u) => !u.isStaff);
  const profesores = inside.filter((u) => u.isStaff);

  const nameOf = (u: InsideUser) =>
    u.person?.full_name ?? u.person?.username ?? (u.isStaff ? "Profesor" : "Miembro");

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
        <p className="text-sm font-semibold text-ink">Ahora dentro</p>
        <p className="mt-0.5 text-xs text-muted">Dales la salida manual cuando quieras.</p>
        {inside.length === 0 ? (
          <p className="mt-2 rounded-xl border border-dashed border-edge bg-card p-4 text-center text-xs text-muted">
            Nadie adentro ahora mismo.
          </p>
        ) : (
          <div className="mt-3 space-y-3">
            {alumnos.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-neon">
                  Alumnos · {alumnos.length}
                </p>
                <div className="mt-1.5 space-y-1.5">
                  {alumnos.map((u) => (
                    <div
                      key={u.user_id}
                      className="flex items-center justify-between gap-2 rounded-xl border border-edge bg-card p-2.5"
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        <Avatar
                          src={u.person?.avatar_url}
                          name={u.person?.full_name}
                          username={u.person?.username}
                          size="sm"
                          ring={false}
                        />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-ink">{nameOf(u)}</p>
                          <p className="text-[11px] text-muted">
                            Entró{" "}
                            {new Date(u.last_in).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => openExit(u)}
                        className="flex shrink-0 items-center gap-1.5 rounded-lg border border-ember/40 bg-ember/10 px-2.5 py-1.5 text-xs font-semibold text-ember transition hover:bg-ember/20"
                      >
                        <DoorClosed className="h-3.5 w-3.5" /> Dar salida
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {profesores.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-ember">
                  Profesores · {profesores.length}
                </p>
                <div className="mt-1.5 space-y-1.5">
                  {profesores.map((u) => (
                    <div
                      key={u.user_id}
                      className="flex items-center justify-between gap-2 rounded-xl border border-ember/40 bg-ember/10 p-2.5"
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        <Avatar
                          src={u.person?.avatar_url}
                          name={u.person?.full_name}
                          username={u.person?.username}
                          size="sm"
                          ring={false}
                        />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-ink">{nameOf(u)}</p>
                          <p className="text-[11px] text-muted">
                            Entró{" "}
                            {new Date(u.last_in).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => openExit(u)}
                        className="flex shrink-0 items-center gap-1.5 rounded-lg border border-ember/40 bg-ember/10 px-2.5 py-1.5 text-xs font-semibold text-ember transition hover:bg-ember/20"
                      >
                        <DoorClosed className="h-3.5 w-3.5" /> Dar salida
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
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

      <BottomSheet open={target !== null} onClose={() => setTarget(null)} title="Registrar salida">
        {target && (
          <div>
            <div className="flex items-center gap-3 rounded-xl border border-edge bg-card p-3">
              <Avatar
                src={target.person?.avatar_url}
                name={target.person?.full_name}
                username={target.person?.username}
                size="sm"
                ring={false}
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink">{nameOf(target)}</p>
                <p className="text-xs text-muted">
                  Entró a las{" "}
                  {new Date(target.last_in).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </div>

            <label className="mt-4 flex cursor-pointer items-center gap-2.5 rounded-xl border border-edge bg-card p-3">
              <input
                type="checkbox"
                checked={useNow}
                onChange={(e) => setUseNow(e.target.checked)}
                className="h-4 w-4 accent-[#00f2fe]"
              />
              <span className="text-sm font-medium text-ink">Registrar con la hora actual</span>
            </label>

            {!useNow && (
              <div className="mt-3">
                <p className="text-xs font-medium text-muted">¿A qué hora salió?</p>
                <input
                  type="time"
                  value={exitTime}
                  onChange={(e) => setExitTime(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-edge bg-card px-3 py-2.5 text-sm text-ink focus:border-neon focus:outline-none"
                />
              </div>
            )}

            <button
              onClick={confirmExit}
              disabled={saving}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-ember py-3 font-semibold text-bg disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
              Confirmar salida
            </button>
          </div>
        )}
      </BottomSheet>
    </main>
  );
}