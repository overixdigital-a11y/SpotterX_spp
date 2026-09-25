"use client";

import Link from "next/link";
import { LucideIcon } from "lucide-react";

export function NavRow({
  href,
  icon: Icon,
  label,
  active,
  highlight,
  onClick,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  active?: boolean;
  highlight?: boolean;
  onClick?: () => void;
}) {
  if (highlight) {
    return (
      <Link
        href={href}
        onClick={onClick}
        className="my-3 flex items-center justify-center gap-2 rounded-xl bg-neon px-4 py-3 text-sm font-bold text-bg shadow-neon transition hover:opacity-90 active:scale-[0.98]"
      >
        <Icon className="h-5 w-5" strokeWidth={2.5} />
        <span>{label}</span>
      </Link>
    );
  }

  return (
    <Link
      href={href}
      onClick={onClick}
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
      <span>{label}</span>
    </Link>
  );
}