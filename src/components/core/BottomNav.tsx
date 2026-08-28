"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Compass, Plus, Bell, User } from "lucide-react";

const items = [
  { href: "/home", label: "Inicio", icon: Home },
  { href: "/discover", label: "Descubrir", icon: Compass },
  { href: "/crear", label: "Crear", icon: Plus, highlight: true },
  { href: "/notificaciones", label: "Notis", icon: Bell },
  { href: "/perfil", label: "Perfil", icon: User },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-4 z-40 px-4">
      <div className="mx-auto flex max-w-md items-center justify-around rounded-full border border-edge bg-card/90 px-2 py-2 shadow-neon backdrop-blur">
        {items.map((item) => {
          const active = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={
                item.highlight
                  ? "flex h-11 w-11 items-center justify-center rounded-full bg-neon text-bg shadow-neon"
                  : `flex h-11 w-11 flex-col items-center justify-center gap-0.5 rounded-full transition ${
                      active ? "text-neon" : "text-muted"
                    }`
              }
            >
              <Icon className="h-5 w-5" strokeWidth={active ? 2.5 : 2} />
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
