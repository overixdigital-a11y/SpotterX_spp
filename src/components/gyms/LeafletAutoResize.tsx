"use client";

import { useEffect } from "react";
import { useMap } from "react-leaflet";

// Leaflet solo mide su contenedor al montar; si ese momento el ancho es distinto
// al real (SSR/transiciones), el mapa queda interno mas ancho y se ve recortado
// en mobile. Al montar (y en cada resize del window) se fuerza invalidateSize().
export default function LeafletAutoResize() {
  const map = useMap();
  useEffect(() => {
    const t1 = window.setTimeout(() => map.invalidateSize(), 300);
    const t2 = window.setTimeout(() => map.invalidateSize(), 900);
    const onResize = () => map.invalidateSize();
    window.addEventListener("resize", onResize);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.removeEventListener("resize", onResize);
    };
  }, [map]);
  return null;
}