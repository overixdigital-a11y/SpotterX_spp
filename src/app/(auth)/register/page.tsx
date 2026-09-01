"use client";

import { useState } from "react";
import Link from "next/link";
import { Dumbbell, User, Building2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import type { AppRole } from "@/lib/types";

const roleOptions: {
  role: AppRole;
  label: string;
  desc: string;
  icon: typeof Dumbbell;
}[] = [
  {
    role: "gym",
    label: "Gimnasio",
    desc: "Control de acceso y miembros",
    icon: Building2,
  },
  {
    role: "profesor",
    label: "Profesor",
    desc: "Gestión de alumnos y planes",
    icon: Dumbbell,
  },
  {
    role: "alumno",
    label: "Alumno",
    desc: "Comunidad y entrenamiento",
    icon: User,
  },
];

export default function RegisterPage() {
  const { signUp } = useAuth();
  const [role, setRole] = useState<AppRole>("alumno");
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await signUp({ email, password, username, fullName, role });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear la cuenta");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full max-w-md mx-auto flex-col justify-center px-6 py-8">
      <div className="text-center">
        <h1 className="text-3xl font-extrabold tracking-tight">
          <span className="text-neon text-glow">Creá tu</span>{" "}
          <span className="text-ember">cuenta</span>
        </h1>
        <p className="mt-1 text-sm text-muted">¿Quién sos en SpotterX?</p>
      </div>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <div className="grid grid-cols-3 gap-2">
          {roleOptions.map((opt) => {
            const Icon = opt.icon;
            const active = role === opt.role;
            return (
              <button
                type="button"
                key={opt.role}
                onClick={() => setRole(opt.role)}
                className={`flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3 transition ${
                  active
                    ? "border-neon bg-neon/10 text-neon shadow-neon"
                    : "border-edge bg-card text-muted"
                }`}
              >
                <Icon className="h-6 w-6" />
                <span className="text-xs font-semibold">{opt.label}</span>
              </button>
            );
          })}
        </div>

        <select
          value={role}
          onChange={(e) => setRole(e.target.value as AppRole)}
          className="hidden"
        >
          {roleOptions.map((o) => (
            <option key={o.role} value={o.role}>
              {o.label}
            </option>
          ))}
        </select>

        <div className="space-y-3 pt-1">
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            placeholder="Nombre completo"
            className="w-full rounded-xl border border-edge bg-card px-3.5 py-2.5 text-sm text-ink placeholder:text-muted focus:border-neon focus:outline-none"
          />
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            placeholder="@usuario"
            className="w-full rounded-xl border border-edge bg-card px-3.5 py-2.5 text-sm text-ink placeholder:text-muted focus:border-neon focus:outline-none"
          />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="Email"
            className="w-full rounded-xl border border-edge bg-card px-3.5 py-2.5 text-sm text-ink placeholder:text-muted focus:border-neon focus:outline-none"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            placeholder="Contraseña (mín. 6)"
            className="w-full rounded-xl border border-edge bg-card px-3.5 py-2.5 text-sm text-ink placeholder:text-muted focus:border-neon focus:outline-none"
          />
        </div>

        {roleOptions.find((o) => o.role === role) && (
          <p className="text-xs text-muted">
            {roleOptions.find((o) => o.role === role)!.desc}
          </p>
        )}

        {error && <p className="text-sm text-ember">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-neon px-4 py-3 font-semibold text-bg shadow-neon transition active:scale-[0.98] disabled:opacity-60"
        >
          {loading ? "Creando…" : "Crear cuenta"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        ¿Ya tenés cuenta?{" "}
        <Link href="/login" className="font-semibold text-neon">
          Ingresá
        </Link>
      </p>
    </div>
  );
}
