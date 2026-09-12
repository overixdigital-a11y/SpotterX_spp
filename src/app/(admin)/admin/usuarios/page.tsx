"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Search,
  BadgeCheck,
  Ban,
  Loader2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface UserRow {
  id: string;
  username: string;
  full_name: string | null;
  email: string | null;
  role: string;
  is_verified: boolean;
  is_banned: boolean;
  avatar_url: string | null;
  created_at: string;
}

export default function AdminUsuariosPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("profiles")
        .select("id, username, full_name, email, role, is_verified, is_banned, avatar_url, created_at")
        .order("created_at", { ascending: false })
        .limit(100);
      if (data) setUsers(data as UserRow[]);
      setLoading(false);
    };
    load();
  }, []);

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    return (
      u.username?.toLowerCase().includes(q) ||
      u.full_name?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q)
    );
  });

  const toggleVerify = async (u: UserRow) => {
    setBusy(u.id);
    const supabase = createClient();
    await supabase.rpc("admin_set_verified", { p_user_id: u.id, p_verified: !u.is_verified });
    setUsers((prev) =>
      prev.map((x) => (x.id === u.id ? { ...x, is_verified: !x.is_verified } : x))
    );
    setBusy(null);
  };

  const toggleBan = async (u: UserRow) => {
    if (!confirm(u.is_banned ? `¿Desbanear a @${u.username}?` : `¿Banear a @${u.username}?`)) return;
    setBusy(u.id);
    const supabase = createClient();
    const { data } = await supabase.rpc("admin_toggle_ban", { p_user_id: u.id });
    setUsers((prev) =>
      prev.map((x) => (x.id === u.id ? { ...x, is_banned: !!data } : x))
    );
    setBusy(null);
  };

  if (loading) {
    return (
      <main className="animate-pulse px-4 pt-5 space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 rounded-xl bg-card" />
        ))}
      </main>
    );
  }

  return (
    <main className="px-4 pt-5 space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre, @ o email..."
          className="w-full rounded-xl border border-edge bg-bg py-2 pl-9 pr-3 text-sm text-ink placeholder:text-muted focus:border-neon focus:outline-none"
        />
      </div>

      <p className="text-xs text-muted">{filtered.length} usuario{filtered.length !== 1 ? "s" : ""}</p>

      {filtered.map((u) => (
        <div key={u.id} className="flex items-center gap-3 rounded-xl border border-edge bg-card p-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <p className="truncate text-sm font-semibold text-ink">{u.full_name ?? u.username}</p>
              {u.is_verified && <BadgeCheck className="h-4 w-4 shrink-0 fill-neon text-bg" />}
              {u.is_banned && <Ban className="h-4 w-4 shrink-0 text-ember" />}
              <span className="rounded-full bg-bg px-2 py-0.5 text-[10px] font-semibold text-muted">
                {u.role}
              </span>
            </div>
            <p className="text-xs text-muted">@{u.username} · {u.email}</p>
          </div>

          <div className="flex shrink-0 gap-1.5">
            <Link
              href={`/perfil/${u.username}`}
              className="rounded-lg border border-edge px-2 py-1 text-[10px] font-semibold text-muted"
            >
              Perfil
            </Link>
            <button
              onClick={() => toggleVerify(u)}
              disabled={busy === u.id}
              className={`rounded-lg px-2 py-1 text-[10px] font-semibold ${
                u.is_verified
                  ? "border border-neon/30 bg-neon/15 text-neon"
                  : "border border-edge text-muted"
              }`}
            >
              {busy === u.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Verify"}
            </button>
            <button
              onClick={() => toggleBan(u)}
              disabled={busy === u.id}
              className={`rounded-lg px-2 py-1 text-[10px] font-semibold ${
                u.is_banned
                  ? "border border-ember/30 bg-ember/15 text-ember"
                  : "border border-edge text-muted"
              }`}
            >
              {u.is_banned ? "Unban" : "Ban"}
            </button>
          </div>
        </div>
      ))}
    </main>
  );
}
