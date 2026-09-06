"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { CheckCircle2, Info, XCircle } from "lucide-react";

type ToastType = "success" | "error" | "info";

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

const ToastContext = createContext<(message: string, type?: ToastType) => void>(
  () => {}
);

export function useToast() {
  return useContext(ToastContext);
}

const toastStyles: Record<ToastType, string> = {
  success: "border-neon/40 bg-card text-ink",
  error: "border-ember/40 bg-card text-ink",
  info: "border-edge bg-card text-ink",
};

const toastIcons: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle2 className="h-4 w-4 shrink-0 text-neon" />,
  error: <XCircle className="h-4 w-4 shrink-0 text-ember" />,
  info: <Info className="h-4 w-4 shrink-0 text-neon" />,
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((message: string, type: ToastType = "success") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
    }, 2600);
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-3 z-[60] flex flex-col items-center gap-2 px-4">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex w-full max-w-md items-center gap-2 rounded-xl border px-4 py-3 text-sm shadow-neon backdrop-blur ${toastStyles[t.type]}`}
          >
            {toastIcons[t.type]}
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}