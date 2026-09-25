"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Zap, MessageCircle, UserPlus, Loader2, Mail, DoorOpen, CheckCheck, ShieldAlert, CalendarClock, Store, UserCheck, ShoppingBag } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuthState } from "@/lib/auth-context";
import { useModuleGuard } from "@/lib/gym-modules";
import { timeAgo } from "@/lib/format";
import { EmptyState } from "@/components/core/EmptyState";

type NotifType = "pulse" | "comment" | "follow" | "message" | "checkin" | "vencimiento" | string;

interface Notif {
  id: string;
  type: NotifType;
  actor: { id: string; username: string; full_name: string | null; avatar_url: string | null } | null;
  post_id: string | null;
  gym_id: string | null;
  read: boolean;
  created_at: string;
}

const iconMap: Record<string, { Icon: typeof Zap; tone: string }> = {
  pulse: { Icon: Zap, tone: "text-neon" },
  comment: { Icon: MessageCircle, tone: "text-neon" },
  follow: { Icon: UserPlus, tone: "text-ember" },
  message: { Icon: Mail, tone: "text-ember" },
  checkin: { Icon: DoorOpen, tone: "text-neon" },
  vencimiento: { Icon: CalendarClock, tone: "text-ember" },
  solicitud_staff: { Icon: Store, tone: "text-ember" },
  staff_aprobado: { Icon: UserCheck, tone: "text-neon" },
  orden: { Icon: ShoppingBag, tone: "text-neon" },
};

const textMap: Record<string, string> = {
  pulse: "te dio un pulse",
  comment: "comentó tu publicación",
  follow: "empezó a seguirte",
  message: "te envió un mensaje",
  checkin: "registró su ingreso al gimnasio",
  vencimiento: "te avisa que tu membresía vence pronto",
  solicitud_staff: "se postuló para trabajar en tu gimnasio",
  staff_aprobado: "aprobó tu postulación en su gimnasio",
  orden: "tiene una nueva orden en SpotterShop",
};

export default function NotificacionesPage() {
  const { userId } = useAuthState();
  const { busy } = useModuleGuard("feed");
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    let active = true;

    const load = async () => {
      const { data } = await supabase
        .from("notifications")
        .select("*, actor:actor_id(id, username, full_name, avatar_url)")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (active && data) {
        setNotifs(data as unknown as Notif[]);
        const unreadIds = (data as unknown as Notif[]).filter((n) => !n.read).map((n) => n.id);
        if (unreadIds.length > 0) {
          await supabase.from("notifications").update({ read: true }).in("id", unreadIds);
        }
      }
      if (active) setLoading(false);
    };

    load();

    const channel = supabase
      .channel("notifs-social")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        () => load()
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const markAllRead = async () => {
    if (!userId) return;
    const supabase = createClient();
    const { data } = await supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", userId)
      .eq("read", false)
      .select("id");
    if (data) {
      const ids = new Set(data.map((n) => n.id));
      setNotifs((prev) => prev.map((n) => (ids.has(n.id) ? { ...n, read: true } : n)));
    }
  };

  const unreadCount = notifs.filter((n) => !n.read).length;

  if (loading) {
    return (
      <main className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-neon" />
      </main>
    );
  }

  if (busy) {
    return (
      <div className="flex justify-center pt-20">
        <Loader2 className="h-6 w-6 animate-spin text-neon" />
      </div>
    );
  }

  return (
    <div className="w-full">
      {notifs.length === 0 ? (
        <EmptyState
          icon={ShieldAlert}
          title="Todavía no tenés notificaciones"
          subtitle="Las novedades de tus followers y de tu gym aparecen acá."
        />
      ) : (
        <>
          {unreadCount > 0 && (
            <div className="flex justify-end pt-2">
              <button
                onClick={markAllRead}
                className="flex items-center gap-1.5 rounded-full bg-neon/10 px-3 py-1.5 text-xs font-semibold text-neon transition hover:bg-neon/20"
              >
                <CheckCheck className="h-3.5 w-3.5" /> Marcar todas como leídas
              </button>
            </div>
          )}

          <div>
            {notifs.map((n) => {
              const { Icon, tone } = iconMap[n.type] ?? iconMap.follow;
              const actor = n.actor?.full_name || n.actor?.username || "Alguien";
              const inner = (
                <div
                  key={n.id}
                  className={`flex items-center gap-3 border-b border-edge py-3.5 ${
                    !n.read ? "bg-neon/5" : ""
                  }`}
                >
                  <div className="shrink-0">
                    {n.actor?.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={n.actor.avatar_url}
                        alt={actor}
                        className="h-10 w-10 rounded-full border border-neon/40 object-cover"
                      />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-neon/20 text-xs font-bold text-neon">
                        {actor.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <Icon className={`h-5 w-5 shrink-0 ${tone}`} />
                  <div className="min-w-0 flex-1 leading-tight">
                    <p className="text-sm text-ink">
                      <span className="font-semibold">{actor}</span>{" "}
                      {textMap[n.type] ?? "actualizó algo nuevo"}
                    </p>
                    <p className="text-xs text-muted">{timeAgo(n.created_at)}</p>
                  </div>
                  {!n.read && <span className="h-2 w-2 shrink-0 rounded-full bg-neon" />}
                </div>
              );
              if (n.post_id) {
                return (
                  <Link key={n.id} href={`/posts/${n.post_id}`} className="block">
                    {inner}
                  </Link>
                );
              }
              if (n.gym_id) {
                return (
                  <Link
                    key={n.id}
                    href={n.type === "vencimiento" ? "/mi-gimnasio" : n.type === "staff_aprobado" ? "/entrenamiento/zona" : "/gimnasio"}
                    className="block"
                  >
                    {inner}
                  </Link>
                );
              }
              if (n.type === "follow" && n.actor?.username) {
                return (
                  <Link key={n.id} href={`/perfil/${n.actor.username}`} className="block">
                    {inner}
                  </Link>
                );
              }
              if (n.type === "message" && n.actor?.id) {
                return (
                  <Link key={n.id} href={`/chat/${n.actor.id}`} className="block">
                    {inner}
                  </Link>
                );
              }
              if (n.type === "orden") {
                return (
                  <Link key={n.id} href="/market/mis-compras" className="block">
                    {inner}
                  </Link>
                );
              }
              return inner;
            })}
          </div>
        </>
      )}
    </div>
  );
}