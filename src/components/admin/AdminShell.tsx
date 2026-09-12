"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Users, Shield, Dumbbell, GraduationCap, Package, Store, ArrowLeft } from "lucide-react";

const NAV_ITEMS = [
  { href: "/admin", label: "Dashboard", icon: BarChart3 },
  { href: "/admin/usuarios", label: "Usuarios", icon: Users },
  { href: "/admin/moderacion", label: "Moderación", icon: Shield },
  { href: "/admin/gyms", label: "Gyms", icon: Dumbbell },
  { href: "/admin/profes", label: "Profes", icon: GraduationCap },
  { href: "/admin/catalogo", label: "Catálogo", icon: Package },
  { href: "/admin/market", label: "Market", icon: Store },
] as const;

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="mx-auto min-h-screen max-w-md bg-bg">
      {/* Header */}
      <div className="sticky top-0 z-40 border-b border-edge bg-bg/90 backdrop-blur">
        <div className="flex items-center gap-3 px-4 py-3">
          <Link href="/market" className="text-muted">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-lg font-bold text-ink">
            <Shield className="mr-1 inline h-4 w-4 text-ember" />
            Admin Panel
          </h1>
        </div>

        {/* Nav tabs */}
        <div className="flex gap-1 overflow-x-auto px-4 pb-2 no-scrollbar">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-[11px] font-semibold transition ${
                  active
                    ? "bg-ember/15 text-ember"
                    : "text-muted hover:bg-card"
                }`}
              >
                <item.icon className="h-3 w-3" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="pb-24">{children}</div>
    </div>
  );
}
