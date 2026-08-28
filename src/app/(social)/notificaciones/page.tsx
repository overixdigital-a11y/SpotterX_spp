"use client";

import { useEffect, useState } from "react";
import { Zap, MessageCircle, UserPlus, Loader2, Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuthState } from "@/lib/auth-context";

interface Notif {
  id: string;
  type: "pulse" | "comment" | "follow" | "message";
  actor: { username: string; full_name: string | null } | null;
  read: boolean;
  created_at: string;
}

const iconMap = {
  pulse: { Icon: Zap, tone: "text-neon" },
  comment: { Icon: MessageCircle, tone: "text-neon" },
  follow: { Icon: UserPlus, tone: "text-ember" },
  message: { Icon: Mail, tone: "text-ember" },
} as const;

const textMap = {
  pulse: "te dio un pulse",
  comment: "comentó tu publicación",
  follow: "empezó a seguirte",
  message: "te envió un mensaje",
} as const;

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "ahora";
  const m = Math.floor(s / 60);
  if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h} h`;
  return `hace ${Math.floor(h / 24)} d`;
}

export default function NotificacionesPage() {
  const { userId } = useAuthState();
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    let active = true;

    const load = async () => {
      const { data } = await supabase
        .from("notifications")
        .select("*, actor:actor_id(username, full_name)")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(30);
      if (active && data) setNotifs(data as unknown as Notif[]);
      if (active) setLoading(false);
    };

    load();

    const channel = supabase
      .channel("notifs")
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

  if (loading) {
    return (
      <main className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-neon" />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md px-4 pt-2">
      {notifs.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-muted">Todavía no tenés notificaciones.</p>
        </div>
      ) : (
        notifs.map((n) => {
          const { Icon, tone } = iconMap[n.type];
          const actor = n.actor?.full_name || n.actor?.username || "Alguien";
          return (
            <div key={n.id} className="flex items-center gap-3 border-b border-edge py-3.5">
              <Icon className={`h-5 w-5 shrink-0 ${tone}`} />
              <div className="leading-tight">
                <p className="text-sm text-ink">
                  <span className="font-semibold">{actor}</span>{" "}
                  {textMap[n.type]}
                </p>
                <p className="text-xs text-muted">{timeAgo(n.created_at)}</p>
              </div>
            </div>
          );
        })
      )}
    </main>
  );
}
