"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { MapPin, Zap, UserPlus, Check, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuthState } from "@/lib/auth-context";

interface PublicProfile {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  role: string;
  location: string | null;
}

export default function PublicProfilePage() {
  const params = useParams<{ username: string }>();
  const username = params.username;
  const { userId } = useAuthState();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [posts, setPosts] = useState<{ id: string; media_url: string | null }[]>([]);
  const [following, setFollowing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    const load = async () => {
      const { data: p } = await supabase
        .from("profiles")
        .select("*")
        .eq("username", username)
        .maybeSingle();
      if (!p || !active) {
        setLoading(false);
        return;
      }
      setProfile(p as PublicProfile);

      const { data: postRows } = await supabase
        .from("posts")
        .select("id, media_url")
        .eq("user_id", p.id)
        .order("created_at", { ascending: false });
      setPosts((postRows ?? []) as { id: string; media_url: string | null }[]);

      if (userId && p.id !== userId) {
        const { data: f } = await supabase
          .from("follows")
          .select("follower_id")
          .eq("follower_id", userId)
          .eq("following_id", p.id)
          .maybeSingle();
        setFollowing(!!f);
      }
      setLoading(false);
    };

    load();
    return () => {
      active = false;
    };
  }, [username, userId]);

  const toggleFollow = async () => {
    if (!userId || !profile || profile.id === userId) return;
    const supabase = createClient();
    if (following) {
      await supabase
        .from("follows")
        .delete()
        .eq("follower_id", userId)
        .eq("following_id", profile.id);
      setFollowing(false);
    } else {
      await supabase
        .from("follows")
        .insert({ follower_id: userId, following_id: profile.id });
      setFollowing(true);
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
      </main>
    );
  }

  const initial = (profile.full_name || profile.username).slice(0, 2).toUpperCase();

  return (
    <div className="w-full">
      <div className="flex items-center gap-4 px-4 pt-4">
        <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-neon bg-neon/20 text-xl font-bold text-neon shadow-neon">
          {initial}
        </div>
        <div>
          <h1 className="text-xl font-bold text-ink">
            {profile.full_name || profile.username}
          </h1>
          <p className="text-sm text-muted">@{profile.username}</p>
          {profile.location && (
            <p className="mt-1 flex items-center gap-1 text-xs text-neon">
              <MapPin className="h-3.5 w-3.5" /> {profile.location}
            </p>
          )}
          {profile.bio && (
            <p className="mt-1 max-w-[220px] text-xs text-muted">{profile.bio}</p>
          )}
        </div>
      </div>

      {userId && profile.id !== userId && (
        <div className="px-4 pt-3">
          <button
            onClick={toggleFollow}
            className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
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
        </div>
      )}

      {profile.role === "profesor" && (
        <div className="mx-4 mt-4 rounded-xl border border-ember/30 bg-ember/10 p-3 text-center">
          <p className="text-sm font-semibold text-ember">Profesor</p>
          <p className="text-xs text-muted">
            Gimnasios donde trabaja y zona (próximamente)
          </p>
        </div>
      )}

      <div className="mt-5 grid grid-cols-3 divide-x divide-edge border-b border-t border-edge text-center">
        {[
          [String(posts.length), "Posts"],
          ["0", "Seguidores"],
          ["0", "Siguiendo"],
        ].map(([n, l]) => (
          <div key={l} className="py-3">
            <p className="text-lg font-bold text-ink">{n}</p>
            <p className="text-xs text-muted">{l}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-1 p-1">
        {posts.length === 0 && (
          <div className="col-span-3 py-10 text-center text-sm text-muted">
            Sin publicaciones todavía
          </div>
        )}
        {posts.map((p) =>
          p.media_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={p.id}
              src={p.media_url}
              alt=""
              className="aspect-square w-full rounded-lg bg-card object-cover"
            />
          ) : (
            <div key={p.id} className="aspect-square rounded-lg bg-card">
              <Zap className="h-full w-full p-4 text-muted/40" />
            </div>
          )
        )}
      </div>
    </div>
  );
}
