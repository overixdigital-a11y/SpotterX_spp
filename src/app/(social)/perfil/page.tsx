"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  MapPin,
  ChevronRight,
  Dumbbell,
  Settings,
  Globe,
  BadgeCheck,
  LayoutDashboard,
  ClipboardList,
  Loader2,
  Store,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuthState } from "@/lib/auth-context";
import { Avatar } from "@/components/core/Avatar";
import { ProfileGrid } from "@/components/social/ProfileGrid";
import { FollowList } from "@/components/social/FollowList";
import { getProfileStats, type ProfileStats } from "@/lib/stats";
import { hydratePosts, type PostRow } from "@/lib/posts";
import type { PostData } from "@/components/social/PostCard";
import { parseMentions, formatNumber } from "@/lib/format";

const roleBadge: Record<string, string> = {
  alumno: "text-neon bg-neon/15 border-neon/40",
  profesor: "text-ember bg-ember/15 border-ember/40",
  gym: "text-ink bg-card border-edge",
};

export default function PerfilPage() {
  const { profile, userId } = useAuthState();
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [posts, setPosts] = useState<PostData[]>([]);
  const [list, setList] = useState<"followers" | "following" | null>(null);
  const [ownsGym, setOwnsGym] = useState(false);

  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    let active = true;
    (async () => {
      const [statsRes, postsRes] = await Promise.all([
        getProfileStats(supabase, userId),
        supabase
          .from("posts")
          .select("*, author:user_id(username, full_name, avatar_url)")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(40),
      ]);
      if (!active) return;
      setStats(statsRes);
      const hydrated = await hydratePosts((postsRes.data as unknown as PostRow[]) ?? [], userId);
      if (active) setPosts(hydrated);

      const { data: ownGym } = await supabase.from("gyms").select("id").eq("owner_id", userId).maybeSingle();
      if (active) setOwnsGym(!!ownGym);
    })();
    return () => {
      active = false;
    };
  }, [userId]);

  const renderBio = (bio: string) =>
    parseMentions(bio).map((part, i) =>
      part.handle ? (
        <Link key={i} href={`/perfil/${part.handle}`} className="font-semibold text-neon">
          {part.raw}
        </Link>
      ) : (
        <span key={i}>{part.raw}</span>
      )
    );

  return (
    <main className="mx-auto max-w-md">
      <div className="flex items-center gap-4 px-4 pt-4">
        <Avatar
          src={profile?.avatar_url}
          name={profile?.full_name}
          username={profile?.username}
          size="xl"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h1 className="truncate text-xl font-bold text-ink">
              {profile?.full_name || profile?.username}
            </h1>
            {profile?.is_verified && (
              <BadgeCheck className="h-5 w-5 shrink-0 fill-neon text-bg" />
            )}
          </div>
          <p className="text-sm text-muted">@{profile?.username}</p>
          {profile?.role && (
            <span
              className={`mt-1 inline-block rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize ${roleBadge[profile.role] ?? roleBadge.alumno}`}
            >
              {profile.role === "gym" ? "Gimnasio" : profile.role}
            </span>
          )}
        </div>
        <div className="flex shrink-0 flex-col gap-1.5">
          <Link
            href="/perfil/editar"
            className="flex items-center gap-1.5 rounded-lg border border-edge bg-card px-2.5 py-1.5 text-xs font-semibold text-ink transition hover:border-neon hover:text-neon"
          >
            <Settings className="h-3.5 w-3.5" /> Editar
          </Link>
          <Link
            href="/perfil/ajustes"
            className="rounded-lg border border-edge bg-card px-2.5 py-1.5 text-center text-[11px] font-medium text-muted transition hover:text-ink"
          >
            Configuración
          </Link>
        </div>
      </div>

      <div className="px-4 pt-3 text-sm text-ink">
        {profile?.bio && <p className="leading-relaxed text-muted">{renderBio(profile.bio)}</p>}
        {(profile?.location || profile?.website) && (
          <div className="mt-2 space-y-1">
            {profile.location && (
              <p className="flex items-center gap-1.5 text-xs text-neon">
                <MapPin className="h-3.5 w-3.5" /> {profile.location}
              </p>
            )}
            {profile.website && (
              <a
                href={profile.website.startsWith("http") ? profile.website : `https://${profile.website}`}
                target="_blank"
                rel="noreferrer"
                className="flex w-fit items-center gap-1.5 text-xs text-neon underline decoration-neon/40"
              >
                <Globe className="h-3.5 w-3.5" /> {profile.website.replace(/^https?:\/\//, "")}
              </a>
            )}
          </div>
        )}
      </div>

      {profile?.role === "alumno" && (
        <Link
          href="/mi-gimnasio"
          className="mx-4 mt-4 flex items-center justify-between rounded-2xl border border-neon/30 bg-neon/10 p-3.5"
        >
          <p className="flex items-center gap-2 text-sm font-semibold text-ink">
            <span className="rounded-full bg-neon/20 p-1.5 text-neon">
              <Dumbbell className="h-4 w-4" />
            </span>
            Mi gimnasio
          </p>
          <ChevronRight className="h-4 w-4 text-neon" />
        </Link>
      )}

      {profile?.role === "alumno" && (
        <Link
          href="/mi-entrenamiento"
          className="mx-4 mt-4 flex items-center justify-between rounded-2xl border border-ember/30 bg-ember/10 p-3.5"
        >
          <p className="flex items-center gap-2 text-sm font-semibold text-ink">
            <span className="rounded-full bg-ember/20 p-1.5 text-ember">
              <ClipboardList className="h-4 w-4" />
            </span>
            Mi entrenamiento
          </p>
          <ChevronRight className="h-4 w-4 text-ember" />
        </Link>
      )}

      {profile?.role === "alumno" && (
        <Link
          href="/mi-entrenamiento/buscar"
          className="mx-4 mt-2 flex items-center justify-between rounded-2xl border border-edge bg-card p-3"
        >
          <p className="flex items-center gap-2 text-sm font-medium text-ink">
            <span className="rounded-full bg-neon/15 p-1.5 text-neon">
              <MapPin className="h-4 w-4" />
            </span>
            Buscar profe por zona
          </p>
          <ChevronRight className="h-4 w-4 text-muted" />
        </Link>
      )}

      {profile?.role === "profesor" && (
        <Link
          href="/entrenamiento/zona"
          className="mx-4 mt-4 flex items-center justify-between rounded-2xl border border-ember/30 bg-ember/10 p-3.5"
        >
          <p className="flex items-center gap-2 text-sm font-semibold text-ink">
            <span className="rounded-full bg-ember/20 p-1.5 text-ember">
              <MapPin className="h-4 w-4" />
            </span>
            Mi zona (gimnasios donde trabajo)
          </p>
          <ChevronRight className="h-4 w-4 text-ember" />
        </Link>
      )}

      {ownsGym && (
        <Link
          href="/gimnasio"
          className="mx-4 mt-4 flex items-center justify-between rounded-2xl border border-neon/30 bg-neon/10 p-3.5"
        >
          <p className="flex items-center gap-2 text-sm font-semibold text-ink">
            <span className="rounded-full bg-neon/20 p-1.5 text-neon">
              <LayoutDashboard className="h-4 w-4" />
            </span>
            Panel del gimnasio
          </p>
          <ChevronRight className="h-4 w-4 text-neon" />
        </Link>
      )}

      <Link
        href="/market"
        className="mx-4 mt-4 flex items-center justify-between rounded-2xl border border-ember/30 bg-ember/10 p-3.5"
      >
        <p className="flex items-center gap-2 text-sm font-semibold text-ink">
          <span className="rounded-full bg-ember/20 p-1.5 text-ember">
            <Store className="h-4 w-4" />
          </span>
          Marketplace
        </p>
        <ChevronRight className="h-4 w-4 text-ember" />
      </Link>

      <div className="mt-5 grid grid-cols-3 divide-x divide-edge border-b border-t border-edge text-center">
        <div className="py-3">
          <p className="text-lg font-bold text-ink">{formatNumber(stats?.posts ?? 0)}</p>
          <p className="text-xs text-muted">Publicaciones</p>
        </div>
        <button className="py-3 transition hover:bg-card" onClick={() => setList("followers")}>
          <p className="text-lg font-bold text-ink">{formatNumber(stats?.followers ?? 0)}</p>
          <p className="text-xs text-muted">Seguidores</p>
        </button>
        <button className="py-3 transition hover:bg-card" onClick={() => setList("following")}>
          <p className="text-lg font-bold text-ink">{formatNumber(stats?.following ?? 0)}</p>
          <p className="text-xs text-muted">Siguiendo</p>
        </button>
      </div>

      {stats === null && posts.length === 0 ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-neon" />
        </div>
      ) : (
        <ProfileGrid posts={posts} />
      )}

      <FollowList
        open={list !== null}
        mode={list ?? "followers"}
        ownerId={userId ?? ""}
        onClose={() => setList(null)}
      />
    </main>
  );
}