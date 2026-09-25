"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

export function MobileDrawer({
  open,
  onClose,
  brand,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  brand?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <div className={`fixed inset-0 z-50 md:hidden ${open ? "" : "pointer-events-none"}`}>
      <div
        className={`absolute inset-0 bg-black/60 transition-opacity duration-200 ${
          open ? "opacity-100" : "opacity-0"
        }`}
        onClick={onClose}
      />
      <aside
        className={`absolute inset-y-0 left-0 flex w-64 max-w-[85vw] flex-col border-r border-edge bg-card/95 backdrop-blur transition-transform duration-200 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-edge px-4 py-3">
          {brand ?? (
            <span className="text-lg font-bold tracking-tight">
              <span className="text-neon text-glow">Spotter</span>
              <span className="text-ember">X</span>
            </span>
          )}
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-muted transition hover:text-ink"
            aria-label="Cerrar menú"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">{children}</div>
        {footer && <div className="border-t border-edge p-4">{footer}</div>}
      </aside>
    </div>
  );
}