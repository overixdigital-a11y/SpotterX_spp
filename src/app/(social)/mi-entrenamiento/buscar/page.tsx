"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Clock3, Loader2, MapPin, MessageCircle, Navigation, Search, User } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuthState } from "@/lib/auth-context";
import { Avatar } from "@/components/core/Avatar";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

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

const ARG_CENTER: [number, number] = [-38.6, -63.6];

interface Zone {
  id: string;
  trainer_id: string;
  name: string | null;
  city: string | null;
  address: string | null;
  availability: string | null;
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
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    let active = true;
    const load = async () => {
      const { data: z } = await supabase
        .from("trainer_gyms")
        .select("id, trainer_id, name, city, address, availability, latitude, longitude")
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
        setCenter([pos.coords.latitude, pos.coords.longitude]);
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
      if (!acc.has(z.trainer_id)) acc.set(z.trainer_id, { prof, zone: z });
      return acc;
    }, new Map<string, { prof: TrainerProfile; zone: Zone }>()).values()
  );

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
          className="flex shrink-0 items-center gap-1 rounded-full border border-neon/40 bg-neon/10 px-3 py-1.5 text-xs font-semibold text-neon"
        >
          {locating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Navigation className="h-3.5 w-3.5" />}
          Mi zona
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

      {mapZones.length > 0 ? (
        <div className="mt-3 overflow-hidden rounded-2xl border border-edge">
          <MapContainer
            key={center.join(",")}
            center={center}
            zoom={5}
            scrollWheelZoom={false}
            style={{ height: "280px", width: "100%" }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {mapZones.map((z) => {
              const prof = profiles.get(z.trainer_id);
              if (!prof) return null;
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
                      <div className="mt-2 flex gap-2">
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
                          <MessageCircle className="h-3 w-3" /> Mensaje
                        </Link>
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
        {trainers.map(({ prof, zone }) => (
          <div key={prof.id} className="mb-2 flex items-center gap-3 rounded-xl border border-edge bg-card p-3.5">
            <Avatar src={prof.avatar_url} name={prof.full_name} username={prof.username} size="md" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-ink">{prof.full_name || prof.username}</p>
              <p className="truncate text-xs text-muted">
                @{prof.username} · {zone.name}
                {zone.city ? ` · ${zone.city}` : ""}
              </p>
              {zone.availability && (
                <p className="flex items-center gap-1 text-xs text-neon">
                  <Clock3 className="h-3 w-3" /> {zone.availability}
                </p>
              )}
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
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}