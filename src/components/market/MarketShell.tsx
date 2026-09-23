"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Store,
  Plus,
  Tag,
  ShoppingBag,
  Wallet,
  ShoppingCart,
  Shield,
  Home,
  LogOut,
} from "lucide-react";
import { AuthProvider, useAuthState } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";

const nav = [
  { href: "/market", label: "Productos", icon: Store },
  { href: "/market/crear", label: "Crear producto", icon: Plus, highlight: true },
  { href: "/market/mis-publicaciones", label: "Mis ventas", icon: Tag },
  { href: "/market/mis-compras", label: "Mis compras", icon: ShoppingBag },
  { href: "/market/billetera", label: "Billetera", icon: Wallet },
  { href: "/market/carrito", label: "Carrito", icon: ShoppingCart },
];

const pillNav = [
  { href: "/market", label: "Productos", icon: Store },
  { href: "/market/crear", label: "Crear", icon: Plus, highlight: true },
  { href: "/market/mis-publicaciones", label: "Ventas", icon: Tag },
  { href: "/market/mis-compras", label: "Compras", icon: ShoppingBag },
  { href: "/market/carrito", label: "Carrito", icon: ShoppingCart },
];

function activeHref(pathname: string, items: { href: string }[]) {
  return items
    .map((i) => i.href)
    .filter((h) => pathname === h || pathname.startsWith(h + "/"))
    .sort((a, b) => b.length - a.length)[0];
}

function DesktopSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { profile } = useAuthState();
  const current = activeHref(pathname, nav);

  const onLogout = async () => {
    await createClient().auth.signOut();
    router.refresh();
    router.push("/login");
  };

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col justify-between border-r border-edge bg-card/60 p-5 backdrop-blur md:flex">
      <div className="space-y-6">
        <Link href="/market" className="flex items-center gap-2 px-2">
          <span className="text-2xl font-black tracking-tight">
            <span className="text-neon text-glow">Spotter</span>
            <span className="text-ember">X</span>
          </span>
          <span className="rounded-full bg-ember/10 px-2 py-0.5 text-[10px] font-bold text-ember uppercase tracking-wider">
            Market
          </span>
        </Link>

        <nav className="space-y-1.5">
          {nav.map((n) => {
            const Icon = n.icon;
            const active = current === n.href;

            if (n.highlight) {
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  className="my-3 flex items-center justify-center gap-2 rounded-xl bg-neon px-4 py-3 text-sm font-bold text-bg shadow-neon transition hover:opacity-90 active:scale-[0.98]"
                >
                  <Plus className="h-5 w-5" strokeWidth={2.5} />
                  <span>Crear producto</span>
                </Link>
              );
            }

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

          {profile?.is_admin && (
            <Link
              href="/market/admin"
              className={`flex items-center gap-3.5 rounded-xl px-3.5 py-3 text-sm font-medium transition ${
                current === "/market/admin"
                  ? "bg-elevated text-neon font-semibold border border-neon/30"
                  : "text-ink/80 hover:bg-elevated/60 hover:text-ink"
              }`}
            >
              <Shield
                className={`h-5 w-5 ${current === "/market/admin" ? "text-neon" : "text-muted"}`}
                strokeWidth={current === "/market/admin" ? 2.4 : 2}
              />
              <span>Admin</span>
            </Link>
          )}
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

function MarketPill() {
  const pathname = usePathname();
  const current = activeHref(pathname, pillNav);

  return (
    <nav className="fixed inset-x-0 bottom-4 z-40 px-4 md:hidden">
      <div className="mx-auto flex max-w-md items-center justify-center gap-1 rounded-full border border-edge bg-card/90 p-2 shadow-neon backdrop-blur">
        {pillNav.map((n) => {
          const Icon = n.icon;
          const active = current === n.href;
          return (
            <Link
              key={n.href}
              href={n.href}
              className={`flex grow items-center justify-center gap-1 rounded-full px-1 py-2 text-[11px] font-semibold transition ${
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

export function MarketShell({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <div className="flex min-h-screen bg-bg">
        <DesktopSidebar />
        <div className="flex-1 min-w-0 md:pl-64 pb-24 md:pb-8">{children}</div>
        <MarketPill />
      </div>
    </AuthProvider>
  );
}