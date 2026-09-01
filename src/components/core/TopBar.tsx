"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { Menu, LogOut, User } from "lucide-react";
import { useState } from "react";

const titles: Record<string, string> = {
  "/home": "SpotterX",
  "/discover": "Descubrir",
  "/crear": "Crear contenido",
  "/notificaciones": "Notificaciones",
  "/perfil": "Mi perfil",
};

export function TopBar({ onLogout }: { onLogout?: () => void }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const title = titles[pathname] ?? "SpotterX";

  return (
    <header className="sticky top-0 z-30 border-b border-edge bg-bg/95 backdrop-blur md:hidden">
      <div className="mx-auto flex max-w-md items-center justify-between px-4 py-3">
        <button
          onClick={() => setOpen((v) => !v)}
          className="text-ink"
          aria-label="Menú"
        >
          <Menu className="h-6 w-6" />
        </button>

        <Link href="/home" className="text-lg font-bold tracking-tight">
          <span className="text-neon text-glow">Spotter</span>
          <span className="text-ember">X</span>
        </Link>

        <button className="text-muted" aria-label="Cuenta">
          <User className="h-6 w-6" />
        </button>
      </div>

      {open && (
        <div className="border-t border-edge bg-card">
          <div className="mx-auto max-w-md px-4 py-2">
            <p className="px-2 py-1 text-sm font-semibold text-muted">{title}</p>
            {onLogout && (
              <button
                onClick={onLogout}
                className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left text-sm font-medium text-ember hover:bg-elevated"
              >
                <LogOut className="h-4 w-4" />
                Cerrar sesión
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
