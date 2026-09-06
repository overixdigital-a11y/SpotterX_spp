"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, LogOut, Mail, KeyRound, Trash2, Bell } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuthState } from "@/lib/auth-context";
import { useToast } from "@/components/core/ToastProvider";

const notifOptions: { key: string; label: string; desc: string }[] = [
  { key: "notif_pulse", label: "Pulses", desc: "Cuando alguien da pulse a tu publicación" },
  { key: "notif_comment", label: "Comentarios", desc: "Cuando comentan tu publicación" },
  { key: "notif_follow", label: "Seguidores", desc: "Cuando alguien empieza a seguirte" },
  { key: "notif_message", label: "Mensajes", desc: "Cuando te escriben por chat" },
  { key: "notif_gym_checkin", label: "Ingresos al gym", desc: "Cuando un miembro registra su ingreso" },
];

export default function AjustesPage() {
  const { profile, userId } = useAuthState();
  const router = useRouter();
  const toast = useToast();
  const [email, setEmail] = useState(profile?.email ?? "");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<null | "email" | "password" | "delete" | "signout">(null);
  const [prefs, setPrefs] = useState<Record<string, boolean>>(() => {
    const s = profile?.settings ?? {};
    const out: Record<string, boolean> = {};
    for (const o of notifOptions) out[o.key] = s[o.key as keyof typeof s] !== false;
    return out;
  });

  const changeEmail = async () => {
    if (!email.trim() || busy) return;
    setBusy("email");
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ email: email.trim() });
    setBusy(null);
    if (error) toast(error.message, "error");
    else toast("Te enviamos un correo para confirmar el nuevo email");
  };

  const changePassword = async () => {
    if (password.length < 6 || busy) return;
    setBusy("password");
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(null);
    if (error) {
      toast(
        error.message.includes("recent") ? "Volvé a iniciar sesión y probá de nuevo" : error.message,
        "error"
      );
    } else {
      setPassword("");
      toast("Contraseña actualizada");
    }
  };

  const togglePref = async (key: string, value: boolean) => {
    setPrefs((prev) => ({ ...prev, [key]: value }));
    if (!userId) return;
    const supabase = createClient();
    const next = { ...(profile?.settings ?? {}), [key]: value };
    const { error } = await supabase
      .from("profiles")
      .update({ settings: next })
      .eq("id", userId);
    if (error) toast("No se pudo guardar la preferencia", "error");
  };

  const signOut = async () => {
    if (!userId || busy) return;
    setBusy("signout");
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  const deleteAccount = async () => {
    if (!userId || busy) return;
    if (
      !window.confirm(
        "¿Seguro que querés borrar tu cuenta? Se elimina tu perfil, publicaciones y datos. Esta acción no se puede deshacer."
      )
    )
      return;
    setBusy("delete");
    const supabase = createClient();
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/delete-account`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${session?.access_token ?? ""}` },
        }
      );
      const body = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !body.ok) {
        toast(body.error ?? "No se pudo borrar la cuenta. Corré el deploy de la edge function.", "error");
        setBusy(null);
        return;
      }
      await supabase.auth.signOut();
      router.push("/login");
    } catch {
      toast("No se pudo borrar la cuenta", "error");
      setBusy(null);
    }
  };

  const row = "flex w-full items-center gap-3 rounded-xl border border-edge bg-card px-4 py-3.5 text-left";

  return (
    <main className="mx-auto max-w-md">
      <div className="flex items-center gap-3 px-4 pt-4">
        <Link href="/perfil" className="text-muted hover:text-ink">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-lg font-bold text-ink">Configuración</h1>
      </div>

      <div className="mt-5 space-y-6 px-4">
        {/* Email */}
        <section>
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted">
            <Mail className="h-3.5 w-3.5" /> Cuenta
          </p>
          <div className="mt-2">
            <label className="text-xs font-medium text-muted">Email</label>
            <div className="mt-1 flex gap-2">
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                className="w-full rounded-xl border border-edge bg-card px-3.5 py-2.5 text-sm text-ink focus:border-neon focus:outline-none"
              />
              <button
                onClick={changeEmail}
                disabled={busy !== null || !email.trim()}
                className="shrink-0 rounded-xl bg-neon px-4 py-2.5 text-sm font-semibold text-bg shadow-neon disabled:opacity-50"
              >
                {busy === "email" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Cambiar"}
              </button>
            </div>
            <p className="mt-1 text-[11px] text-muted">
              Vas a recibir un correo para confirmar el cambio.
            </p>
          </div>
        </section>

        {/* Contraseña */}
        <section>
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted">
            <KeyRound className="h-3.5 w-3.5" /> Contraseña
          </p>
          <div className="mt-2">
            <label className="text-xs font-medium text-muted">Nueva contraseña</label>
            <div className="mt-1 flex gap-2">
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                autoComplete="new-password"
                className="w-full rounded-xl border border-edge bg-card px-3.5 py-2.5 text-sm text-ink focus:border-neon focus:outline-none"
              />
              <button
                onClick={changePassword}
                disabled={busy !== null || password.length < 6}
                className="shrink-0 rounded-xl bg-neon px-4 py-2.5 text-sm font-semibold text-bg shadow-neon disabled:opacity-50"
              >
                {busy === "password" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Cambiar"}
              </button>
            </div>
            <p className="mt-1 text-[11px] text-muted">Mínimo 6 caracteres.</p>
          </div>
        </section>

        {/* Preferencias de notificación */}
        <section>
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted">
            <Bell className="h-3.5 w-3.5" /> Notificaciones
          </p>
          <div className="mt-2 overflow-hidden rounded-xl border border-edge">
            {notifOptions.map((o, i) => {
              const on = prefs[o.key] !== false;
              return (
                <button
                  key={o.key}
                  className={`flex w-full items-center justify-between gap-3 bg-card px-4 py-3 text-left ${
                    i > 0 ? "border-t border-edge" : ""
                  }`}
                  onClick={() => togglePref(o.key, !on)}
                >
                  <span>
                    <span className="block text-sm font-medium text-ink">{o.label}</span>
                    <span className="block text-xs text-muted">{o.desc}</span>
                  </span>
                  <span
                    className={`relative h-6 w-11 shrink-0 rounded-full transition ${
                      on ? "bg-neon" : "bg-edge"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 h-5 w-5 rounded-full bg-bg transition-all ${
                        on ? "left-[22px]" : "left-0.5"
                      }`}
                    />
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Sesión */}
        <section>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">Sesión</p>
          <div className="mt-2">
            <button onClick={signOut} disabled={busy !== null} className={row}>
              <LogOut className="h-4 w-4 text-ember" />
              <span className="text-sm font-semibold text-ember">
                {busy === "signout" ? "Saliendo…" : "Cerrar sesión"}
              </span>
            </button>
          </div>
        </section>

        {/* Zona de peligro */}
        <section>
          <p className="text-xs font-semibold uppercase tracking-wider text-ember">Zona de peligro</p>
          <div className="mt-2">
            <button
              onClick={deleteAccount}
              disabled={busy !== null}
              className="flex w-full items-center gap-3 rounded-xl border border-ember/30 bg-ember/10 px-4 py-3.5 text-left"
            >
              <Trash2 className="h-4 w-4 text-ember" />
              <span>
                <span className="block text-sm font-semibold text-ember">
                  {busy === "delete" ? "Borrando…" : "Borrar cuenta"}
                </span>
                <span className="block text-xs text-muted">
                  Elimina tu perfil, publicaciones y todos tus datos.
                </span>
              </span>
            </button>
          </div>
        </section>

        <p className="pb-8 text-center text-[11px] text-muted/60">
          SpotterX · v0.1 · Tus datos son tuyos.
        </p>
      </div>
    </main>
  );
}