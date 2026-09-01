"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Lock, LogIn, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function ActualizarContrasenaPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [validLink, setValidLink] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if ((event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") && session) {
        setValidLink(true);
        setChecking(false);
      }
    });

    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!active) return;
      if (session) {
        setValidLink(true);
        setChecking(false);
        return;
      }
      // Si no hay sesión de arranque, esperamos el intercambio del token.
      // Timeout: si en 10s no llegó, el link es inválido o ya se consumió.
      setTimeout(() => {
        if (!active) return;
        setChecking(false);
      }, 10000);
    })();

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (password !== confirm) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setLoading(true);
    try {
      const { error } = await createClient().auth.updateUser({ password });
      if (error) throw error;
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar la contraseña");
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-neon" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen max-w-md flex-col justify-center px-6">
      <div className="text-center">
        <h1 className="text-3xl font-extrabold tracking-tight">
          <span className="text-neon text-glow">Nueva</span>{" "}
          <span className="text-ember">contraseña</span>
        </h1>
        <p className="mt-1 text-sm text-muted">Elegí una contraseña nueva para tu cuenta.</p>
      </div>

      {!validLink ? (
        <div className="mt-8 rounded-2xl border border-ember/30 bg-ember/10 p-5 text-center">
          <Lock className="mx-auto h-8 w-8 text-ember" />
          <p className="mt-3 text-sm font-semibold text-ink">Link inválido o vencido</p>
          <p className="mt-1 text-xs text-muted">
            Pedí un nuevo link de recuperación desde la pantalla de ingreso.
          </p>
        </div>
      ) : done ? (
        <div className="mt-8 rounded-2xl border border-neon/30 bg-neon/10 p-5 text-center">
          <CheckCircle2 className="mx-auto h-10 w-10 text-neon" />
          <p className="mt-3 text-sm font-semibold text-ink">¡Contraseña actualizada!</p>
          <p className="mt-1 text-xs text-muted">Ya podés iniciar sesión con tu nueva contraseña.</p>
          <button
            onClick={() => router.push("/login")}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-neon px-4 py-3 font-semibold text-bg shadow-neon"
          >
            <LogIn className="h-4 w-4" /> Ir al ingreso
          </button>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <div>
            <label className="text-xs font-medium text-muted">Nueva contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="mt-1 w-full rounded-xl border border-edge bg-card px-3.5 py-2.5 text-sm text-ink placeholder:text-muted focus:border-neon focus:outline-none"
              placeholder="••••••••"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted">Confirmar contraseña</label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              minLength={6}
              className="mt-1 w-full rounded-xl border border-edge bg-card px-3.5 py-2.5 text-sm text-ink placeholder:text-muted focus:border-neon focus:outline-none"
              placeholder="••••••••"
            />
          </div>

          {error && <p className="text-sm text-ember">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-neon px-4 py-3 font-semibold text-bg shadow-neon transition active:scale-[0.98] disabled:opacity-60"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
            {loading ? "Guardando…" : "Guardar contraseña"}
          </button>
        </form>
      )}
    </div>
  );
}