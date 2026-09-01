"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { TopBar } from "@/components/core/TopBar";
import { BottomNav } from "@/components/core/BottomNav";
import { AuthProvider, useAuthState } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import {
  Home,
  Compass,
  Plus,
  Bell,
  User,
  LogOut,
  Dumbbell,
  TrendingUp,
  Sparkles,
  ShieldCheck,
} from "lucide-react";

const navItems = [
  { href: "/home", label: "Inicio", icon: Home },
  { href: "/discover", label: "Descubrir", icon: Compass },
  { href: "/crear", label: "Crear publicación", icon: Plus, highlight: true },
  { href: "/notificaciones", label: "Notificaciones", icon: Bell },
  { href: "/perfil", label: "Mi Perfil", icon: User },
];

function DesktopSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { profile } = useAuthState();
  const userRole = profile?.role;

  const onLogout = async () => {
    await createClient().auth.signOut();
    router.refresh();
    router.push("/login");
  };

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col justify-between border-r border-edge bg-card/60 p-5 backdrop-blur md:flex">
      <div className="space-y-6">
        {/* Brand */}
        <Link href="/home" className="flex items-center gap-2 px-2">
          <span className="text-2xl font-black tracking-tight">
            <span className="text-neon text-glow">Spotter</span>
            <span className="text-ember">X</span>
          </span>
          <span className="rounded-full bg-neon/10 px-2 py-0.5 text-[10px] font-bold text-neon uppercase tracking-wider">
            Fit App
          </span>
        </Link>

        {/* Navigation Items */}
        <nav className="space-y-1.5">
          {navItems.map((item) => {
            const active = pathname.startsWith(item.href);
            const Icon = item.icon;

            if (item.highlight) {
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="my-3 flex items-center justify-center gap-2 rounded-xl bg-neon px-4 py-3 text-sm font-bold text-bg shadow-neon transition hover:opacity-90 active:scale-[0.98]"
                >
                  <Plus className="h-5 w-5" strokeWidth={2.5} />
                  <span>Crear publicación</span>
                </Link>
              );
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3.5 rounded-xl px-3.5 py-3 text-sm font-medium transition ${
                  active
                    ? "bg-elevated text-neon font-semibold border border-neon/30"
                    : "text-ink/80 hover:bg-elevated/60 hover:text-ink"
                }`}
              >
                <Icon className={`h-5 w-5 ${active ? "text-neon" : "text-muted"}`} strokeWidth={active ? 2.4 : 2} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Section: Gym Access Shortcut if Alumno or Gym */}
        <div className="pt-2 border-t border-edge/60">
          <p className="px-3.5 text-[11px] font-bold uppercase tracking-wider text-muted mb-2">Mi Espacio</p>
          {userRole === "gym" ? (
            <Link
              href="/gimnasio"
              className="flex items-center gap-3 rounded-xl border border-ember/40 bg-ember/10 px-3.5 py-2.5 text-xs font-semibold text-ember transition hover:bg-ember/20"
            >
              <ShieldCheck className="h-4 w-4" />
              <span>Panel de Gimnasio</span>
            </Link>
          ) : (
            <Link
              href="/perfil"
              className="flex items-center gap-3 rounded-xl border border-edge bg-elevated/40 px-3.5 py-2.5 text-xs font-medium text-ink transition hover:border-neon/40 hover:text-neon"
            >
              <Dumbbell className="h-4 w-4 text-neon" />
              <span>Pasaporte Gimnasio</span>
            </Link>
          )}
        </div>
      </div>

      {/* Logout */}
      <div className="border-t border-edge pt-4">
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

function RightSidebarWidget() {
  const hashtags = ["#CrossFit", "#Running", "#Powerlifting", "#Calisthenics", "#Bodybuilding"];

  return (
    <aside className="fixed inset-y-0 right-0 z-40 hidden w-80 flex-col gap-6 border-l border-edge bg-card/30 p-6 backdrop-blur lg:flex">
      {/* Hashtags Card */}
      <div className="rounded-2xl border border-edge bg-elevated/50 p-4 space-y-3">
        <div className="flex items-center gap-2 text-neon text-xs font-bold uppercase tracking-wider">
          <TrendingUp className="h-4 w-4" />
          <span>Tendencias Fit</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {hashtags.map((tag) => (
            <Link
              key={tag}
              href={`/discover`}
              className="rounded-lg border border-edge bg-card px-2.5 py-1 text-xs font-medium text-ink/90 transition hover:border-neon/50 hover:text-neon"
            >
              {tag}
            </Link>
          ))}
        </div>
      </div>

      {/* SpotterX Promo Banner */}
      <div className="rounded-2xl border border-neon/30 bg-gradient-to-br from-neon/10 via-card to-bg p-4 text-xs space-y-2">
        <div className="flex items-center gap-1.5 font-bold text-neon">
          <Sparkles className="h-4 w-4" />
          <span>SpotterX Ecosystem</span>
        </div>
        <p className="text-muted leading-relaxed">
          Entrená, registrá tus pases QR con tu gimnasio y conectá con la mayor comunidad de fitness.
        </p>
      </div>
    </aside>
  );
}

export function SocialShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const onLogout = async () => {
    await createClient().auth.signOut();
    router.refresh();
    router.push("/login");
  };

  return (
    <AuthProvider>
      <div className="flex min-h-screen bg-bg">
        <DesktopSidebar />
        
        <div className="flex-1 md:pl-64 lg:pr-80">
          <TopBar onLogout={onLogout} />
          <main className="mx-auto min-h-screen max-w-xl px-4 py-4 md:py-6 pb-24 md:pb-8">
            {children}
          </main>
        </div>

        <RightSidebarWidget />
        <BottomNav />
      </div>
    </AuthProvider>
  );
}

