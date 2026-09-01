"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LayoutDashboard, Users, Receipt, QrCode, Activity, Wallet, Bell } from "lucide-react";
import { AuthProvider, useAuthState } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";

interface ActorRef {
  full_name: string | null;
  username: string | null;
}

interface CheckinNotif {
  id: string;
  created_at: string;
  read: boolean;
  actor: ActorRef[];
}

function NotificationBell() {
  const { userId } = useAuthState();
  const [open, setOpen] = useState(false);
  const [notifs, setNotifs] = useState<CheckinNotif[]>([]);
  const unread = notifs.filter((n) => !n.read).length;

  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    let active = true;

    const load = async () => {
      const { data } = await supabase
        .from("notifications")
        .select("id, created_at, read, actor:actor_id!notifications_actor_id_fkey(full_name, username)")
        .eq("user_id", userId)
        .eq("type", "checkin")
        .order("created_at", { ascending: false })
        .limit(10);
      if (active) setNotifs(((data ?? []) as CheckinNotif[]));
    };
    load();

    const channel = supabase
      .channel("gym-notifs")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        (payload) => {
          const row = payload.new as { type: string; actor_id: string };
          if (row.type !== "checkin") return;
          load();
        }
      )
      .subscribe();

    return () => {
      active = false;
      channel.unsubscribe();
    };
  }, [userId]);

  const markRead = async () => {
    setOpen((v) => {
      if (!v && unread > 0) {
        createClient().from("notifications").update({ read: true }).in("id", notifs.filter((n) => !n.read).map((n) => n.id));
        setNotifs((prev) => prev.map((n) => ({ ...n, read: true })));
      }
      return !v;
    });
  };

  const nameOf = (n: CheckinNotif) => n.actor?.[0]?.full_name ?? n.actor?.[0]?.username ?? "Alguien";

  return (
    <div className="relative">
      <button
        onClick={markRead}
        className="relative rounded-full border border-edge bg-card p-2 text-muted hover:text-neon"
        aria-label="Avisos de ingreso"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-ember px-1 text-[9px] font-bold text-bg">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-72 rounded-2xl border border-edge bg-card p-3 shadow-neon">
          <p className="text-xs font-semibold text-ink">Quién entró al gimnasio</p>
          {notifs.length === 0 ? (
            <p className="mt-2 text-xs text-muted">Todavía no hay ingresos registrados.</p>
          ) : (
            <div className="mt-2 max-h-64 space-y-1.5 overflow-y-auto">
              {notifs.map((n) => (
                <div key={n.id} className="flex items-center justify-between rounded-xl border border-edge bg-elevated p-2">
                  <p className="min-w-0 truncate text-sm font-medium text-ink">{nameOf(n)}</p>
                  <p className="shrink-0 text-[10px] text-muted">
                    {new Date(n.created_at).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Header() {
  const router = useRouter();
  const onLogout = async () => {
    await createClient().auth.signOut();
    router.refresh();
    router.push("/login");
  };

  return (
    <header className="sticky top-0 z-30 border-b border-edge bg-bg/95 backdrop-blur">
      <div className="mx-auto flex max-w-md items-center justify-between px-4 py-3">
        <span className="text-lg font-bold tracking-tight">
          <span className="text-neon text-glow">Spotter</span>
          <span className="text-ember">X</span>
        </span>
        <span className="rounded-full border border-neon/40 bg-neon/10 px-3 py-1 text-xs font-semibold text-neon">
          Gimnasio
        </span>
        <div className="flex items-center gap-2">
          <NotificationBell />
          <button onClick={onLogout} className="text-xs font-medium text-muted hover:text-ember">
            Salir
          </button>
        </div>
      </div>
    </header>
  );
}

const nav = [
  { href: "/gimnasio", label: "Panel", icon: LayoutDashboard },
  { href: "/gimnasio/miembros", label: "Miembros", icon: Users },
  { href: "/gimnasio/planes", label: "Planes", icon: Receipt },
  { href: "/gimnasio/cobros", label: "Cobros", icon: Wallet },
  { href: "/gimnasio/qr", label: "QR", icon: QrCode },
  { href: "/gimnasio/accesos", label: "Accesos", icon: Activity },
];

function GymNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-edge bg-card/95 backdrop-blur">
      <div className="mx-auto flex max-w-md items-center justify-around px-1 py-1">
        {nav.map((n) => {
          const Icon = n.icon;
          const active = pathname === n.href;
          return (
            <Link
              key={n.href}
              href={n.href}
              className={`flex flex-col items-center gap-0.5 rounded-xl px-2 py-1.5 text-[10px] font-medium transition ${
                active ? "text-neon" : "text-muted"
              }`}
            >
              <Icon className="h-5 w-5" strokeWidth={active ? 2.4 : 2} />
              {n.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function GymShell({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <Header />
      <div className="min-h-screen pb-20">{children}</div>
      <GymNav />
    </AuthProvider>
  );
}
