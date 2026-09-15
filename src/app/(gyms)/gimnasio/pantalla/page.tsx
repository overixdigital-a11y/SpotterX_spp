"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { Loader2, DoorOpen, DoorClosed, X, ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuthState } from "@/lib/auth-context";

interface Gym {
  id: string;
  name: string | null;
  qr_code: string | null;
}

interface Person {
  user_id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
}

interface Entry {
  id: string;
  user_id: string;
  created_at: string;
  type: string;
  person: Person | null;
}

interface EntryRow {
  id: string;
  user_id: string;
  created_at: string;
  type: string;
  profiles: Person[] | null;
}

interface PresenceUser {
  user_id: string;
  last_in: string;
  person: Person | null;
  isStaff: boolean;
}

const QR_URL = (code: string) => `https://spotterx-five.vercel.app/checkin/${code}`;

function Avatar({ person, big }: { person: Person | null; big?: boolean }) {
  const name = person?.full_name || person?.username || "?";
  const initial = name.slice(0, 2).toUpperCase();
  if (person?.avatar_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={person.avatar_url}
        alt={name}
        className={`rounded-full border-2 border-neon object-cover shadow-neon ${
          big ? "h-20 w-20" : "h-8 w-8"
        }`}
      />
    );
  }
  return (
    <div
      className={`flex items-center justify-center rounded-full border-2 border-neon bg-neon/20 font-bold text-neon shadow-neon ${
        big ? "h-20 w-20 text-xl" : "h-8 w-8 text-[10px]"
      }`}
    >
      {initial}
    </div>
  );
}

export default function GymPantallaPage() {
  const { userId } = useAuthState();
  const router = useRouter();
  const [gym, setGym] = useState<Gym | null>(null);
  const [loading, setLoading] = useState(true);
  const [flash, setFlash] = useState<Entry | null>(null);
  const [presence, setPresence] = useState<PresenceUser[]>([]);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let active = true;
    if (!userId) return;

    const supabase = createClient();

    (async () => {
      const { data: g } = await supabase
        .from("gyms")
        .select("id, name, qr_code")
        .eq("owner_id", userId)
        .maybeSingle();
      if (!active || !g) {
        if (active) setLoading(false);
        return;
      }
      setGym(g as Gym);
      setLoading(false);

      const { data: staffRows } = await supabase
        .from("gym_staff")
        .select("user_id")
        .eq("gym_id", g.id);
      const sIds = new Set((staffRows ?? []).map((r) => r.user_id));

      const todayStr = new Date().toISOString().slice(0, 10);
      const { data: logs } = await supabase
        .from("gym_access_logs")
        .select("id, user_id, created_at, type, profiles:gym_access_logs_user_id_fkey(full_name, username, avatar_url)")
        .eq("gym_id", g.id)
        .gte("created_at", todayStr)
        .order("created_at", { ascending: false })
        .limit(100);

      if (!active) return;

      const rows = (logs ?? []) as EntryRow[];
      const logsToday = rows.map((l) => ({
        user_id: l.user_id,
        type: l.type,
        created_at: l.created_at,
        person: l.profiles?.[0] ?? null,
      }));

      const userState: Record<string, { count: number; lastIn: string; person: Person | null }> = {};
      for (const l of logsToday) {
        if (!userState[l.user_id]) userState[l.user_id] = { count: 0, lastIn: l.created_at, person: l.person };
        userState[l.user_id].count += l.type === "ingreso" ? 1 : -1;
        if (l.type === "ingreso") userState[l.user_id].lastIn = l.created_at;
        if (l.person) userState[l.user_id].person = l.person;
      }

      const inside: PresenceUser[] = Object.entries(userState)
        .filter(([, s]) => s.count > 0)
        .map(([uid, s]) => ({
          user_id: uid,
          last_in: s.lastIn,
          person: s.person,
          isStaff: sIds.has(uid),
        }))
        .sort((a, b) => new Date(b.last_in).getTime() - new Date(a.last_in).getTime());

      if (active) setPresence(inside);

      const channel = supabase
        .channel(`kiosk-ingresos-${g.id}`)
        .on(
          "postgres_changes" as const,
          { event: "INSERT", schema: "public", table: "gym_access_logs", filter: `gym_id=eq.${g.id}` },
          async (payload) => {
            const row = payload.new as { user_id: string; type: string; created_at: string };
            const { data: person } = await supabase
              .from("profiles")
              .select("full_name, username, avatar_url")
              .eq("id", row.user_id)
              .maybeSingle();
            if (!active) return;
            const entry: Entry = {
              id: `${row.user_id}-${row.created_at}`,
              user_id: row.user_id,
              created_at: row.created_at,
              type: row.type,
              person: person as Person | null,
            };
            setFlash(entry);
            setPresence((prev) => {
              const existing = prev.find((p) => p.user_id === row.user_id);
              if (row.type === "ingreso") {
                if (existing) return prev;
                return [{ user_id: row.user_id, last_in: row.created_at, person: entry.person, isStaff: sIds.has(row.user_id) }, ...prev];
              } else {
                return prev.filter((p) => p.user_id !== row.user_id);
              }
            });
            if (flashTimer.current) clearTimeout(flashTimer.current);
            flashTimer.current = setTimeout(() => setFlash(null), 8000);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    })();

    return () => {
      active = false;
      if (flashTimer.current) clearTimeout(flashTimer.current);
    };
  }, [userId]);

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg">
        <Loader2 className="h-8 w-8 animate-spin text-neon" />
      </div>
    );
  }

  if (!gym?.qr_code) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-bg px-6 text-center">
        <p className="text-sm text-muted">Creá tu gimnasio para generar el QR.</p>
        <button
          onClick={() => router.back()}
          className="mt-4 flex items-center gap-2 rounded-xl bg-neon px-4 py-2 text-sm font-semibold text-bg shadow-neon"
        >
          <ArrowLeft className="h-4 w-4" /> Volver
        </button>
      </div>
    );
  }

  const alumnos = presence.filter((p) => !p.isStaff);
  const profesores = presence.filter((p) => p.isStaff);

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-bg">
      <div className="flex items-center justify-between border-b border-edge px-6 py-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-neon">Pantalla de acceso</p>
          <h1 className="text-2xl font-extrabold text-ink">{gym.name ?? "Gimnasio"}</h1>
        </div>
        <button
          onClick={() => router.push("/gimnasio/qr")}
          className="rounded-full border border-edge bg-card px-4 py-2 text-xs font-medium text-muted"
        >
          <X className="inline h-4 w-4" /> Cerrar
        </button>
      </div>

      <div className="flex flex-1 flex-col items-center gap-6 overflow-y-auto p-6 lg:flex-row lg:overflow-hidden lg:p-10">
        <div className="flex flex-col items-center lg:w-1/2">
          <div className="rounded-3xl bg-white p-6 shadow-neon">
            <QRCodeSVG value={QR_URL(gym.qr_code)} size={280} fgColor="#05070a" />
          </div>
          <p className="mt-4 font-mono text-sm text-neon">{gym.qr_code}</p>
          <p className="mt-1 max-w-xs text-center text-xs text-muted">
            Escaneá con tu celular para entrar al gimnasio.
          </p>
        </div>

        <div className="flex min-h-0 w-full flex-col gap-4 lg:w-1/2">
          {flash ? (
            <div
              className={`flex flex-1 flex-col items-center justify-center rounded-3xl border-2 p-8 animate-pulse ${
                flash.type === "ingreso"
                  ? "border-neon bg-card shadow-neon"
                  : "border-ember bg-card"
              }`}
            >
              <p className={`text-xs font-bold uppercase tracking-widest ${
                flash.type === "ingreso" ? "text-neon" : "text-ember"
              }`}>
                {flash.type === "ingreso" ? "¡Bienvenido!" : "Hasta luego"}
              </p>
              <div className="mx-auto mt-4">
                <Avatar person={flash.person} big />
              </div>
              <p className="mt-4 text-4xl font-extrabold text-ink">
                {flash.person?.full_name ?? flash.person?.username ?? "Miembro"}
              </p>
              <p className="mt-1 text-lg text-muted">@{flash.person?.username}</p>
              <p className={`mt-4 flex items-center gap-2 text-sm ${
                flash.type === "ingreso" ? "text-neon" : "text-ember"
              }`}>
                {flash.type === "ingreso" ? <DoorOpen className="h-5 w-5" /> : <DoorClosed className="h-5 w-5" />}
                {flash.type === "ingreso" ? "Ingresó a las" : "Salió a las"}{" "}
                {new Date(flash.created_at).toLocaleTimeString("es-AR", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center rounded-3xl border border-dashed border-edge bg-card p-8 text-center">
              <DoorOpen className="h-10 w-10 text-muted/40" />
              <p className="mt-3 text-lg font-semibold text-muted">Esperando un ingreso…</p>
              <p className="text-xs text-muted/60">
                Cuando alguien escanee el QR, aparece acá en pantalla.
              </p>
            </div>
          )}

          {alumnos.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted">
                Alumnos en el gym · {alumnos.length}
              </p>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {alumnos.map((u) => (
                  <div key={u.user_id} className="flex items-center gap-2 rounded-xl border border-edge bg-card p-2">
                    <Avatar person={u.person} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">
                        {u.person?.full_name ?? u.person?.username ?? "Miembro"}
                      </p>
                      <p className="text-[10px] text-muted">
                        {new Date(u.last_in).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {profesores.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted">
                Profesores trabajando · {profesores.length}
              </p>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {profesores.map((u) => (
                  <div key={u.user_id} className="flex items-center gap-2 rounded-xl border border-ember/40 bg-ember/10 p-2">
                    <Avatar person={u.person} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">
                        {u.person?.full_name ?? u.person?.username ?? "Miembro"}
                      </p>
                      <p className="text-[10px] text-muted">
                        {new Date(u.last_in).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {alumnos.length === 0 && profesores.length === 0 && !flash && (
            <div className="text-center text-sm text-muted">
              Nadie en el gym ahora mismo.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}