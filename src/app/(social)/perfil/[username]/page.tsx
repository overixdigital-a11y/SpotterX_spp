"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { MapPin, UserPlus, Check, MessageCircle, Loader2, Globe, BadgeCheck, Dumbbell } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuthState } from "@/lib/auth-context";
import { Avatar } from "@/components/core/Avatar";
import { ProfileGrid } from "@/components/social/ProfileGrid";
import { FollowList } from "@/components/social/FollowList";
import { getProfileStats, type ProfileStats } from "@/lib/stats";
import { hydratePosts, type PostRow } from "@/lib/posts";
import { parseMentions, formatNumber } from "@/lib/format";
import { useToast } from "@/components/core/ToastProvider";
import type { PostData } from "@/components/social/PostCard";
import GymMap from "@/components/gyms/GymMap";

interface PublicProfile {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  role: string;
  disciplines: string[] | null;
  location: string | null;
  website: string | null;
  is_verified: boolean;
  created_at: string;
}

interface Workplace {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
}

export default function PublicProfilePage() {
  const params = useParams<{ username: string }>();
  const username = params.username;
  const { userId } = useAuthState();
  const toast = useToast();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [posts, setPosts] = useState<PostData[]>([]);
  const [workplaces, setWorkplaces] = useState<Workplace[]>([]);
  const [ownedGym, setOwnedGym] = useState<Workplace | null>(null);
  const [following, setFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [list, setList] = useState<"followers" | "following" | null>(null);

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    (async () => {
      const { data: p } = await supabase
        .from("profiles")
        .select("id, username, full_name, avatar_url, bio, role, disciplines, location, website, is_verified, created_at")
        .eq("username", username)
        .maybeSingle();
      if (!p || !active) {
        if (active) setLoading(false);
        return;
      }
      const prof = p as PublicProfile;
      setProfile(prof);

      const [statsRes, postsRes] = await Promise.all([
        getProfileStats(supabase, prof.id),
        supabase
          .from("posts")
          .select("*, author:user_id(username, full_name, avatar_url)")
          .eq("user_id", prof.id)
          .order("created_at", { ascending: false })
          .limit(40),
      ]);
      if (!active) return;
      setStats(statsRes);
      const hydrated = await hydratePosts((postsRes.data as unknown as PostRow[]) ?? [], userId);
      if (active) setPosts(hydrated);

      if (userId && prof.id !== userId) {
        const { data: f } = await supabase
          .from("follows")
          .select("follower_id")
          .eq("follower_id", userId)
          .eq("following_id", prof.id)
          .maybeSingle();
        if (active) setFollowing(!!f);
      }

      if (prof.role === "profesor") {
        const { data: staff } = await supabase
          .from("gym_staff")
          .select("gym:gyms(id, name, address, city, latitude, longitude)")
          .eq("user_id", prof.id)
          .eq("authorized", true)
          .neq("gym_id", null);
        const { data: zones } = await supabase
          .from("trainer_gyms")
          .select("id, name, address, city, latitude, longitude")
          .eq("trainer_id", prof.id);
        const gyms = ((staff ?? []) as unknown as { gym: Workplace | null }[])
          .map((s) => s.gym)
          .filter((g): g is Workplace => !!g);
        const freeZones = (zones ?? []) as Workplace[];
        const combined = [...gyms, ...freeZones].filter(
          (w, i, arr) => arr.findIndex((x) => x.id === w.id) === i
        );
        if (active) setWorkplaces(combined);
      } else if (prof.role === "gym") {
        const { data: own } = await supabase
          .from("gyms")
          .select("id, name, address, city, latitude, longitude")
          .eq("owner_id", prof.id)
          .maybeSingle();
        if (active) setOwnedGym((own as Workplace | null) ?? null);
      } else {
        if (active) setWorkplaces([]);
        if (active) setOwnedGym(null);
      }

      if (active) setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [username, userId]);

  const toggleFollow = async () => {
    if (!userId || !profile || profile.id === userId) return;
    const supabase = createClient();
    const prev = following;
    setFollowing(!prev);
    const { error } = prev
      ? await supabase
          .from("follows")
          .delete()
          .eq("follower_id", userId)
          .eq("following_id", profile.id)
      : await supabase
          .from("follows")
          .insert({ follower_id: userId, following_id: profile.id });
    if (error) {
      setFollowing(prev);
      toast("No se pudo actualizar", "error");
    }
  };

  if (loading) {
    return (
      <main className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-neon" />
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="px-4 py-16 text-center">
        <p className="text-muted">Usuario no encontrado.</p>
        <Link href="/home" className="mt-4 inline-block text-sm font-semibold text-neon">
          Volver al inicio
        </Link>
      </main>
    );
  }

  const isSelf = userId === profile.id;
  const mapWorkplace = workplaces.find((w) => w.latitude && w.longitude);

  return (
    <main className="mx-auto max-w-md">
      <div className="flex items-center gap-4 px-4 pt-4">
        <Avatar
          src={profile.avatar_url}
          name={profile.full_name}
          username={profile.username}
          size="xl"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h1 className="truncate text-xl font-bold text-ink">
              {profile.full_name || profile.username}
            </h1>
            {profile.is_verified && (
              <BadgeCheck className="h-5 w-5 shrink-0 fill-neon text-bg" />
            )}
          </div>
          <p className="text-sm text-muted">@{profile.username}</p>
          {profile.location && (
            <p className="mt-0.5 flex items-center gap-1 text-xs text-neon">
              <MapPin className="h-3 w-3" /> {profile.location}
            </p>
          )}
          {profile.bio && (
            <p className="mt-1 text-xs leading-snug text-muted">
              {parseMentions(profile.bio).map((part, i) =>
                part.handle ? (
                  <Link key={i} href={`/perfil/${part.handle}`} className="font-semibold text-neon">
                    {part.raw}
                  </Link>
                ) : (
                  <span key={i}>{part.raw}</span>
                )
              )}
            </p>
          )}
          {profile.role === "profesor" && profile.disciplines && profile.disciplines.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {profile.disciplines.map((d) => (
                <span
                  key={d}
                  className="rounded-full border border-neon/30 bg-neon/10 px-2 py-0.5 text-[10px] font-medium text-neon"
                >
                  {d.replace(/_/g, " ")}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {profile.website && (
        <a
          href={profile.website.startsWith("http") ? profile.website : `https://${profile.website}`}
          target="_blank"
          rel="noreferrer"
          className="mx-4 mt-2 flex w-fit items-center gap-1.5 text-xs text-neon underline decoration-neon/40"
        >
          <Globe className="h-3.5 w-3.5" /> {profile.website.replace(/^https?:\/\//, "")}
        </a>
      )}

      {!isSelf && (
        <div className="flex gap-2 px-4 pt-3">
          <button
            onClick={toggleFollow}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition active:scale-[0.98] ${
              following
                ? "border border-edge bg-card text-ink"
                : "bg-neon text-bg shadow-neon"
            }`}
          >
            {following ? (
              <>
                <Check className="h-4 w-4" /> Siguiendo
              </>
            ) : (
              <>
                <UserPlus className="h-4 w-4" /> Seguir
              </>
            )}
          </button>
          <Link
            href={`/chat/${profile.id}`}
            className="flex items-center justify-center gap-2 rounded-xl border border-edge bg-card px-4 py-2.5 text-sm font-semibold text-ink transition hover:border-neon hover:text-neon"
          >
            <MessageCircle className="h-4 w-4" /> Mensaje
          </Link>
        </div>
      )}

      {workplaces.length > 0 && (
        <section className="mx-4 mt-4 rounded-2xl border border-edge bg-card p-3.5">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">
            Gimnasios donde trabaja
          </p>
          <div className="mt-2 space-y-2">
            {workplaces.map((w) => (
              <div key={w.id} className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ember/15 text-ember">
                  <MapPin className="h-4 w-4" />
                </span>
                <div className="min-w-0 leading-tight">
                  <p className="truncate text-sm font-semibold text-ink">{w.name || "Gimnasio"}</p>
                  <p className="truncate text-xs text-muted">
                    {[w.city, w.address].filter(Boolean).join(" · ") || "Ubicación no especificada"}
                  </p>
                </div>
              </div>
            ))}
          </div>
          {mapWorkplace && (
            <div className="mt-3">
              <GymMap
                latitude={mapWorkplace.latitude!}
                longitude={mapWorkplace.longitude!}
                name={mapWorkplace.name}
              />
            </div>
          )}
        </section>
      )}

      {ownedGym && (
        <section className="mx-4 mt-4 rounded-2xl border border-neon/30 bg-card p-3.5">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-neon">
            <Dumbbell className="h-3.5 w-3.5" /> Este gimnasio usa SpotterX
          </p>
          <div className="mt-2 flex items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neon/15 text-neon">
              <MapPin className="h-4 w-4" />
            </span>
            <div className="min-w-0 leading-tight">
              <p className="truncate text-sm font-semibold text-ink">{ownedGym.name || "Gimnasio"}</p>
              <p className="truncate text-xs text-muted">
                {[ownedGym.city, ownedGym.address].filter(Boolean).join(" · ") || "Ubicación no especificada"}
              </p>
            </div>
          </div>
          {ownedGym.latitude && ownedGym.longitude && (
            <div className="mt-3">
              <GymMap latitude={ownedGym.latitude} longitude={ownedGym.longitude} name={ownedGym.name} />
            </div>
          )}
        </section>
      )}

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

      <ProfileGrid posts={posts} />

      <FollowList
        open={list !== null}
        mode={list ?? "followers"}
        ownerId={profile.id}
        onClose={() => setList(null)}
      />
    </main>
  );
}