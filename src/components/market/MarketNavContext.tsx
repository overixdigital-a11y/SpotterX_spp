"use client";

import { createContext, useContext } from "react";
import { Menu } from "lucide-react";

const MarketNavContext = createContext<{ open: () => void } | null>(null);

export function MarketNavProvider({ open, children }: { open: () => void; children: React.ReactNode }) {
  return <MarketNavContext.Provider value={{ open }}>{children}</MarketNavContext.Provider>;
}

export function useMarketNav() {
  const ctx = useContext(MarketNavContext);
  if (!ctx) throw new Error("useMarketNav must be used within MarketNavProvider");
  return ctx;
}

export function MarketNavHamburger() {
  const { open } = useMarketNav();
  return (
    <button
      onClick={open}
      className="text-ink transition hover:text-neon"
      aria-label="Abrir menú del market"
    >
      <Menu className="h-5 w-5" />
    </button>
  );
}