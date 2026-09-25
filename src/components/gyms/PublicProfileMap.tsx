"use client";

import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { DARK_MAP_TILES, getDirectionsUrl } from "@/lib/geo";
import ZoomToPoint from "@/components/gyms/ZoomToPoint";
import LeafletAutoResize from "@/components/gyms/LeafletAutoResize";
import { Navigation, Maximize2 } from "lucide-react";

export interface PublicMapGym {
  gym_id?: string;
  name?: string | null;
  city?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

export interface PublicMapZona {
  id?: string;
  name?: string | null;
  city?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  availability?: string | null;
  disciplines?: (string | null)[] | null;
  description?: string | null;
  notes?: string | null;
}

const gymIcon = L.icon({
  iconUrl: "data:image/svg+xml," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="30" height="46"><path fill="#00f2fe" stroke="#05070a" stroke-width="1.5" d="M15 0C6.7 0 0 6.7 0 15c0 9.7 15 31 15 31s15-21.3 15-31C30 6.7 23.3 0 15 0z"/><circle cx="15" cy="15" r="6" fill="#05070a"/></svg>`),
  iconSize: [30, 46],
  iconAnchor: [15, 46],
  popupAnchor: [0, -40],
});

const zonaIcon = L.icon({
  iconUrl: "data:image/svg+xml," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="30" height="46"><path fill="#ff5e36" stroke="#05070a" stroke-width="1.5" d="M15 0C6.7 0 0 6.7 0 15c0 9.7 15 31 15 31s15-21.3 15-31C30 6.7 23.3 0 15 0z"/><circle cx="15" cy="15" r="6" fill="#05070a"/></svg>`),
  iconSize: [30, 46],
  iconAnchor: [15, 46],
  popupAnchor: [0, -40],
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

export function PublicProfileMap({ gyms, zonas }: { gyms: PublicMapGym[]; zonas: PublicMapZona[] }) {
  const allPlaces = [
    ...gyms.map((g) => ({
      name: g.name,
      city: g.city,
      address: g.address,
      lat: g.latitude,
      lng: g.longitude,
      isGym: true,
    })),
    ...zonas.map((z) => ({ name: z.name, city: z.city, address: z.address, lat: z.latitude, lng: z.longitude, isGym: false })),
  ];
  const withCoords = allPlaces.filter((p) => typeof p.lat === "number" && typeof p.lng === "number");
  if (withCoords.length === 0) return null;

  const gymsWithCoords = gyms.filter((g) => typeof g.latitude === "number" && typeof g.longitude === "number");
  const zonasWithCoords = zonas.filter((z) => typeof z.latitude === "number" && typeof z.longitude === "number");

  return (
    <div className="relative z-0 w-full min-w-0 max-w-full overflow-hidden rounded-2xl border border-edge">
      <MapContainer
        center={[withCoords[0].lat!, withCoords[0].lng!]}
        zoom={12}
        scrollWheelZoom={false}
        style={{ height: "220px", width: "100%", backgroundColor: "#0c1017" }}
      >
        <LeafletAutoResize />
        <TileLayer attribution={DARK_MAP_TILES.attribution} url={DARK_MAP_TILES.url} />
        {withCoords.length > 1 && (
          <FitAllButton points={withCoords.map((p) => [p.lat as number, p.lng as number])} />
        )}
        {gymsWithCoords.map((g) => (
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
        {zonasWithCoords.map((z) => (
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
        <div className="pointer-events-none absolute left-1/2 top-2 z-[500] -translate-x-1/2 whitespace-nowrap rounded-full border border-edge bg-[#0c1017]/90 px-3 py-1 text-[11px] font-semibold text-muted">
          Alejá el mapa para ver todos los lugares
        </div>
      )}
    </div>
  );
}