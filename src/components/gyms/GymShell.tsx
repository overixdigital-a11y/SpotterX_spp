"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Users,
  Receipt,
  QrCode,
  Activity,
  Wallet,
  Bell,
  LogOut,
  Globe,
  MonitorPlay,
} from "lucide-react";
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
        .select("id, created_at, read, actor:actor_id(full_name, username)")
        .eq("user_id", userId)
        .eq("type", "checkin")
        .order("created_at", { ascending: false })
        .limit(10);
      if (active) setNotifs(((data ?? []) as CheckinNotif[]));
    };
    load();

    const channelId = `gym-notifs-${userId}-${Math.random().toString(36).slice(2, 7)}`;
    const channel = supabase
      .channel(channelId)
      .on(
        "postgres_changes" as const,
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
      supabase.removeChannel(channel);
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
        className="relative flex items-center gap-2 rounded-xl border border-edge bg-card px-3 py-2 text-muted hover:border-neon/40 hover:text-neon transition"
        aria-label="Avisos de ingreso"
      >
        <Bell className="h-4 w-4" />
        <span className="hidden md:inline text-xs font-semibold">Notificaciones</span>
        {unread > 0 && (
          <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-ember px-1 text-[9px] font-bold text-bg">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-2xl border border-edge bg-card p-3 shadow-2xl backdrop-blur-md">
          <p className="text-xs font-bold text-ink">Ingresos recientes al gimnasio</p>
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

function MobileHeader() {
  const router = useRouter();
  const onLogout = async () => {
    await createClient().auth.signOut();
    router.refresh();
    router.push("/login");
  };

  return (
    <header className="sticky top-0 z-30 border-b border-edge bg-bg/95 backdrop-blur md:hidden">
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
  { href: "/gimnasio", label: "Panel Principal", icon: LayoutDashboard },
  { href: "/gimnasio/miembros", label: "Miembros", icon: Users },
  { href: "/gimnasio/planes", label: "Planes & Promos", icon: Receipt },
  { href: "/gimnasio/cobros", label: "Cobros & Cuotas", icon: Wallet },
  { href: "/gimnasio/qr", label: "Código QR", icon: QrCode },
  { href: "/gimnasio/accesos", label: "Accesos & Aforo", icon: Activity },
];

function MobileGymNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-edge bg-card/95 backdrop-blur md:hidden">
      <div className="mx-auto flex max-w-md items-center justify-around px-1 py-1">
        {nav.map((n) => {
          const Icon = n.icon;
          const active = pathname === n.href;
          return (
            <Link
              key={n.href}
              href={n.href}
              className={`flex flex-col items-center gap-0.5 rounded-xl px-2 py-1.5 text-[10px] font-medium transition ${
                active ? "text-neon font-semibold" : "text-muted"
              }`}
            >
              <Icon className="h-5 w-5" strokeWidth={active ? 2.4 : 2} />
              <span className="truncate max-w-[50px]">{n.label.split(" ")[0]}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function DesktopGymSidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const onLogout = async () => {
    await createClient().auth.signOut();
    router.refresh();
    router.push("/login");
  };

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col justify-between border-r border-edge bg-card/70 p-5 backdrop-blur md:flex">
      <div className="space-y-6">
        {/* Brand & Badge */}
        <div className="flex items-center justify-between">
          <Link href="/gimnasio" className="flex items-center gap-2">
            <span className="text-2xl font-black tracking-tight">
              <span className="text-neon text-glow">Spotter</span>
              <span className="text-ember">X</span>
            </span>
          </Link>
          <span className="rounded-full border border-neon/40 bg-neon/10 px-2.5 py-0.5 text-[10px] font-bold text-neon uppercase tracking-wider">
            Gym Admin
          </span>
        </div>

        {/* Navigation Items */}
        <nav className="space-y-1">
          <p className="px-3 text-[11px] font-bold uppercase tracking-wider text-muted mb-2">Administración</p>
          {nav.map((n) => {
            const Icon = n.icon;
            const active = pathname === n.href;
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`flex items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-medium transition ${
                  active
                    ? "bg-elevated text-neon font-semibold border border-neon/30 shadow-neon/10"
                    : "text-ink/80 hover:bg-elevated/60 hover:text-ink"
                }`}
              >
                <Icon className={`h-5 w-5 ${active ? "text-neon" : "text-muted"}`} strokeWidth={active ? 2.4 : 2} />
                <span>{n.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Actions & Utilities */}
        <div className="pt-4 border-t border-edge/60 space-y-2">
          <p className="px-3 text-[11px] font-bold uppercase tracking-wider text-muted mb-2">Herramientas</p>
          <Link
            href="/gimnasio/pantalla"
            target="_blank"
            className="flex items-center gap-3 rounded-xl border border-edge bg-elevated/40 px-3.5 py-2.5 text-xs font-medium text-ink hover:border-neon/40 hover:text-neon transition"
          >
            <MonitorPlay className="h-4 w-4 text-neon" />
            <span>Kiosk Recepción</span>
          </Link>
          <Link
            href="/home"
            className="flex items-center gap-3 rounded-xl border border-edge bg-elevated/40 px-3.5 py-2.5 text-xs font-medium text-ink hover:border-neon/40 hover:text-neon transition"
          >
            <Globe className="h-4 w-4 text-muted" />
            <span>Ir a Red Social</span>
          </Link>
        </div>
      </div>

      {/* Footer: User & Sign Out */}
      <div className="border-t border-edge pt-4 space-y-3">
        <div className="flex items-center justify-between">
          <NotificationBell />
        </div>
        <button
          onClick={onLogout}
          className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium text-muted transition hover:bg-ember/10 hover:text-ember"
        >
          <LogOut className="h-4 w-4" />
          <span>Cerrar sesión</span>
        </button>
      </div>
    </aside>
  );
}

export function GymShell({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <div className="flex min-h-screen bg-bg">
        <DesktopGymSidebar />

        <div className="flex-1 md:pl-64">
          <MobileHeader />
          <main className="mx-auto min-h-screen w-full max-w-7xl p-4 md:p-8 pb-24 md:pb-8">
            {children}
          </main>
        </div>

        <MobileGymNav />
      </div>
    </AuthProvider>
  );
}

