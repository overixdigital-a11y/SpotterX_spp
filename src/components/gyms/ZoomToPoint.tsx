"use client";

import { useMap } from "react-leaflet";
import { LocateFixed } from "lucide-react";

interface Props {
  lat: number;
  lng: number;
  className?: string;
  label?: string;
}

export default function ZoomToPoint({ lat, lng, className, label = "Ubicar en el mapa" }: Props) {
  const map = useMap();
  return (
    <button
      type="button"
      onClick={() => map.setView([lat, lng], Math.max(map.getZoom(), 15))}
      className={className}
    >
      <LocateFixed className="h-3 w-3 shrink-0" /> {label}
    </button>
  );
}