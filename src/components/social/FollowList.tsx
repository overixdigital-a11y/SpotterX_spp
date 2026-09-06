"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, UserPlus, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuthState } from "@/lib/auth-context";
import { Avatar } from "@/components/core/Avatar";
import { BottomSheet } from "@/components/core/BottomSheet";
import { useToast } from "@/components/core/ToastProvider";

interface Person {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  role: string;
}

interface FollowListProps {
  open: boolean;
  mode: "followers" | "following";
  ownerId: string;
  onClose: () => void;
}

export function FollowList({ open, mode, ownerId, onClose }: FollowListProps) {
  const { userId } = useAuthState();
  const toast = useToast();
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewerFollows, setViewerFollows] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) return;
    const supabase = createClient();
    let active = true;
    (async () => {
      await Promise.resolve();
      setViewerFollows(new Set());
      setLoading(true);
      const embed =
        mode === "followers"
          ? "follower:profiles!follows_follower_id_fkey(id, username, full_name, avatar_url, role)"
          : "following:profiles!follows_following_id_fkey(id, username, full_name, avatar_url, role)";
      const filterCol = mode === "followers" ? "following_id" : "follower_id";
      const { data } = await supabase
        .from("follows")
        .select(embed)
        .eq(filterCol, ownerId)
        .order("created_at", { ascending: false })
        .limit(100);
      if (!active) return;
      const rows = (data ?? []) as unknown as {
      follower?: Person | null;
      following?: Person | null;
    }[];
      const list = rows
        .map((r) => (mode === "followers" ? r.follower : r.following))
        .filter((p): p is Person => !!p && !!p.id);
      setPeople(list);

      if (userId && list.length > 0) {
        const { data: mine } = await supabase
          .from("follows")
          .select("following_id")
          .eq("follower_id", userId)
          .in("following_id", list.map((p) => p.id));
        if (active) setViewerFollows(new Set((mine ?? []).map((f) => f.following_id)));
      }
      if (active) setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [open, mode, ownerId, userId]);

  const toggle = async (p: Person) => {
    if (!userId || p.id === userId) return;
    const supabase = createClient();
    const next = new Set(viewerFollows);
    if (next.has(p.id)) {
      next.delete(p.id);
      setViewerFollows(next);
      const { error } = await supabase
        .from("follows")
        .delete()
        .eq("follower_id", userId)
        .eq("following_id", p.id);
      if (error) toast("No se pudo actualizar", "error");
    } else {
      next.add(p.id);
      setViewerFollows(next);
      const { error } = await supabase
        .from("follows")
        .insert({ follower_id: userId, following_id: p.id });
      if (error) toast("No se pudo seguir", "error");
    }
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={mode === "followers" ? "Seguidores" : "Siguiendo"}
    >
      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-neon" />
        </div>
      ) : people.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted">
          {mode === "followers" ? "Sin seguidores todavía." : "No sigue a nadie todavía."}
        </p>
      ) : (
        <div>
          {people.map((p) => {
            const isSelf = userId === p.id;
            const followed = viewerFollows.has(p.id);
            return (
              <div key={p.id} className="flex items-center gap-3 border-b border-edge py-2.5">
                <Link href={`/perfil/${p.username}`} className="flex min-w-0 flex-1 items-center gap-3">
                  <Avatar src={p.avatar_url} name={p.full_name} username={p.username} size="sm" ring={false} />
                  <div className="min-w-0 leading-tight">
                    <p className="truncate text-sm font-semibold text-ink">
                      {p.full_name || p.username}
                    </p>
                    <p className="truncate text-xs text-muted">@{p.username} · {p.role}</p>
                  </div>
                </Link>
                {!isSelf && (
                  <button
                    onClick={() => toggle(p)}
                    className={`flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
                      followed
                        ? "border border-edge bg-card text-ink"
                        : "bg-neon text-bg shadow-neon"
                    }`}
                  >
                    {followed ? <Check className="h-3.5 w-3.5" /> : <UserPlus className="h-3.5 w-3.5" />}
                    {followed ? "Siguiendo" : "Seguir"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </BottomSheet>
  );
}