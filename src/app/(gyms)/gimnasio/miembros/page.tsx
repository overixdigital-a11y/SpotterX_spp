"use client";

import { useEffect, useState } from "react";
import { UserPlus, Loader2, KeyRound, Copy, Check, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuthState } from "@/lib/auth-context";

const FUNC_URL = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/invite-member`;

interface Gym {
  id: string;
  name: string | null;
  qr_code: string | null;
}

interface Member {
  user_id: string;
  role: string;
  full_name: string | null;
  email: string | null;
  username: string | null;
  plan_name: string | null;
  status: string | null;
  expires_on: string | null;
}

interface MemberRow {
  user_id: string;
  role?: string | null;
  plan_name?: string | null;
  status?: string | null;
  expires_on?: string | null;
  profiles: ProfileRef[] | null;
}

interface ProfileRef {
  full_name: string | null;
  email: string | null;
  username: string | null;
}

export default function GymMembersPage() {
  const { userId } = useAuthState();
  const [gym, setGym] = useState<Gym | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [result, setResult] = useState<{ email: string; provisional_password: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const [form, setForm] = useState({
    email: "",
    full_name: "",
    username: "",
    role: "alumno",
  });

  useEffect(() => {
    let active = true;
    (async () => {
      if (!userId) return;
      const supabase = createClient();
      const { data: gymData } = await supabase
        .from("gyms")
        .select("id, name, qr_code")
        .eq("owner_id", userId)
        .maybeSingle();
      if (!active || !gymData) {
        if (active) setLoading(false);
        return;
      }
      setGym(gymData as Gym);

      const { data: staff } = await supabase
        .from("gym_staff")
        .select("user_id, role, profiles:profiles!gym_staff_user_id_fkey(full_name, email, username)")
        .eq("gym_id", gymData.id);

      const { data: memberships } = await supabase
        .from("gym_memberships")
        .select("user_id, plan_name, status, expires_on, profiles:profiles!gym_memberships_user_id_fkey(full_name, email, username)")
        .eq("gym_id", gymData.id)
        .order("created_at", { ascending: false });

      const mapMembers = (rows: MemberRow[] | null, type: string): Member[] =>
        (rows ?? []).map((r) => ({
          user_id: r.user_id,
          role: type,
          full_name: r.profiles?.[0]?.full_name ?? null,
          email: r.profiles?.[0]?.email ?? null,
          username: r.profiles?.[0]?.username ?? null,
          plan_name: r.plan_name ?? null,
          status: r.status ?? null,
          expires_on: r.expires_on ?? null,
        }));

      const all = [...mapMembers(staff, "profesor"), ...mapMembers(memberships, "alumno")];
      if (active) setMembers(all);
      if (active) setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [userId]);

  const createMember = async () => {
    if (!gym || !form.email || !form.full_name || !form.username) return;
    setCreating(true);
    setResult(null);
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token;

    const res = await fetch(FUNC_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
      },
      body: JSON.stringify({ ...form, gym_id: gym.id }),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data?.error ?? "No se pudo crear el miembro");
    } else {
      setResult({ email: data.email, provisional_password: data.provisional_password });
      setForm({ email: "", full_name: "", username: "", role: "alumno" });
    }
    setCreating(false);
  };

  const copyPassword = () => {
    if (result) {
      navigator.clipboard.writeText(
        `${result.email} / ${result.provisional_password}`
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  if (loading) {
    return (
      <main className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-neon" />
      </main>
    );
  }

  if (!gym) {
    return (
      <main className="mx-auto max-w-md px-4 pt-10 text-center">
        <p className="text-sm text-muted">Primero creá tu gimnasio desde el panel.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md px-4 pt-5">
      <h1 className="text-xl font-bold text-ink">Miembros</h1>
      <p className="mt-1 text-sm text-muted">Creá las cuentas de tus alumnos y profesores.</p>

      <div className="mt-5 rounded-2xl border border-edge bg-card p-4">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
          <UserPlus className="h-4 w-4 text-neon" /> Alta de miembro
        </p>
        <p className="mt-1 text-xs text-muted">
          Se crea la cuenta al instante. Vas a recibir la contraseña provisional para entregarle.
        </p>

        <div className="mt-3 space-y-2">
          <input
            value={form.full_name}
            onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            placeholder="Nombre completo"
            className="w-full rounded-lg border border-edge bg-elevated px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-neon focus:outline-none"
          />
          <input
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="Email"
            type="email"
            className="w-full rounded-lg border border-edge bg-elevated px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-neon focus:outline-none"
          />
          <input
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value.replace(/\s/g, "") })}
            placeholder="@usuario"
            className="w-full rounded-lg border border-edge bg-elevated px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-neon focus:outline-none"
          />
          <select
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
            className="w-full rounded-lg border border-edge bg-elevated px-3 py-2 text-sm text-ink focus:border-neon focus:outline-none"
          >
            <option value="alumno">Alumno</option>
            <option value="profesor">Profesor</option>
          </select>
          <button
            onClick={createMember}
            disabled={creating || !form.email || !form.full_name || !form.username}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-neon py-2.5 text-sm font-semibold text-bg shadow-neon disabled:opacity-60"
          >
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            Crear cuenta
          </button>
        </div>

        {result && (
          <div className="mt-3 rounded-xl border border-ember/40 bg-ember/10 p-3">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-ember">
              <KeyRound className="h-3.5 w-3.5" /> Cuenta creada
            </p>
            <div className="mt-2 space-y-1 text-sm text-ink">
              <p>
                <span className="text-muted">Email:</span> <span className="font-semibold">{result.email}</span>
              </p>
              <p>
                <span className="text-muted">Contraseña:</span>{" "}
                <span className="font-mono text-neon">{result.provisional_password}</span>
              </p>
            </div>
            <button
              onClick={copyPassword}
              className="mt-2 flex items-center gap-1.5 rounded-lg border border-edge bg-card px-3 py-1.5 text-xs font-medium text-ink"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-neon" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copiado" : "Copiar credenciales"}
            </button>
          </div>
        )}
      </div>

      <div className="mt-6">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
          <Users className="h-4 w-4 text-neon" /> Lista de miembros
        </p>
        {members.length === 0 ? (
          <p className="mt-3 text-xs text-muted">Todavía no hay miembros.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {members.map((m) => (
              <div key={m.user_id} className="flex items-center justify-between rounded-xl border border-edge bg-card p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">{m.full_name ?? m.username ?? m.email}</p>
                  <p className="truncate text-xs text-muted">
                    @{m.username} · {m.email}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      m.role === "profesor" ? "bg-ember/20 text-ember" : "bg-neon/20 text-neon"
                    }`}
                  >
                    {m.role === "profesor" ? "Profesor" : "Alumno"}
                  </span>
                  {m.status && (
                    <span className="text-[10px] text-muted">
                      {m.plan_name ?? "Plan"} · {m.status}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
