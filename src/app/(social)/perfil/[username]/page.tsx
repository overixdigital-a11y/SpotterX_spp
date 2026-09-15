"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { MapPin, Zap, UserPlus, Check, Loader2, Award, DollarSign, MessageCircle, ExternalLink, Clock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuthState } from "@/lib/auth-context";
import { Avatar } from "@/components/core/Avatar";

interface PublicProfile {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  role: string;
  location: string | null;
  website: string | null;
  disciplines: string[] | null;
  certifications: { name: string; issuer: string; year: number | string }[] | null;
  hourly_rate: number | null;
  specialties: string[] | null;
  years_experience: number | null;
  availability: Record<string, string[]> | null;
  is_verified: boolean;
}

interface TrainerStats {
  students: number;
  gyms: number;
  reviews_count: number;
  avg_rating: number | null;
  plans_created: number;
  routines_completed: number;
}

export default function PublicProfilePage() {
  const params = useParams<{ username: string }>();
  const username = params.username;
  const { userId } = useAuthState();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [posts, setPosts] = useState<{ id: string; media_url: string | null }[]>([]);
  const [following, setFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [trainerStats, setTrainerStats] = useState<TrainerStats | null>(null);

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

      // Posts
      const { data: postRows } = await supabase
        .from("posts")
        .select("id, media_url")
        .eq("user_id", p.id)
        .order("created_at", { ascending: false });
      if (active) setPosts((postRows ?? []) as { id: string; media_url: string | null }[]);

      // Follower / following counts
      const [{ count: fc }, { count: fgc }] = await Promise.all([
        supabase.from("follows").select("*", { count: "exact", head: true }).eq("following_id", p.id),
        supabase.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", p.id),
      ]);
      if (active) {
        setFollowerCount(fc ?? 0);
        setFollowingCount(fgc ?? 0);
      }

      // Follow status
      if (userId && p.id !== userId) {
        const { data: f } = await supabase
          .from("follows")
          .select("follower_id")
          .eq("follower_id", userId)
          .eq("following_id", p.id)
          .maybeSingle();
        if (active) setFollowing(!!f);
      }

      // Trainer stats
      if (p.role === "profesor" || p.role === "admin") {
        const { data: stats } = await supabase.rpc("get_trainer_stats", { p_trainer_id: p.id });
        if (active && stats) setTrainerStats(stats as TrainerStats);
      }

      if (active) setLoading(false);
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
      setFollowerCount((c) => Math.max(0, c - 1));
    } else {
      await supabase
        .from("follows")
        .insert({ follower_id: userId, following_id: profile.id });
      setFollowing(true);
      setFollowerCount((c) => c + 1);
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

  const isProfe = profile.role === "profesor" || profile.role === "admin";

  return (
    <div className="w-full">
      {/* Header: Avatar + info */}
      <div className="flex items-start gap-4 px-4 pt-4">
        <Avatar
          src={profile.avatar_url}
          name={profile.full_name}
          username={profile.username}
          size="lg"
          ring
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-ink truncate">
              {profile.full_name || profile.username}
            </h1>
            {profile.is_verified && (
              <span className="shrink-0 rounded-full bg-neon/20 p-0.5 text-neon">
                <Check className="h-3 w-3" />
              </span>
            )}
          </div>
          <p className="text-sm text-muted">@{profile.username}</p>
          {profile.location && (
            <p className="mt-1 flex items-center gap-1 text-xs text-neon">
              <MapPin className="h-3.5 w-3.5" /> {profile.location}
            </p>
          )}
          {isProfe && profile.years_experience != null && profile.years_experience > 0 && (
            <p className="mt-0.5 text-xs text-muted">
              {profile.years_experience} {profile.years_experience === 1 ? "año" : "años"} de experiencia
            </p>
          )}
        </div>
      </div>

      {/* Bio */}
      {profile.bio && (
        <p className="mt-3 px-4 text-sm text-muted leading-relaxed">{profile.bio}</p>
      )}

      {/* Website */}
      {profile.website && (
        <a
          href={profile.website.startsWith("http") ? profile.website : `https://${profile.website}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 flex items-center gap-1.5 px-4 text-xs text-neon hover:underline"
        >
          <ExternalLink className="h-3 w-3" /> {profile.website.replace(/^https?:\/\//, "")}
        </a>
      )}

      {/* Botones de acción */}
      <div className="mt-4 flex gap-2 px-4">
        {userId && profile.id !== userId && (
          <>
            <button
              onClick={toggleFollow}
              className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
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
              className="flex items-center justify-center rounded-xl border border-edge bg-card px-4 py-2.5 text-sm font-medium text-muted transition hover:border-neon/40 hover:text-neon"
            >
              <MessageCircle className="h-4 w-4" />
            </Link>
          </>
        )}
      </div>

      {/* Stats */}
      <div className="mt-5 grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 divide-x divide-edge border-b border-t border-edge text-center">
        {[
          [String(posts.length), "Posts"],
          [String(followerCount), "Seguidores"],
          [String(followingCount), "Siguiendo"],
        ].map(([n, l]) => (
          <div key={l} className="py-3">
            <p className="text-lg font-bold text-ink">{n}</p>
            <p className="text-xs text-muted">{l}</p>
          </div>
        ))}
      </div>

      {/* ─── Sección Profesor ─── */}
      {isProfe && (
        <div className="space-y-4 px-4 pt-4">
          {/* Stats del profe */}
          {trainerStats && (
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-xl border border-edge bg-card p-3 text-center">
                <p className="text-lg font-bold text-neon">{trainerStats.students}</p>
                <p className="text-[11px] text-muted">Alumnos</p>
              </div>
              <div className="rounded-xl border border-edge bg-card p-3 text-center">
                <p className="text-lg font-bold text-ember">{trainerStats.gyms}</p>
                <p className="text-[11px] text-muted">Gimnasios</p>
              </div>
              <div className="rounded-xl border border-edge bg-card p-3 text-center">
                <p className="text-lg font-bold text-neon">
                  {trainerStats.avg_rating != null ? `${trainerStats.avg_rating}` : "—"}
                </p>
                <p className="text-[11px] text-muted">
                  {trainerStats.reviews_count > 0 ? `${trainerStats.reviews_count} reseñas` : "Sin reseñas"}
                </p>
              </div>
            </div>
          )}

          {/* Tarifa */}
          {profile.hourly_rate != null && profile.hourly_rate > 0 && (
            <div className="flex items-center gap-2 rounded-xl border border-neon/30 bg-neon/10 px-3.5 py-2.5">
              <DollarSign className="h-4 w-4 text-neon" />
              <span className="text-sm font-semibold text-ink">${profile.hourly_rate}</span>
              <span className="text-xs text-muted">/ hora</span>
            </div>
          )}

          {/* Disciplinas */}
          {profile.disciplines && profile.disciplines.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted mb-2">Disciplinas</p>
              <div className="flex flex-wrap gap-1.5">
                {profile.disciplines.map((d) => (
                  <span
                    key={d}
                    className="rounded-full border border-neon/30 bg-neon/10 px-2.5 py-0.5 text-[11px] font-medium text-neon"
                  >
                    {d.replace(/_/g, " ")}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Especialidades */}
          {profile.specialties && profile.specialties.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted mb-2">Especialidades</p>
              <div className="flex flex-wrap gap-1.5">
                {profile.specialties.map((s) => (
                  <span
                    key={s}
                    className="rounded-full border border-ember/30 bg-ember/10 px-2.5 py-0.5 text-[11px] font-medium text-ember"
                  >
                    {s.replace(/_/g, " ")}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Certificaciones */}
          {profile.certifications && profile.certifications.length > 0 && (
            <div className="rounded-xl border border-edge bg-card p-3.5 space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-muted">
                <Award className="h-3.5 w-3.5" /> Certificaciones
              </div>
              {profile.certifications.map((c, idx) => (
                <div key={idx} className="flex items-center gap-2 text-sm">
                  <span className="font-medium text-ink">{c.name}</span>
                  {c.issuer && <span className="text-muted">· {c.issuer}</span>}
                  {c.year && <span className="text-muted text-xs">({c.year})</span>}
                </div>
              ))}
            </div>
          )}

          {/* Disponibilidad */}
          {profile.availability && Object.keys(profile.availability).length > 0 && (
            <div className="rounded-xl border border-edge bg-card p-3.5 space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-muted">
                <Clock className="h-3.5 w-3.5" /> Disponibilidad
              </div>
              <div className="space-y-1">
                {Object.entries(profile.availability).map(([day, slots]) => (
                  slots.length > 0 && (
                    <div key={day} className="flex items-center gap-2 text-sm">
                      <span className="w-8 text-xs font-medium text-muted uppercase">{day}</span>
                      <span className="text-ink">{slots.join(", ")}</span>
                    </div>
                  )
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Grid de posts */}
      <div className="mt-4 grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-1 p-1">
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
