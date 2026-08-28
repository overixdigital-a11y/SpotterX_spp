"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { UserPlus, Loader2, Users, Building2, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuthState } from "@/lib/auth-context";

interface Student {
  id: string;
  source: "gym" | "propio";
  profile: { id: string; username: string; full_name: string | null; role: string };
}

export default function EntrenamientoPage() {
  const { userId } = useAuthState();
  const [tab, setTab] = useState<"propio" | "gym">("propio");
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Student["profile"][]>([]);

  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    let active = true;
    const load = async () => {
      const { data } = await supabase
        .from("trainer_students")
        .select("id, source, profile:student_id(id, username, full_name, role)")
        .eq("trainer_id", userId);
      if (active && data) setStudents(data as unknown as Student[]);
      if (active) setLoading(false);
    };
    load();
    return () => {
      active = false;
    };
  }, [userId]);

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
    setResults((data as Student["profile"][]) ?? []);
  };

  const addStudent = async (p: Student["profile"]) => {
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

  if (loading) {
    return (
      <main className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-neon" />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md px-4 pt-5">
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
        <UserPlus className="h-4 w-4" /> Agregar alumno ({tab === "propio" ? "propio" : "del gym"})
      </button>

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
    </main>
  );
}
