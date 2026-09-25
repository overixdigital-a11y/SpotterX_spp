"use client";

import Link from "next/link";
import { Menu, User } from "lucide-react";

export function TopBar({ onMenuOpen }: { onMenuOpen?: () => void }) {
  return (
    <header className="sticky top-0 z-30 border-b border-edge bg-bg/95 backdrop-blur md:hidden">
      <div className="mx-auto flex max-w-md items-center justify-between px-4 py-3">
        <button
          onClick={onMenuOpen}
          className="text-ink"
          aria-label="Abrir menú"
        >
          <Menu className="h-6 w-6" />
        </button>

        <Link href="/home" className="flex items-center gap-2">
          <img src="/logo-icon.png" alt="" className="h-7 w-7 object-contain" />
          <span className="text-lg font-bold tracking-tight">
            <span className="text-neon text-glow">Spotter</span>
            <span className="text-ember">X</span>
          </span>
        </Link>

        <Link href="/perfil" className="text-muted" aria-label="Cuenta">
          <User className="h-6 w-6" />
        </Link>
      </div>
    </header>
  );
}