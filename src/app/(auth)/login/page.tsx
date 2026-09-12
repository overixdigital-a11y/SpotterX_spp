"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth";

function LoginForm() {
  const { signIn } = useAuth();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? undefined;
  const banned = searchParams.get("banned") === "1";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await signIn(email, password, next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al iniciar sesión");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="text-center">
        <img src="/logofull-transparente.png" alt="SpotterX" className="mx-auto h-24 w-auto" />
        <p className="mt-2 text-sm text-muted">La comunidad fit</p>
      </div>

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
        <div>
          <label className="text-xs font-medium text-muted">Contraseña</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="mt-1 w-full rounded-xl border border-edge bg-card px-3.5 py-2.5 text-sm text-ink placeholder:text-muted focus:border-neon focus:outline-none"
            placeholder="••••••••"
          />
        </div>

        <div className="text-right">
          <Link href="/recuperar" className="text-xs font-medium text-neon hover:underline">
            ¿Olvidaste tu contraseña?
          </Link>
        </div>

        {banned && (
          <div className="rounded-xl border border-ember/30 bg-ember/10 p-3 text-sm text-ember">
            Tu cuenta ha sido suspendida. Contactá al administrador.
          </div>
        )}

        {error && <p className="text-sm text-ember">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-neon px-4 py-3 font-semibold text-bg shadow-neon transition active:scale-[0.98] disabled:opacity-60"
        >
          {loading ? "Ingresando…" : "Ingresar"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        ¿No tenés cuenta?{" "}
        <Link href="/register" className="font-semibold text-neon">
          Crear cuenta
        </Link>
      </p>
    </>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen max-w-md flex-col justify-center px-6">
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}
