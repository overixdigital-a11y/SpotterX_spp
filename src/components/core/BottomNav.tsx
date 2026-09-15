"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Home, Compass, Plus, Bell, User } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuthState } from "@/lib/auth-context";

const items = [
  { href: "/home", label: "Inicio", icon: Home },
  { href: "/discover", label: "Descubrir", icon: Compass },
  { href: "/crear", label: "Crear", icon: Plus, highlight: true },
  { href: "/notificaciones", label: "Notis", icon: Bell },
  { href: "/perfil", label: "Perfil", icon: User },
];

export function BottomNav() {
  const pathname = usePathname();
  const { userId } = useAuthState();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();

    const load = async () => {
      const { count } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("read", false);
      setUnread(count ?? 0);
    };

    load();

    const channel = supabase
      .channel("nav-notifs")
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
      supabase.removeChannel(channel);
    };
  }, [userId]);

  return (
    <nav className="fixed inset-x-0 bottom-4 z-40 px-4 md:hidden">
      <div className="mx-auto flex max-w-md items-center justify-around rounded-full border border-edge bg-card/90 px-2 py-2 shadow-neon backdrop-blur">
        {items.map((item) => {
          const active = pathname.startsWith(item.href);
          const Icon = item.icon;
          const isNotif = item.href === "/notificaciones";
          return (
            <Link
              key={item.href}
              href={item.href}
              className={
                item.highlight
                  ? "flex h-11 w-11 items-center justify-center rounded-full bg-neon text-bg shadow-neon"
                  : `relative flex h-11 w-11 flex-col items-center justify-center gap-0.5 rounded-full transition ${
                      active ? "text-neon" : "text-muted"
                    }`
              }
            >
              <Icon className="h-5 w-5" strokeWidth={active ? 2.5 : 2} />
              {isNotif && unread > 0 && (
                <span className="absolute right-1 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-ember px-1 text-[9px] font-bold text-bg">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}