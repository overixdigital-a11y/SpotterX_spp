"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Users,
  MapPin,
  User,
  Settings,
  ShoppingBag,
  LogOut,
  Home,
} from "lucide-react";
import { AuthProvider } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";

function Header() {
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
        <span className="rounded-full border border-ember/40 bg-ember/10 px-3 py-1 text-xs font-semibold text-ember">
          Profesor
        </span>
        <Link href="/perfil/editar" className="text-muted hover:text-neon">
          <Settings className="h-5 w-5" />
        </Link>
        <button onClick={onLogout} className="text-xs font-medium text-muted hover:text-ember">
          Salir
        </button>
      </div>
    </header>
  );
}

const nav = [
  { href: "/entrenamiento", label: "Alumnos", icon: Users },
  { href: "/entrenamiento/zona", label: "Mi zona", icon: MapPin },
  { href: "/market", label: "SpotterShop", icon: ShoppingBag },
  { href: "/perfil", label: "Perfil", icon: User },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

function DesktopSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const onLogout = async () => {
    await createClient().auth.signOut();
    router.refresh();
    router.push("/login");
  };

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col justify-between border-r border-edge bg-card/60 p-5 backdrop-blur md:flex">
      <div className="space-y-6">
        <Link href="/entrenamiento" className="flex items-center gap-2 px-2">
          <span className="text-2xl font-black tracking-tight">
            <span className="text-neon text-glow">Spotter</span>
            <span className="text-ember">X</span>
          </span>
          <span className="rounded-full border border-ember/40 bg-ember/10 px-2 py-0.5 text-[10px] font-bold text-ember uppercase tracking-wider">
            Profesor
          </span>
        </Link>

        <nav className="space-y-1.5">
          {nav.map((n) => {
            const Icon = n.icon;
            const active = isActive(pathname, n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`flex items-center gap-3.5 rounded-xl px-3.5 py-3 text-sm font-medium transition ${
                  active
                    ? "bg-elevated text-neon font-semibold border border-neon/30"
                    : "text-ink/80 hover:bg-elevated/60 hover:text-ink"
                }`}
              >
                <Icon
                  className={`h-5 w-5 ${active ? "text-neon" : "text-muted"}`}
                  strokeWidth={active ? 2.4 : 2}
                />
                <span>{n.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-edge/60 pt-2">
          <p className="mb-2 px-3.5 text-[11px] font-bold uppercase tracking-wider text-muted">
            Mi Espacio
          </p>
          <Link
            href="/home"
            className="flex items-center gap-3 rounded-xl border border-edge bg-elevated/40 px-3.5 py-2.5 text-xs font-medium text-ink transition hover:border-neon/40 hover:text-neon"
          >
            <Home className="h-4 w-4 text-neon" />
            <span>Red social</span>
          </Link>
          <Link
            href="/perfil/editar"
            className="mt-2 flex items-center gap-3 rounded-xl border border-edge bg-elevated/40 px-3.5 py-2.5 text-xs font-medium text-ink transition hover:border-neon/40 hover:text-neon"
          >
            <Settings className="h-4 w-4 text-neon" />
            <span>Editar perfil</span>
          </Link>
        </div>
      </div>

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

function ProfeNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-4 z-40 px-4 md:hidden">
      <div className="mx-auto flex max-w-md items-center justify-center gap-2 rounded-full border border-edge bg-card/90 p-2 shadow-neon backdrop-blur">
        {nav.map((n) => {
          const Icon = n.icon;
          const active = isActive(pathname, n.href);
          return (
            <Link
              key={n.href}
              href={n.href}
              className={`flex grow items-center justify-center gap-2 rounded-full py-2.5 text-sm font-semibold transition ${
                active ? "bg-neon text-bg shadow-neon" : "text-muted"
              }`}
            >
              <Icon className="h-4 w-4" />
              {n.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function TrainingShell({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <div className="flex min-h-screen bg-bg">
        <DesktopSidebar />
        <div className="flex-1 min-w-0 md:pl-64">
          <Header />
          <div className="min-h-screen w-full min-w-0 pb-24 md:pb-8">{children}</div>
        </div>
        <ProfeNav />
      </div>
    </AuthProvider>
  );
}