"use client";

import Link from "next/link";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import LeafletAutoResize from "@/components/gyms/LeafletAutoResize";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { DARK_MAP_TILES, haversineDistance, formatDistance, getDirectionsUrl } from "@/lib/geo";
import ZoomToPoint from "@/components/gyms/ZoomToPoint";
import { MapPin, Clock3, Navigation, User, MessageCircle } from "lucide-react";

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

export interface SearchZone {
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

export interface SearchProf {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
}

export function TrainerSearchMap({
  zones,
  profiles,
  linked,
  userCoords,
  center,
  zoom,
}: {
  zones: SearchZone[];
  profiles: Map<string, SearchProf>;
  linked: Set<string>;
  userCoords: [number, number] | null;
  center: [number, number];
  zoom: number;
}) {
  return (
    <div className="mt-3 overflow-hidden rounded-2xl border border-edge">
      <MapContainer
        key={`${center.join(",")}-${zoom}`}
        center={center}
        zoom={zoom}
        scrollWheelZoom={false}
        style={{ height: "280px", width: "100%", backgroundColor: "#0c1017" }}
      >
        <LeafletAutoResize />
        <TileLayer attribution={DARK_MAP_TILES.attribution} url={DARK_MAP_TILES.url} />
        {userCoords && (
          <Marker position={userCoords} icon={userIcon}>
            <Popup>
              <div className="p-0.5 text-center text-xs font-bold text-[#111]">📍 Tu ubicación actual</div>
            </Popup>
          </Marker>
        )}
        {zones.map((z) => {
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
                    <p className="mt-0.5 text-xs font-semibold text-[#008ba3]">A {formatDistance(dist)} de vos</p>
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
  );
}