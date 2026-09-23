"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { DARK_MAP_TILES, getDirectionsUrl } from "@/lib/geo";
import { Navigation } from "lucide-react";
import LeafletAutoResize from "@/components/gyms/LeafletAutoResize";

// Fix de iconos por defecto de leaflet en bundlers
const icon = L.icon({
  iconUrl:
    "data:image/svg+xml," +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="46"><path fill="#00f2fe" stroke="#05070a" stroke-width="1.5" d="M15 0C6.7 0 0 6.7 0 15c0 9.7 15 31 15 31s15-21.3 15-31C30 6.7 23.3 0 15 0z"/><circle cx="15" cy="15" r="6" fill="#05070a"/></svg>`
    ),
  iconSize: [30, 46],
  iconAnchor: [15, 46],
  popupAnchor: [0, -40],
});

// El prop center de MapContainer solo vale al montar; este control sigue la
// coordenada prop y mueve la vista (setView) cada vez que cambia el pin.
function MapController({ latitude, longitude }: { latitude: number; longitude: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([latitude, longitude], Math.max(map.getZoom(), 14));
  }, [map, latitude, longitude]);
  return null;
}

export default function GymMap({
  latitude,
  longitude,
  name,
}: {
  latitude: number;
  longitude: number;
  name?: string | null;
}) {
  const pos: [number, number] = [latitude, longitude];
  return (
    <MapContainer
      center={pos}
      zoom={15}
      scrollWheelZoom={false}
      style={{ height: "180px", width: "100%", borderRadius: 12, backgroundColor: "#0c1017" }}
    >
      <MapController latitude={latitude} longitude={longitude} />
      <LeafletAutoResize />
      <TileLayer
        attribution={DARK_MAP_TILES.attribution}
        url={DARK_MAP_TILES.url}
      />
      <Marker position={pos} icon={icon}>
        <Popup>
          <div className="min-w-[150px] p-0.5 text-sm">
            <p className="font-bold text-[#111]">{name ?? "Gimnasio"}</p>
            <a
              href={getDirectionsUrl(latitude, longitude)}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 flex items-center justify-center gap-1.5 rounded-lg bg-[#00f2fe] px-2.5 py-1 text-xs font-semibold text-[#05070a] transition hover:brightness-110"
            >
              <Navigation className="h-3 w-3" />
              Cómo llegar
            </a>
          </div>
        </Popup>
      </Marker>
    </MapContainer>
  );
}
