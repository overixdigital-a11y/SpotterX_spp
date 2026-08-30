"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, Users, Receipt, QrCode, Activity } from "lucide-react";
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
    <header className="sticky top-0 z-30 border-b border-edge bg-bg/95 backdrop-blur">
      <div className="mx-auto flex max-w-md items-center justify-between px-4 py-3">
        <span className="text-lg font-bold tracking-tight">
          <span className="text-neon text-glow">Spotter</span>
          <span className="text-ember">X</span>
        </span>
        <span className="rounded-full border border-neon/40 bg-neon/10 px-3 py-1 text-xs font-semibold text-neon">
          Gimnasio
        </span>
        <button onClick={onLogout} className="text-xs font-medium text-muted hover:text-ember">
          Salir
        </button>
      </div>
    </header>
  );
}

const nav = [
  { href: "/gimnasio", label: "Panel", icon: LayoutDashboard },
  { href: "/gimnasio/miembros", label: "Miembros", icon: Users },
  { href: "/gimnasio/planes", label: "Planes", icon: Receipt },
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
