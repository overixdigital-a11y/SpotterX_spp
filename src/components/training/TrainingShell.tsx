"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Users, MapPin } from "lucide-react";
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
        <span className="rounded-full border border-ember/40 bg-ember/10 px-3 py-1 text-xs font-semibold text-ember">
          Profesor
        </span>
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
];

function ProfeNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-4 z-40 px-4">
      <div className="mx-auto flex max-w-md items-center justify-center gap-2 rounded-full border border-edge bg-card/90 p-2 shadow-neon backdrop-blur">
        {nav.map((n) => {
          const Icon = n.icon;
          const active = pathname === n.href || pathname.startsWith(n.href + "/");
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
      <Header />
      <div className="min-h-screen pb-24">{children}</div>
      <ProfeNav />
    </AuthProvider>
  );
}
