/**
 * Utilidades de geolocalización para SpotterX
 */

/**
 * Calcula la distancia en kilómetros entre dos coordenadas usando la fórmula de Haversine.
 */
export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Radio de la Tierra en km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Formatea una distancia en km para visualización en UI amigable:
 * - Menor a 1 km: "450 m" o "80 m"
 * - 1 km o más: "1.2 km", "14 km"
 */
export function formatDistance(km: number | null | undefined): string | null {
  if (km == null || isNaN(km)) return null;
  if (km < 1) {
    const meters = Math.round(km * 1000);
    return `${meters} m`;
  }
  if (km < 10) {
    return `${km.toFixed(1)} km`;
  }
  return `${Math.round(km)} km`;
}

/**
 * Genera la URL universal para abrir indicaciones de cómo llegar
 * en Google Maps (y redirige a Apple Maps en iOS si el usuario lo prefiere).
 */
export function getDirectionsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

/**
 * URL de tiles oscuros estilo "Dark Matter" usando el servicio público
 * de Esri World Dark Gray Canvas (no requiere API key) y su atribución.
 */
export const DARK_MAP_TILES = {
  url: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
  attribution:
    'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community',
  maxZoom: 19,
};

/**
 * Datos estructurados de una dirección para geocodificar.
 */
export interface AddressParts {
  street?: string;
  streetNumber?: string;
  city?: string;
  province?: string;
  postalCode?: string;
}

/**
 * Concatena los datos estructurados en una dirección legible ("Calle Altura").
 */
export function formatAddress(parts: AddressParts | null | undefined): string {
  if (!parts) return "";
  const street = [parts.street, parts.streetNumber].filter(Boolean).join(" ").trim();
  const rest = [parts.city, parts.province, parts.postalCode].filter(Boolean).join(", ").trim();
  return [street, rest].filter(Boolean).join(", ");
}

/**
 * Geocodifica una dirección usando Nominatim (OpenStreetMap, gratis, sin API key).
 * Prefiere los parámetros estructurados (street/city/state/postalcode, país AR)
 * que son más precisos que el texto libre; cae a `q=` si no hay campo street.
 * Retorna null si no encuentra resultados o falla la petición.
 */
export async function geocodeAddress(
  parts: AddressParts | string
): Promise<{ lat: number; lng: number; displayName: string } | null> {
  try {
    const params = new URLSearchParams({ format: "json", limit: "1" });
    if (typeof parts === "string") {
      params.set("q", parts);
    } else {
      params.set("countrycodes", "ar");
      params.set("city", parts.city ?? "");
      params.set("state", parts.province ?? "");
      params.set("postalcode", parts.postalCode ?? "");
      const street = [parts.street ?? "", parts.streetNumber ?? ""]
        .filter(Boolean)
        .join(" ")
        .trim();
      if (street) {
        params.set("street", street);
      } else {
        params.delete("city");
        params.delete("state");
        params.delete("postalcode");
        params.set("q", [parts.city, parts.province, parts.postalCode].filter(Boolean).join(", "));
      }
    }
    const url = `https://nominatim.openstreetmap.org/search?${params.toString()}`;
    const res = await fetch(url, { headers: { "User-Agent": "SpotterXApp/1.0 (spotterx fitness app)" } });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      lat: string;
      lon: string;
      display_name: string;
    }[];
    if (!data || data.length === 0) return null;
    return {
      lat: Number(data[0].lat),
      lng: Number(data[0].lon),
      displayName: data[0].display_name,
    };
  } catch {
    return null;
  }
}
