"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  Users,
  Shield,
  Dumbbell,
  GraduationCap,
  Package,
  Store,
  ArrowLeft,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const NAV_ITEMS = [
  { href: "/admin", label: "Dashboard", icon: BarChart3 },
  { href: "/admin/usuarios", label: "Usuarios", icon: Users },
  { href: "/admin/moderacion", label: "Moderación", icon: Shield },
  { href: "/admin/gyms", label: "Gyms", icon: Dumbbell },
  { href: "/admin/profes", label: "Profes", icon: GraduationCap },
  { href: "/admin/catalogo", label: "Catálogo", icon: Package },
  { href: "/admin/market", label: "SpotterShop", icon: Store },
] as const;

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  const signOut = async () => {
    await createClient().auth.signOut();
    router.refresh();
    router.push("/login");
  };

  return (
    <div
      className="fixed inset-0 z-50 flex overflow-hidden"
      style={{ background: "#070a0f" }}
    >
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 border-r border-[#1e2530] bg-[#0c1017] lg:flex lg:flex-col">
        <div className="flex h-14 items-center gap-2 border-b border-[#1e2530] px-4">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#00e5c7]/10">
            <Shield className="h-4 w-4 text-[#00e5c7]" />
          </div>
          <span className="text-sm font-bold text-[#e4e8ee]">
            SpotterX<span className="ml-1 text-[10px] font-medium text-[#6b7280]">Consola</span>
          </span>
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-3">
          {NAV_ITEMS.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== "/admin" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition ${
                  active
                    ? "bg-[#00e5c7]/10 text-[#00e5c7]"
                    : "text-[#9ca3af] hover:bg-[#1a1f2e] hover:text-[#d1d5db]"
                }`}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-[#1e2530] px-3 py-3 space-y-0.5">
          <Link
            href="/home"
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium text-[#9ca3af] hover:bg-[#1a1f2e] hover:text-[#d1d5db]"
          >
            <ArrowLeft className="h-4 w-4 shrink-0" />
            Volver a la app
          </Link>
          <button
            onClick={signOut}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium text-[#ef4444]/70 hover:bg-[#1a1f2e] hover:text-[#ef4444]"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 border-r border-[#1e2530] bg-[#0c1017] transition-transform duration-200 lg:hidden ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-14 items-center justify-between border-b border-[#1e2530] px-4">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#00e5c7]/10">
              <Shield className="h-4 w-4 text-[#00e5c7]" />
            </div>
            <span className="text-sm font-bold text-[#e4e8ee]">Consola</span>
          </div>
          <button
            onClick={() => setMobileOpen(false)}
            className="rounded-lg p-1 text-[#6b7280] hover:text-[#d1d5db]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-3">
          {NAV_ITEMS.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== "/admin" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition ${
                  active
                    ? "bg-[#00e5c7]/10 text-[#00e5c7]"
                    : "text-[#9ca3af] hover:bg-[#1a1f2e] hover:text-[#d1d5db]"
                }`}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-[#1e2530] px-3 py-3 space-y-0.5">
          <Link
            href="/home"
            onClick={() => setMobileOpen(false)}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium text-[#9ca3af] hover:bg-[#1a1f2e] hover:text-[#d1d5db]"
          >
            <ArrowLeft className="h-4 w-4 shrink-0" />
            Volver a la app
          </Link>
          <button
            onClick={() => { setMobileOpen(false); signOut(); }}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium text-[#ef4444]/70 hover:bg-[#1a1f2e] hover:text-[#ef4444]"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Main area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-[#1e2530] bg-[#0c1017] px-4 lg:hidden">
          <button
            onClick={() => setMobileOpen(true)}
            className="rounded-lg p-1.5 text-[#9ca3af] hover:bg-[#1a1f2e] hover:text-[#d1d5db]"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-[#00e5c7]/10">
              <Shield className="h-3.5 w-3.5 text-[#00e5c7]" />
            </div>
            <span className="text-sm font-bold text-[#e4e8ee]">Consola Admin</span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
