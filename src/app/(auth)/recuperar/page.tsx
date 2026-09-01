"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail, ChevronLeft, Loader2, KeyRound } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function RecuperarPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const redirectTo = `${window.location.origin}/actualizar-contrasena`;
      const { error } = await createClient().auth.resetPasswordForEmail(email.trim(), {
        redirectTo,
      });
      if (error) throw error;
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo enviar el correo de recuperación");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen max-w-md flex-col justify-center px-6">
      <div className="text-center">
        <h1 className="text-3xl font-extrabold tracking-tight">
          <span className="text-neon text-glow">Recuperá</span>{" "}
          <span className="text-ember">tu contraseña</span>
        </h1>
        <p className="mt-1 text-sm text-muted">Te enviamos un correo para cambiarla.</p>
      </div>

      {sent ? (
        <div className="mt-8 rounded-2xl border border-neon/30 bg-neon/10 p-5 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-neon/20 text-neon">
            <Mail className="h-6 w-6" />
          </div>
          <p className="mt-3 text-sm font-semibold text-ink">Revisá tu correo</p>
          <p className="mt-1 text-xs text-muted">
            Si existe una cuenta para <span className="font-medium text-neon">{email}</span>, enviamos el
            link para restablecer la contraseña.
          </p>
          <Link
            href="/login"
            className="mt-4 inline-block rounded-xl bg-neon px-4 py-2.5 text-sm font-semibold text-bg shadow-neon"
          >
            Volver a ingresar
          </Link>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <div>
            <label className="text-xs font-medium text-muted">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1 w-full rounded-xl border border-edge bg-card px-3.5 py-2.5 text-sm text-ink placeholder:text-muted focus:border-neon focus:outline-none"
              placeholder="tu@email.com"
            />
          </div>

          {error && <p className="text-sm text-ember">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-neon px-4 py-3 font-semibold text-bg shadow-neon transition active:scale-[0.98] disabled:opacity-60"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
            {loading ? "Enviando…" : "Enviar link de recuperación"}
          </button>
        </form>
      )}

      <Link
        href="/login"
        className="mt-6 flex items-center justify-center gap-1 text-sm text-muted hover:text-neon"
      >
        <ChevronLeft className="h-4 w-4" /> Volver al ingreso
      </Link>
    </div>
  );
}