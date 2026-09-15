"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Search,
  BadgeCheck,
  Ban,
  Trash2,
  Loader2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const FUNC_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL +
  "/functions/v1/admin-delete-user";

interface UserRow {
  id: string;
  username: string;
  full_name: string | null;
  email: string | null;
  role: string;
  is_verified: boolean;
  is_banned: boolean;
  is_admin: boolean;
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
        .select(
          "id, username, full_name, email, role, is_verified, is_banned, is_admin, avatar_url, created_at"
        )
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
    await supabase.rpc("admin_set_verified", {
      p_user_id: u.id,
      p_verified: !u.is_verified,
    });
    setUsers((prev) =>
      prev.map((x) =>
        x.id === u.id ? { ...x, is_verified: !x.is_verified } : x
      )
    );
    setBusy(null);
  };

  const toggleBan = async (u: UserRow) => {
    if (
      !confirm(
        u.is_banned
          ? `¿Desbanear a @${u.username}?`
          : `¿Banear a @${u.username}?`
      )
    )
      return;
    setBusy(u.id);
    const supabase = createClient();
    const { data } = await supabase.rpc("admin_toggle_ban", {
      p_user_id: u.id,
    });
    setUsers((prev) =>
      prev.map((x) =>
        x.id === u.id ? { ...x, is_banned: !!data } : x
      )
    );
    setBusy(null);
  };

  const deleteUser = async (u: UserRow) => {
    if (u.is_admin) {
      alert("No se puede eliminar una cuenta de administrador.");
      return;
    }
    if (
      !confirm(
        `¿Eliminar a @${u.username}? Esta acción es permanente y borra toda su data.`
      )
    )
      return;
    setBusy(u.id);
    try {
      const supabase = createClient();
      const token = (
        await supabase.auth.getSession()
      ).data.session?.access_token;
      const res = await fetch(FUNC_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ user_id: u.id }),
      });
      const data = await res.json();
      if (data.error) {
        alert(`Error: ${data.error}`);
      } else {
        setUsers((prev) => prev.filter((x) => x.id !== u.id));
      }
    } catch {
      alert("Error de red al eliminar la cuenta.");
    }
    setBusy(null);
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 animate-pulse rounded-lg bg-[#121722]" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6b7280]" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre, @ o email..."
          className="w-full rounded-lg border border-[#1e2530] bg-[#121722] py-2.5 pl-10 pr-3 text-sm text-[#e4e8ee] placeholder:text-[#6b7280] focus:border-[#00e5c7]/50 focus:outline-none"
        />
      </div>

      <p className="text-xs text-[#6b7280]">
        {filtered.length} usuario{filtered.length !== 1 ? "s" : ""}
      </p>

      <div className="overflow-hidden rounded-lg border border-[#1e2530]">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[#1e2530] bg-[#0c1017]">
              <th className="px-4 py-2.5 text-xs font-medium text-[#9ca3af]">
                Usuario
              </th>
              <th className="hidden px-4 py-2.5 text-xs font-medium text-[#9ca3af] sm:table-cell">
                Rol
              </th>
              <th className="hidden px-4 py-2.5 text-xs font-medium text-[#9ca3af] md:table-cell">
                Creado
              </th>
              <th className="px-4 py-2.5 text-xs font-medium text-[#9ca3af]">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <tr
                key={u.id}
                className="border-b border-[#1e2530]/50 last:border-0 hover:bg-[#121722]/50"
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-sm font-medium text-[#e4e8ee]">
                          {u.full_name ?? u.username}
                        </span>
                        {u.is_verified && (
                          <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-[#00e5c7]" />
                        )}
                        {u.is_banned && (
                          <Ban className="h-3.5 w-3.5 shrink-0 text-[#ef4444]" />
                        )}
                      </div>
                      <p className="text-xs text-[#6b7280]">
                        @{u.username} · {u.email}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="hidden px-4 py-3 sm:table-cell">
                  <span className="rounded-md bg-[#1a1f2e] px-2 py-0.5 text-[11px] font-medium text-[#9ca3af]">
                    {u.role}
                  </span>
                </td>
                <td className="hidden px-4 py-3 md:table-cell">
                  <span className="text-xs text-[#6b7280]">
                    {new Date(u.created_at).toLocaleDateString("es-AR")}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1.5">
                    <Link
                      href={`/perfil/${u.username}`}
                      className="rounded-md border border-[#1e2530] px-2 py-1 text-[11px] font-medium text-[#9ca3af] hover:border-[#00e5c7]/50 hover:text-[#d1d5db]"
                    >
                      Perfil
                    </Link>
                    <button
                      onClick={() => toggleVerify(u)}
                      disabled={busy === u.id}
                      className={`rounded-md px-2 py-1 text-[11px] font-medium ${
                        u.is_verified
                          ? "bg-[#00e5c7]/10 text-[#00e5c7]"
                          : "border border-[#1e2530] text-[#9ca3af] hover:border-[#00e5c7]/50"
                      }`}
                    >
                      {busy === u.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        "Verify"
                      )}
                    </button>
                    <button
                      onClick={() => toggleBan(u)}
                      disabled={busy === u.id}
                      className={`rounded-md px-2 py-1 text-[11px] font-medium ${
                        u.is_banned
                          ? "bg-[#ef4444]/10 text-[#ef4444]"
                          : "border border-[#1e2530] text-[#9ca3af] hover:border-[#ef4444]/50"
                      }`}
                    >
                      {u.is_banned ? "Unban" : "Ban"}
                    </button>
                    <button
                      onClick={() => deleteUser(u)}
                      disabled={busy === u.id || u.is_admin}
                      className="rounded-md px-2 py-1 text-[11px] font-medium text-[#9ca3af] hover:bg-[#ef4444]/10 hover:text-[#ef4444] disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
