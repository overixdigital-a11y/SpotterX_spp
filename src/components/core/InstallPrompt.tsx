"use client";

import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Si ya esta corriendo como app instalada (standalone), no mostrar nada
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone ===
        true;

    if (isStandalone) return;

    // Verificar si el usuario ya cerro el aviso en esta sesion
    if (sessionStorage.getItem("spotterx_pwa_dismissed")) return;

    // Detectar iOS (Safari no emite beforeinstallprompt)
    const ua = window.navigator.userAgent;
    const isAppleMobile =
      /iPad|iPhone|iPod/.test(ua) &&
      !(window as unknown as { MSStream?: unknown }).MSStream;

    // Escuchar el evento oficial en Chrome / Android
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setVisible(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);

    if (isAppleMobile) {
      // En iOS mostramos el tip tras unos segundos de navegacion
      const timer = setTimeout(() => {
        setIsIOS(true);
        setVisible(true);
      }, 3000);
      return () => {
        clearTimeout(timer);
        window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      };
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setVisible(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    sessionStorage.setItem("spotterx_pwa_dismissed", "1");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      className="fixed inset-x-3 top-3 z-50 mx-auto max-w-md animate-in fade-in slide-in-from-top-4 duration-300"
      style={{ top: "calc(0.75rem + env(safe-area-inset-top, 0px))" }}
    >
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-neon/30 bg-card/95 px-3.5 py-2.5 shadow-neon backdrop-blur-md">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-neon/10 text-neon">
            <Download className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold leading-snug text-ink">
              Instalá SpotterX en tu cel
            </p>
            <p className="truncate text-[11px] text-muted">
              {isIOS
                ? "Tocá Compartir y luego 'Agregar a inicio'"
                : "Acceso rápido y pantalla completa"}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {deferredPrompt && (
            <button
              onClick={handleInstallClick}
              className="rounded-xl bg-neon px-3 py-1.5 text-xs font-bold text-bg shadow-neon transition active:scale-95"
            >
              Instalar
            </button>
          )}

          {isIOS && (
            <div className="flex items-center gap-1 rounded-lg bg-elevated px-2 py-1 text-[11px] font-medium text-neon">
              <Share className="h-3.5 w-3.5" />
              <span>Compartir</span>
            </div>
          )}

          <button
            onClick={handleDismiss}
            aria-label="Cerrar"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-muted transition hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
