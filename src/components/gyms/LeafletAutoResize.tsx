"use client";

import { useEffect } from "react";
import { useMap } from "react-leaflet";

// Leaflet solo mide su contenedor al montar; si ese momento el ancho es distinto
// al real (SSR/transiciones/datos async), el mapa queda interno mas ancho y se ve
// recortado en mobile. Aqui se fuerza el ancho real del padre y invalidateSize():
// - retries escalonados para pillar el montaje tardio del mapa (datos async)
// - ResizeObserver sobre el padre: re-ajusta ante CUALQUIER cambio de layout
// - clamp explicito: el contenedor queda aferrado al ancho real del padre
export default function LeafletAutoResize() {
  const map = useMap();
  useEffect(() => {
    const el = map.getContainer();
    const parent = el.parentElement;
    const timers: number[] = [];
    const onResize = () => map.invalidateSize();
    let ro: ResizeObserver | null = null;

    const fit = () => {
      if (parent && parent.clientWidth > 0) {
        const w = Math.min(parent.clientWidth, window.innerWidth);
        const cur = el.style.width;
        el.style.width = `${w}px`;
        el.style.maxWidth = "100%";
        if (cur !== el.style.width) {
          // ancho efectivamente cambiado: forzar re-medicion en el proximo frame
          window.requestAnimationFrame(() => map.invalidateSize());
        }
      }
      map.invalidateSize();
    };

    [0, 60, 300, 900, 2000, 3500].forEach((ms) =>
      timers.push(window.setTimeout(fit, ms))
    );

    window.addEventListener("resize", onResize);
    if (parent && typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(() => window.setTimeout(fit, 0));
      ro.observe(parent);
    }

    return () => {
      timers.forEach((t) => window.clearTimeout(t));
      window.removeEventListener("resize", onResize);
      ro?.disconnect();
    };
  }, [map]);
  return null;
}