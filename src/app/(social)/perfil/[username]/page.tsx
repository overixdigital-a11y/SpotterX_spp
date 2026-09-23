"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { MapPin, Zap, UserPlus, Check, Loader2, Award, DollarSign, MessageCircle, ExternalLink, Clock, Store, Navigation, Maximize2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuthState } from "@/lib/auth-context";
import { Avatar } from "@/components/core/Avatar";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { DARK_MAP_TILES, getDirectionsUrl } from "@/lib/geo";
import ZoomToPoint from "@/components/gyms/ZoomToPoint";
import LeafletAutoResize from "@/components/gyms/LeafletAutoResize";

const gymIcon = L.icon({
  iconUrl: "data:image/svg+xml," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="30" height="46"><path fill="#00f2fe" stroke="#05070a" stroke-width="1.5" d="M15 0C6.7 0 0 6.7 0 15c0 9.7 15 31 15 31s15-21.3 15-31C30 6.7 23.3 0 15 0z"/><circle cx="15" cy="15" r="6" fill="#05070a"/></svg>`),
  iconSize: [30, 46], iconAnchor: [15, 46], popupAnchor: [0, -40],
});

const zonaIcon = L.icon({
  iconUrl: "data:image/svg+xml," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="30" height="46"><path fill="#ff5e36" stroke="#05070a" stroke-width="1.5" d="M15 0C6.7 0 0 6.7 0 15c0 9.7 15 31 15 31s15-21.3 15-31C30 6.7 23.3 0 15 0z"/><circle cx="15" cy="15" r="6" fill="#05070a"/></svg>`),
  iconSize: [30, 46], iconAnchor: [15, 46], popupAnchor: [0, -40],
});

function FitAllButton({ points }: { points: [number, number][] }) {
  const map = useMap();
  const fit = () => {
    const bounds = L.latLngBounds(points);
    map.fitBounds(bounds.pad(0.25), { maxZoom: 14 });
  };
  return (
    <button
      type="button"
      onClick={fit}
      className="absolute right-2 top-2 z-[500] flex items-center gap-1 rounded-full border border-edge bg-[#0c1017]/90 px-3 py-1.5 text-[11px] font-semibold text-neon shadow-lg"
    >
      <Maximize2 className="h-3 w-3" /> Ver todos
    </button>
  );
}

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

interface WorkplaceGym {
  gym_id: string;
  name: string | null;
  city: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
}

interface WorkplaceZona {
  id: string;
  name: string | null;
  city: string | null;
  address: string | null;
  availability: string | null;
  disciplines: string[] | null;
  description: string | null;
  notes: string | null;
  latitude: number | null;
  longitude: number | null;
}

interface TrainerStudent {
  student_id: string;
  source: string | null;
  full_name: string | null;
  username: string;
  avatar_url: string | null;
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
  const [workplaces, setWorkplaces] = useState<{ gyms: WorkplaceGym[]; zonas: WorkplaceZona[] }>({ gyms: [], zonas: [] });
  const [students, setStudents] = useState<TrainerStudent[]>([]);

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
        const [{ data: stats }, { data: wp }] = await Promise.all([
          supabase.rpc("get_trainer_stats", { p_trainer_id: p.id }),
          supabase.rpc("get_trainer_workplaces", { p_trainer_id: p.id }),
        ]);
        if (active && stats) setTrainerStats(stats as TrainerStats);
        if (active && wp) setWorkplaces(wp as { gyms: WorkplaceGym[]; zonas: WorkplaceZona[] });

        // Students
        const { data: ts } = await supabase
          .from("trainer_students")
          .select("student_id, source")
          .eq("trainer_id", p.id)
          .eq("active", true);
        if (active && ts && ts.length > 0) {
          const ids = ts.map((s) => s.student_id);
          const { data: profs } = await supabase
            .from("profiles")
            .select("id, full_name, username, avatar_url")
            .in("id", ids);
          const profMap = new Map<string, { full_name: string | null; username: string; avatar_url: string | null }>();
          (profs ?? []).forEach((pr) => profMap.set(pr.id, pr));
          setStudents(
            ts.map((s) => ({
              student_id: s.student_id,
              source: s.source,
              full_name: profMap.get(s.student_id)?.full_name ?? null,
              username: profMap.get(s.student_id)?.username ?? "@?",
              avatar_url: profMap.get(s.student_id)?.avatar_url ?? null,
            }))
          );
        } else if (active) {
          setStudents([]);
        }
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

          {/* Lugares donde trabaja */}
          {(workplaces.gyms.length > 0 || workplaces.zonas.length > 0) && (
            <div className="space-y-3">
              <p className="flex items-center gap-2 text-xs font-semibold text-muted">
                <MapPin className="h-3.5 w-3.5" /> Lugares donde trabaja
              </p>
              {(() => {
                const allPlaces = [
                  ...workplaces.gyms.map((g) => ({ name: g.name, city: g.city, address: g.address, lat: g.latitude, lng: g.longitude, isGym: true, disciplines: null as string[] | null, description: null, notes: null })),
                  ...workplaces.zonas.map((z) => ({ name: z.name, city: z.city, address: z.address, lat: z.latitude, lng: z.longitude, isGym: false, disciplines: z.disciplines, description: z.description, notes: z.notes })),
                ];
                const withCoords = allPlaces.filter((p) => typeof p.lat === "number" && typeof p.lng === "number");
                return (
                  <>
                    {withCoords.length > 0 && (
                      <div className="relative overflow-hidden rounded-2xl border border-edge">
                        <MapContainer
                          center={[withCoords[0].lat!, withCoords[0].lng!]}
                          zoom={12}
                          scrollWheelZoom={false}
                          style={{ height: "220px", width: "100%", backgroundColor: "#0c1017" }}
                        >
                          <LeafletAutoResize />
                          <TileLayer
                            attribution={DARK_MAP_TILES.attribution}
                            url={DARK_MAP_TILES.url}
                          />
                          {withCoords.length > 1 && (
                            <FitAllButton points={withCoords.map((p) => [p.lat as number, p.lng as number])} />
                          )}
                          {workplaces.gyms.filter((g) => typeof g.latitude === "number" && typeof g.longitude === "number").map((g) => (
                            <Marker key={`gym-${g.gym_id}`} position={[g.latitude!, g.longitude!]} icon={gymIcon}>
                              <Popup>
                                <div className="min-w-[150px] p-0.5 text-sm">
                                  <p className="font-bold text-[#111]">{g.name}</p>
                                  <p className="text-xs text-[#555]">{g.city}{g.address ? ` · ${g.address}` : ""}</p>
                                  <div className="mt-2 flex gap-1.5">
                                    <ZoomToPoint
                                      lat={g.latitude!}
                                      lng={g.longitude!}
                                      className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-[#00f2fe]/50 bg-[#00f2fe]/10 px-2 py-1 text-[11px] font-semibold text-[#0286a0]"
                                    />
                                    <a
                                      href={getDirectionsUrl(g.latitude!, g.longitude!)}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-[#00f2fe] px-2 py-1 text-[11px] font-semibold text-[#05070a]"
                                    >
                                      <Navigation className="h-3 w-3" /> Cómo llegar
                                    </a>
                                  </div>
                                </div>
                              </Popup>
                            </Marker>
                          ))}
                          {workplaces.zonas.filter((z) => typeof z.latitude === "number" && typeof z.longitude === "number").map((z) => (
                            <Marker key={`zona-${z.id}`} position={[z.latitude!, z.longitude!]} icon={zonaIcon}>
                              <Popup>
                                <div className="min-w-[150px] p-0.5 text-sm">
                                  <p className="font-bold text-[#111]">{z.name}</p>
                                  <p className="text-xs text-[#555]">{z.city}{z.address ? ` · ${z.address}` : ""}</p>
                                  {z.availability && <p className="mt-0.5 text-xs text-[#0a6]">Horarios: {z.availability}</p>}
                                  {z.disciplines && z.disciplines.length > 0 && (
                                    <div className="mt-1 flex flex-wrap gap-1">
                                      {z.disciplines.map((d) => (
                                        <span key={d} className="rounded-full bg-[#ff5e36]/15 px-1.5 py-0.5 text-[10px] font-semibold text-[#c4401c]">
                                          {d}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                  {z.description && <p className="mt-1 text-xs text-[#333]">{z.description}</p>}
                                  {z.notes && <p className="mt-1 text-xs text-[#333]">📌 {z.notes}</p>}
                                  <div className="mt-2 flex gap-1.5">
                                    <ZoomToPoint
                                      lat={z.latitude!}
                                      lng={z.longitude!}
                                      className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-[#ff5e36]/50 bg-[#ff5e36]/10 px-2 py-1 text-[11px] font-semibold text-[#c4401c]"
                                    />
                                    <a
                                      href={getDirectionsUrl(z.latitude!, z.longitude!)}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-[#ff5e36] px-2 py-1 text-[11px] font-semibold text-white"
                                    >
                                      <Navigation className="h-3 w-3" /> Cómo llegar
                                    </a>
                                  </div>
                                </div>
                              </Popup>
                            </Marker>
                          ))}
                        </MapContainer>
                      {withCoords.length > 1 && (
                        <>
                          <div className="pointer-events-none absolute left-1/2 top-2 z-[500] -translate-x-1/2 whitespace-nowrap rounded-full border border-edge bg-[#0c1017]/90 px-3 py-1 text-[11px] font-semibold text-muted">
                            Alejá el mapa para ver todos los lugares
                          </div>
                        </>
                      )}
                    </div>
                    )}
                    <div className="space-y-2">
                      {allPlaces.map((p, idx) => (
                        <div key={idx} className="flex items-center justify-between gap-2.5 rounded-xl border border-edge bg-card px-3.5 py-2.5">
                          <div className="flex min-w-0 items-center gap-2.5">
                            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${p.isGym ? "bg-neon/20 text-neon" : "bg-ember/20 text-ember"}`}>
                              {p.isGym ? <Store className="h-4 w-4" /> : <MapPin className="h-4 w-4" />}
                            </span>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-ink">{p.name}</p>
                              <p className="truncate text-xs text-muted">{p.city}{p.address ? ` · ${p.address}` : ""}</p>
                              {p.disciplines && p.disciplines.length > 0 && (
                                <div className="mt-1 flex flex-wrap gap-1">
                                  {p.disciplines.map((d) => (
                                    <span key={d} className="rounded-full border border-neon/40 bg-neon/10 px-2 py-0.5 text-[10px] font-semibold text-neon">
                                      {d}
                                    </span>
                                  ))}
                                </div>
                              )}
                              {p.description && <p className="mt-1 text-xs text-muted">{p.description}</p>}
                              {p.notes && <p className="mt-1 text-xs text-muted">📌 {p.notes}</p>}
                            </div>
                          </div>
                          {typeof p.lat === "number" && typeof p.lng === "number" && (
                            <a
                              href={getDirectionsUrl(p.lat, p.lng)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex shrink-0 items-center gap-1 rounded-lg border border-edge bg-subtle px-2 py-1 text-xs font-semibold text-ink transition hover:border-neon hover:text-neon"
                              title="Cómo llegar"
                            >
                              <Navigation className="h-3 w-3" />
                              Llegar
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                );
              })()}
            </div>
          )}

          {/* Alumnos */}
          {students.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-muted">Alumnos</p>
                {profile.id === userId && (
                  <Link href="/entrenamiento" className="text-xs font-semibold text-neon hover:underline">+ Agregar alumno</Link>
                )}
              </div>
              {students.slice(0, 8).map((s) => (
                <Link key={s.student_id} href={`/perfil/${s.username}`} className="flex items-center gap-2.5 rounded-xl border border-edge bg-card px-3.5 py-2.5">
                  <Avatar src={s.avatar_url} name={s.full_name} username={s.username} size="sm" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">{s.full_name || s.username}</p>
                    <p className="truncate text-xs text-muted">@{s.username}</p>
                  </div>
                  {s.source === "gym" && (
                    <span className="ml-auto shrink-0 rounded-full bg-neon/10 px-2 py-0.5 text-[10px] font-semibold text-neon">del gym</span>
                  )}
                </Link>
              ))}
              {students.length > 8 && (
                <p className="text-center text-xs text-muted">y {students.length - 8} más</p>
              )}
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
