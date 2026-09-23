"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Clock3, Loader2, MapPin, MessageCircle, Navigation, Search, User } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuthState } from "@/lib/auth-context";
import { Avatar } from "@/components/core/Avatar";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import LeafletAutoResize from "@/components/gyms/LeafletAutoResize";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { DARK_MAP_TILES, haversineDistance, formatDistance, getDirectionsUrl } from "@/lib/geo";
import ZoomToPoint from "@/components/gyms/ZoomToPoint";

const icon = L.icon({
  iconUrl:
    "data:image/svg+xml," +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="46"><path fill="#ff5e36" stroke="#05070a" stroke-width="1.5" d="M15 0C6.7 0 0 6.7 0 15c0 9.7 15 31 15 31s15-21.3 15-31C30 6.7 23.3 0 15 0z"/><circle cx="15" cy="15" r="6" fill="#05070a"/></svg>`
    ),
  iconSize: [30, 46],
  iconAnchor: [15, 46],
  popupAnchor: [0, -40],
});

const userIcon = L.icon({
  iconUrl:
    "data:image/svg+xml," +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36"><circle cx="18" cy="18" r="16" fill="#00f2fe" fill-opacity="0.25"/><circle cx="18" cy="18" r="8" fill="#00f2fe" stroke="#05070a" stroke-width="2"/><circle cx="18" cy="18" r="3" fill="#ffffff"/></svg>`
    ),
  iconSize: [36, 36],
  iconAnchor: [18, 18],
  popupAnchor: [0, -18],
});

const ARG_CENTER: [number, number] = [-38.6, -63.6];

interface Zone {
  id: string;
  trainer_id: string;
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

interface TrainerProfile {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
}

export default function BuscarProfePage() {
  const { userId } = useAuthState();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [zones, setZones] = useState<Zone[]>([]);
  const [profiles, setProfiles] = useState<Map<string, TrainerProfile>>(new Map());
  const [linked, setLinked] = useState<Set<string>>(new Set());
  const [q, setQ] = useState("");
  const [center, setCenter] = useState<[number, number]>(ARG_CENTER);
  const [zoom, setZoom] = useState<number>(5);
  const [userCoords, setUserCoords] = useState<[number, number] | null>(null);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    let active = true;
    const load = async () => {
      const { data: z } = await supabase
        .from("trainer_gyms")
        .select("id, trainer_id, name, city, address, availability, disciplines, description, notes, latitude, longitude")
        .order("name", { ascending: true });
      if (!active) return;
      const zoneList = (z as Zone[]) ?? [];
      setZones(zoneList);

      const trainerIds = Array.from(new Set(zoneList.map((x) => x.trainer_id)));
      if (trainerIds.length > 0) {
        const { data: ps } = await supabase
          .from("profiles")
          .select("id, username, full_name, avatar_url")
          .in("id", trainerIds);
        const map = new Map<string, TrainerProfile>();
        ((ps as TrainerProfile[] | null) ?? []).forEach((p) => map.set(p.id, p));
        setProfiles(map);
      }

      const { data: ts } = await supabase
        .from("trainer_students")
        .select("trainer_id")
        .eq("student_id", userId)
        .eq("active", true);
      const set = new Set<string>((ts as { trainer_id: string }[] | null)?.map((t) => t.trainer_id) ?? []);
      setLinked(set);

      if (active) setLoading(false);
    };
    load();
    return () => {
      active = false;
    };
  }, [userId]);

  const locate = () => {
    setLocating(true);
    if (!navigator.geolocation) {
      setLocating(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        setUserCoords(coords);
        setCenter(coords);
        setZoom(13);
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const ql = q.trim().toLowerCase();
  const visible = zones.filter((z) => {
    if (!ql) return true;
    const prof = profiles.get(z.trainer_id);
    const haystack = [
      z.name ?? "",
      z.city ?? "",
      z.address ?? "",
      prof?.full_name ?? "",
      prof?.username ?? "",
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(ql);
  });

  const mapZones = visible.filter((z) => typeof z.latitude === "number" && typeof z.longitude === "number");

  const trainers = Array.from(
    visible.reduce((acc, z) => {
      const prof = profiles.get(z.trainer_id);
      if (!prof) return acc;
      const distance =
        userCoords && typeof z.latitude === "number" && typeof z.longitude === "number"
          ? haversineDistance(userCoords[0], userCoords[1], z.latitude, z.longitude)
          : null;
      if (!acc.has(z.trainer_id)) {
        acc.set(z.trainer_id, { prof, zone: z, distance });
      } else {
        const existing = acc.get(z.trainer_id)!;
        if (distance !== null && (existing.distance === null || distance < existing.distance)) {
          acc.set(z.trainer_id, { prof, zone: z, distance });
        }
      }
      return acc;
    }, new Map<string, { prof: TrainerProfile; zone: Zone; distance: number | null }>()).values()
  );

  if (userCoords) {
    trainers.sort((a, b) => {
      if (a.distance === null) return 1;
      if (b.distance === null) return -1;
      return a.distance - b.distance;
    });
  }

  if (loading) {
    return (
      <main className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-neon" />
      </main>
    );
  }

  return (
    <main className="mx-auto mb-4 max-w-full px-4 pt-5">
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="rounded-full border border-edge bg-card p-2 text-muted"
          aria-label="Volver"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-ink">Buscar profe</h1>
          <p className="text-xs text-muted">Encontrá profes por zona y contactalos</p>
        </div>
        <button
          onClick={locate}
          disabled={locating}
          className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
            userCoords
              ? "border-neon bg-neon text-[#05070a] shadow-sm shadow-neon/30"
              : "border-neon/40 bg-neon/10 text-neon"
          }`}
        >
          {locating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Navigation className="h-3.5 w-3.5" />}
          {userCoords ? "Ubicación activa" : "Mi zona"}
        </button>
      </div>

      <div className="mt-4 flex items-center gap-2 rounded-lg border border-edge bg-card px-3 py-2">
        <Search className="h-4 w-4 shrink-0 text-muted" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por ciudad, zona o nombre del profe…"
          className="w-full bg-transparent text-sm text-ink placeholder:text-muted focus:outline-none"
        />
      </div>

      {userCoords && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-neon">
          <Navigation className="h-3.5 w-3.5" />
          Profes ordenados por cercanía a tu ubicación
        </p>
      )}

      {mapZones.length > 0 ? (
        <div className="mt-3 overflow-hidden rounded-2xl border border-edge">
          <MapContainer
            key={`${center.join(",")}-${zoom}`}
            center={center}
            zoom={zoom}
            scrollWheelZoom={false}
            style={{ height: "280px", width: "100%", backgroundColor: "#0c1017" }}
          >
            <LeafletAutoResize />
            <TileLayer
              attribution={DARK_MAP_TILES.attribution}
              url={DARK_MAP_TILES.url}
            />
            {userCoords && (
              <Marker position={userCoords} icon={userIcon}>
                <Popup>
                  <div className="p-0.5 text-center text-xs font-bold text-[#111]">
                    📍 Tu ubicación actual
                  </div>
                </Popup>
              </Marker>
            )}
            {mapZones.map((z) => {
              const prof = profiles.get(z.trainer_id);
              if (!prof) return null;
              const dist =
                userCoords && typeof z.latitude === "number" && typeof z.longitude === "number"
                  ? haversineDistance(userCoords[0], userCoords[1], z.latitude, z.longitude)
                  : null;
              const directionsUrl =
                typeof z.latitude === "number" && typeof z.longitude === "number"
                  ? getDirectionsUrl(z.latitude, z.longitude)
                  : null;

              return (
                <Marker key={z.id} position={[z.latitude as number, z.longitude as number]} icon={icon}>
                  <Popup>
                    <div className="min-w-[160px] text-sm">
                      <p className="font-bold text-[#111]">{prof.full_name || prof.username}</p>
                      <p className="text-xs text-[#555]">@{prof.username}</p>
                      <p className="mt-1 flex items-center gap-1 text-xs text-[#333]">
                        <MapPin className="h-3 w-3 shrink-0" />
                        {z.name}
                        {z.city ? ` · ${z.city}` : ""}
                        {z.address ? ` · ${z.address}` : ""}
                      </p>
                      {z.disciplines && z.disciplines.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {z.disciplines.map((d) => (
                            <span key={d} className="rounded-full bg-[#00f2fe]/15 px-2 py-0.5 text-[10px] font-semibold text-[#0286a0]">
                              {d}
                            </span>
                          ))}
                        </div>
                      )}
                      {z.description && <p className="mt-1 text-xs text-[#333]">{z.description}</p>}
                      {z.notes && <p className="mt-1 text-xs text-[#333]">📌 {z.notes}</p>}
                      {dist !== null && (
                        <p className="mt-0.5 text-xs font-semibold text-[#008ba3]">
                          A {formatDistance(dist)} de vos
                        </p>
                      )}
                      {z.availability && (
                        <p className="mt-0.5 flex items-center gap-1 text-xs text-[#0a6]">
                          <Clock3 className="h-3 w-3 shrink-0" /> {z.availability}
                        </p>
                      )}
                      {linked.has(z.trainer_id) && (
                        <span className="mt-1 inline-block rounded-full bg-[#00f2fe]/15 px-2 py-0.5 text-[11px] font-semibold text-[#0286a0]">
                          Ya te entrena
                        </span>
                      )}
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <Link
                          href={`/perfil/${prof.username}`}
                          className="flex items-center gap-1 rounded-lg bg-[#111] px-2.5 py-1 text-[11px] font-semibold text-white"
                        >
                          <User className="h-3 w-3" /> Perfil
                        </Link>
                        <Link
                          href={`/chat/${prof.id}`}
                          className="flex items-center gap-1 rounded-lg bg-[#ff5e36] px-2.5 py-1 text-[11px] font-semibold text-white"
                        >
                          <MessageCircle className="h-3 w-3" /> Chat
                        </Link>
                        <ZoomToPoint
                          lat={z.latitude as number}
                          lng={z.longitude as number}
                          className="flex items-center gap-1 rounded-lg border border-[#00f2fe]/50 bg-[#00f2fe]/10 px-2.5 py-1 text-[11px] font-semibold text-[#0286a0]"
                        />
                        {directionsUrl && (
                          <a
                            href={directionsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 rounded-lg bg-[#00f2fe] px-2.5 py-1 text-[11px] font-semibold text-[#05070a]"
                          >
                            <Navigation className="h-3 w-3" /> Cómo llegar
                          </a>
                        )}
                      </div>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>
        </div>
      ) : (
        <div className="mt-3 rounded-2xl border border-dashed border-edge bg-card p-6 text-center text-sm text-muted">
          No hay profes con ubicación{ql ? ` para "${q.trim()}"` : ""} todavía.
        </div>
      )}

      <div className="mt-5">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">
          Profes encontrados ({trainers.length})
        </p>
        {trainers.length === 0 && (
          <p className="py-8 text-center text-sm text-muted">No se encontró ningún profe.</p>
        )}
        {trainers.map(({ prof, zone, distance }) => {
          const directionsUrl =
            typeof zone.latitude === "number" && typeof zone.longitude === "number"
              ? getDirectionsUrl(zone.latitude, zone.longitude)
              : null;

          return (
            <div key={prof.id} className="mb-2 flex items-center gap-3 rounded-xl border border-edge bg-card p-3.5">
              <Avatar src={prof.avatar_url} name={prof.full_name} username={prof.username} size="md" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-semibold text-ink">{prof.full_name || prof.username}</p>
                  {distance !== null && (
                    <span className="shrink-0 rounded-full border border-neon/40 bg-neon/10 px-2 py-0.5 text-[10px] font-semibold text-neon">
                      A {formatDistance(distance)}
                    </span>
                  )}
                </div>
                <p className="truncate text-xs text-muted">
                  @{prof.username} · {zone.name}
                  {zone.city ? ` · ${zone.city}` : ""}
                </p>
                {zone.availability && (
                  <p className="flex items-center gap-1 text-xs text-neon">
                    <Clock3 className="h-3 w-3" /> {zone.availability}
                  </p>
                )}
                {zone.disciplines && zone.disciplines.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {zone.disciplines.map((d) => (
                      <span key={d} className="rounded-full border border-neon/40 bg-neon/10 px-2 py-0.5 text-[10px] font-semibold text-neon">
                        {d}
                      </span>
                    ))}
                  </div>
                )}
                {zone.description && <p className="mt-1 text-xs text-muted">{zone.description}</p>}
                {zone.notes && <p className="mt-1 text-xs text-muted">📌 {zone.notes}</p>}
                {linked.has(prof.id) && (
                  <span className="mt-1 inline-block rounded-full border border-neon/40 bg-neon/10 px-2.5 py-0.5 text-[11px] font-semibold text-neon">
                    Ya te entrena
                  </span>
                )}
              </div>
              <div className="flex shrink-0 flex-col gap-1.5">
                <Link
                  href={`/perfil/${prof.username}`}
                  className="flex items-center justify-center gap-1 rounded-lg border border-edge px-2.5 py-1.5 text-xs font-semibold text-ink"
                >
                  <User className="h-3.5 w-3.5" /> Ver
                </Link>
                <Link
                  href={`/chat/${prof.id}`}
                  className="flex items-center justify-center gap-1 rounded-lg bg-ember px-2.5 py-1.5 text-xs font-semibold text-bg"
                >
                  <MessageCircle className="h-3.5 w-3.5" /> Mensaje
                </Link>
                {directionsUrl && (
                  <a
                    href={directionsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-1 rounded-lg border border-neon/30 bg-neon/10 px-2.5 py-1 text-xs font-semibold text-neon transition hover:bg-neon/20"
                    title="Cómo llegar"
                  >
                    <Navigation className="h-3.5 w-3.5" /> Llegar
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}