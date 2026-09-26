"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  UserPlus,
  Loader2,
  Users,
  Building2,
  Search,
  Copy,
  Check,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuthState } from "@/lib/auth-context";
import { useModuleGuard } from "@/lib/gym-modules";
import { BottomSheet } from "@/components/core/BottomSheet";
import { useToast } from "@/components/core/ToastProvider";

interface StudentProfile {
  id: string;
  username: string;
  full_name: string | null;
  role: string;
}

interface Student {
  id: string;
  source: "gym" | "propio";
  profile: StudentProfile;
}

interface CreatedStudent {
  username?: string;
  full_name?: string | null;
  email?: string;
  provisional_password?: string;
  existing?: boolean;
  pending_email?: boolean;
  message?: string;
}

export default function EntrenamientoPage() {
  const { userId } = useAuthState();
  const { busy } = useModuleGuard("entrenamiento");
  const toast = useToast();

  const [tab, setTab] = useState<"propio" | "gym">("propio");
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<StudentProfile[]>([]);

  const [canCreate, setCanCreate] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<CreatedStudent | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    const supabase = createClient();
    const { data: links } = await supabase
      .from("trainer_students")
      .select("id, student_id, source")
      .eq("trainer_id", userId)
      .eq("active", true);

    const rows = (links ?? []) as {
      id: string;
      student_id: string;
      source: string;
    }[];
    const ids = rows.map((r) => r.student_id);

    // Sin embed: los embeds a profiles por nombre de FK fallan en runtime
    // (leccion /mi-gimnasio y /gimnasio/miembros)
    const { data: profiles } = ids.length
      ? await supabase
          .from("profiles")
          .select("id, username, full_name, role")
          .in("id", ids)
      : { data: [] as unknown[] };

    const byId = new Map(
      ((profiles ?? []) as unknown as StudentProfile[]).map((p) => [p.id, p])
    );

    setStudents(
      rows.map((r) => ({
        id: r.id,
        source: (r.source === "gym" ? "gym" : "propio") as "gym" | "propio",
        profile: byId.get(r.student_id) ?? {
          id: r.student_id,
          username: "alumno",
          full_name: null,
          role: "alumno",
        },
      }))
    );
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    (async () => {
      const supabase = createClient();
      const { data: profile } = await supabase
        .from("profiles")
        .select("role, is_admin")
        .eq("id", userId)
        .maybeSingle();
      if (active) {
        setCanCreate(profile?.role === "profesor" || Boolean(profile?.is_admin));
      }
      await load();
      if (active) setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [userId, load]);

  const filtered = students.filter((s) => s.source === tab);

  const search = async (text: string) => {
    setQ(text);
    if (!text.trim()) {
      setResults([]);
      return;
    }
    const supabase = createClient();
    const { data } = await supabase
      .from("profiles")
      .select("id, username, full_name, role")
      .eq("role", "alumno")
      .or(`username.ilike.%${text}%,full_name.ilike.%${text}%`)
      .limit(8);
    setResults((data as StudentProfile[]) ?? []);
  };

  const addStudent = async (p: StudentProfile) => {
    if (!userId) return;
    const supabase = createClient();
    const { data, error } = await supabase
      .from("trainer_students")
      .insert({ trainer_id: userId, student_id: p.id, source: tab, active: true })
      .select()
      .maybeSingle();
    if (!error && data) {
      setStudents((prev) => [
        ...prev,
        { id: data.id as string, source: tab, profile: p },
      ]);
    }
    setResults([]);
    setQ("");
    setAdding(false);
  };

  const createStudent = async () => {
    const full = `${firstName.trim()} ${lastName.trim()}`.trim();
    if (full.length < 3) {
      toast("Escribí el nombre y el apellido del alumno", "error");
      return;
    }
    setCreating(true);
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const res = await fetch("/api/trainer/students", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token ?? ""}`,
        },
        body: JSON.stringify({ full_name: full, email: email.trim() }),
      });
      const data = await res.json();

      if (!res.ok) {
        toast(data?.error ?? "No se pudo crear el alumno", "error");
        return;
      }

      setCreated(data as CreatedStudent);
      setFirstName("");
      setLastName("");
      setEmail("");
      setCreateOpen(false);
      await load();
      toast(data?.message ?? "Alumno creado", "success");
    } catch {
      toast("No se pudo crear el alumno", "error");
    } finally {
      setCreating(false);
    }
  };

  const copyCredentials = () => {
    if (!created?.email || !created?.provisional_password) return;
    const lines = [
      `Email: ${created.email}`,
      `Clave: ${created.provisional_password}`,
    ];
    if (created.username) lines.push(`Usuario: @${created.username}`);
    navigator.clipboard.writeText(lines.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  if (loading) {
    return (
      <main className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-neon" />
      </main>
    );
  }

  if (busy) {
    return (
      <main className="flex justify-center pt-20">
        <Loader2 className="h-6 w-6 animate-spin text-neon" />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-xl px-4 pt-5 md:max-w-2xl lg:max-w-3xl">
      <h1 className="text-xl font-bold text-ink">Mis alumnos</h1>

      {/* Tabs */}
      <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-card p-1">
        <button
          onClick={() => setTab("propio")}
          className={`flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition ${
            tab === "propio" ? "bg-neon text-bg shadow-neon" : "text-muted"
          }`}
        >
          <Users className="h-4 w-4" /> Propios
        </button>
        <button
          onClick={() => setTab("gym")}
          className={`flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition ${
            tab === "gym" ? "bg-ember text-bg shadow-ember" : "text-muted"
          }`}
        >
          <Building2 className="h-4 w-4" /> Del gym
        </button>
      </div>

      {/* Agregar */}
      <button
        onClick={() => setAdding((v) => !v)}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-edge bg-card py-3 text-sm font-medium text-neon"
      >
        <Search className="h-4 w-4" /> Agregar alumno ({tab === "propio" ? "propio" : "del gym"})
      </button>

      {canCreate && tab === "propio" && (
        <button
          onClick={() => setCreateOpen(true)}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-neon/40 bg-neon/10 py-3 text-sm font-semibold text-neon"
        >
          <UserPlus className="h-4 w-4" /> Crear cuenta de alumno
        </button>
      )}

      {adding && (
        <div className="mt-3 rounded-xl border border-edge bg-card p-3">
          <div className="flex items-center gap-2 rounded-lg border border-edge bg-bg px-3 py-2">
            <Search className="h-4 w-4 text-muted" />
            <input
              value={q}
              onChange={(e) => search(e.target.value)}
              placeholder="Buscar alumno por nombre o @usuario"
              className="w-full bg-transparent text-sm text-ink placeholder:text-muted focus:outline-none"
            />
          </div>
          {results.length > 0 && (
            <div className="mt-2">
              {results.map((r) => {
                const already = students.some(
                  (s) => s.profile.id === r.id && s.source === tab
                );
                return (
                  <div
                    key={r.id}
                    className="flex items-center justify-between border-b border-edge py-2"
                  >
                    <div>
                      <p className="text-sm font-medium text-ink">
                        {r.full_name || r.username}
                      </p>
                      <p className="text-xs text-muted">@{r.username}</p>
                    </div>
                    {already ? (
                      <span className="text-xs text-muted">Ya agregado</span>
                    ) : (
                      <button
                        onClick={() => addStudent(r)}
                        className="rounded-lg bg-neon/15 px-3 py-1.5 text-xs font-semibold text-neon"
                      >
                        Agregar
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Credenciales de la cuenta recien creada */}
      {created && (
        <div className="mt-4 rounded-xl border border-neon/40 bg-card p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-neon">
                {created.existing ? "Alumno vinculado" : "Alumno creado"}
              </p>
              <p className="text-xs text-muted">
                {created.full_name || created.username}
              </p>
            </div>
            <button
              onClick={() => setCreated(null)}
              className="rounded-lg p-1 text-muted hover:text-ink"
              aria-label="Cerrar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {created.provisional_password && created.email ? (
            <>
              <div className="mt-3 space-y-1 rounded-lg bg-bg p-3 text-xs">
                <p className="text-muted">
                  Email: <span className="font-semibold text-ink">{created.email}</span>
                </p>
                <p className="text-muted">
                  Clave:{" "}
                  <span className="font-semibold text-neon">
                    {created.provisional_password}
                  </span>
                </p>
                {created.username && (
                  <p className="text-muted">
                    Usuario:{" "}
                    <span className="font-semibold text-ink">@{created.username}</span>
                  </p>
                )}
              </div>
              <button
                onClick={copyCredentials}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-neon py-2.5 text-sm font-semibold text-bg shadow-neon"
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copiado" : "Copiar credenciales"}
              </button>
              <p className="mt-2 text-[11px] text-muted">
                {created.pending_email
                  ? "Como no cargaste email, entro con el email provisorio de arriba. Despues puede cambiarlo en Configuracion de su cuenta."
                  : "Compartile estas credenciales para que entre a su cuenta."}
              </p>
            </>
          ) : (
            <p className="mt-2 text-xs text-muted">{created.message}</p>
          )}
        </div>
      )}

      {/* Lista */}
      <div className="mt-4">
        {filtered.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted">
            No tenés alumnos {tab === "propio" ? "propios" : "del gym"} todavía.
          </p>
        ) : (
          filtered.map((s) => (
            <Link
              key={s.id}
              href={`/entrenamiento/alumno/${s.profile.id}`}
              className="flex items-center gap-3 border-b border-edge py-3"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-neon/20 text-sm font-bold text-neon">
                {(s.profile.full_name || s.profile.username)
                  .slice(0, 2)
                  .toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-semibold text-ink">
                  {s.profile.full_name || s.profile.username}
                </p>
                <p className="text-xs text-muted">@{s.profile.username}</p>
              </div>
              <span className="ml-auto rounded-full border border-edge px-2.5 py-0.5 text-[11px] text-muted">
                {s.source === "propio" ? "Propio" : "Gym"}
              </span>
            </Link>
          ))
        )}
      </div>

      {/* Crear cuenta de alumno */}
      <BottomSheet
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Crear cuenta de alumno"
      >
        <p className="text-xs text-muted">
          Se crea la cuenta y queda en tu lista de alumnos propios. El alumno carga
          sus datos la primera vez que entra.
        </p>

        <div className="mt-4 space-y-3">
          <input
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="Nombre"
            className="w-full rounded-lg border border-edge bg-card px-3 py-2.5 text-sm text-ink placeholder:text-muted focus:border-neon focus:outline-none"
          />
          <input
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder="Apellido"
            className="w-full rounded-lg border border-edge bg-card px-3 py-2.5 text-sm text-ink placeholder:text-muted focus:border-neon focus:outline-none"
          />
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email (opcional)"
            inputMode="email"
            autoCapitalize="none"
            className="w-full rounded-lg border border-edge bg-card px-3 py-2.5 text-sm text-ink placeholder:text-muted focus:border-neon focus:outline-none"
          />
        </div>

        <button
          onClick={createStudent}
          disabled={creating}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-neon py-3 text-sm font-semibold text-bg shadow-neon disabled:opacity-60"
        >
          {creating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <UserPlus className="h-4 w-4" />
          )}
          {creating ? "Creando..." : "Crear alumno"}
        </button>
      </BottomSheet>
    </main>
  );
}
