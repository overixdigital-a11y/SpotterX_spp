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
 * User-Agent propio para los pedidos a Nominatim (OpenStreetMap).
 * Requerido por la Usage Policy del servicio.
 */
const NOMINATIM_UA = "SpotterXApp/1.0 (spotterx fitness app)";

/**
 * Las 24 provincias de Argentina + CABA, con los nombres que acepta
 * el geocoder de Nominatim (parámetro `state`).
 */
export const ARG_PROVINCIAS: string[] = [
  "Ciudad de Buenos Aires",
  "Buenos Aires",
  "Catamarca",
  "Chaco",
  "Chubut",
  "Córdoba",
  "Corrientes",
  "Entre Ríos",
  "Formosa",
  "Jujuy",
  "La Pampa",
  "La Rioja",
  "Mendoza",
  "Misiones",
  "Neuquén",
  "Río Negro",
  "Salta",
  "San Juan",
  "San Luis",
  "Santa Cruz",
  "Santa Fe",
  "Santiago del Estero",
  "Tierra del Fuego",
  "Tucumán",
];

/**
 * Sugerencia de localidad para el buscador de ciudades.
 */
export interface CitySuggestion {
  name: string;
  province: string | null;
  postalCode: string | null;
  lat: number;
  lng: number;
  label: string;
}

/**
 * Busca localidades de Argentina para el autocompletado de ciudad
 * usando Nominatim (OSM, gratis, sin API key). Retorna [] si no hay
 * resultados o falla la petición.
 */
export async function autocompleteCity(q: string): Promise<CitySuggestion[]> {
  try {
    const params = new URLSearchParams({
      q,
      format: "json",
      countrycodes: "ar",
      limit: "6",
      "accept-language": "es",
    });
    const url = `https://nominatim.openstreetmap.org/search?${params.toString()}`;
    const res = await fetch(url, { headers: { "User-Agent": NOMINATIM_UA } });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      lat: string;
      lon: string;
      display_name: string;
      address?: {
        city?: string;
        town?: string;
        village?: string;
        municipality?: string;
        state?: string;
        postcode?: string;
      };
    }[];
    return data.map((d) => ({
      name:
        d.address?.city ??
        d.address?.town ??
        d.address?.village ??
        d.address?.municipality ??
        d.display_name.split(",")[0].trim(),
      province: d.address?.state ?? null,
      postalCode: d.address?.postcode ?? null,
      lat: Number(d.lat),
      lng: Number(d.lon),
      label: d.display_name,
    }));
  } catch {
    return [];
  }
}

/**
 * Sugerencia de gimnasio real (OpenStreetMap) para el buscador web.
 */
export interface WebGymSuggestion {
  name: string;
  city: string | null;
  lat: number;
  lng: number;
  label: string;
}

const GYM_TYPES = new Set([
  "fitness_centre",
  "sports_centre",
  "sports_hall",
  "gym",
  "gymnasium",
]);

/**
 * Busca gimnasios reales en OpenStreetMap (Nominatim, gratis, sin API key).
 * - Si hay `city`, lista los gimnasios de esa ciudad (amenity=gym) y filtra
 *   por el texto escrito (sin importar mayúsculas).
 * - Sin ciudad, cae a búsqueda libre filtrando resultados con pinta de gimnasio.
 * Retorna [] si no hay resultados o falla la petición.
 */
export async function searchGymsWeb(
  q: string,
  city?: string
): Promise<WebGymSuggestion[]> {
  try {
    if (city && city.trim()) {
      const params = new URLSearchParams({
        format: "json",
        countrycodes: "ar",
        amenity: "gym",
        city: city.trim(),
        limit: "50",
        "accept-language": "es",
      });
      const url = `https://nominatim.openstreetmap.org/search?${params.toString()}`;
      const res = await fetch(url, { headers: { "User-Agent": NOMINATIM_UA } });
      if (res.ok) {
        const data = (await res.json()) as {
          name: string;
          lat: string;
          lon: string;
          display_name: string;
        }[];
        const needle = q.trim().toLowerCase();
        return data
          .filter((d) => !needle || d.name.toLowerCase().includes(needle))
          .slice(0, 10)
          .map((d) => ({
            name: d.name,
            city: city.trim(),
            lat: Number(d.lat),
            lng: Number(d.lon),
            label: d.display_name,
          }));
      }
    }

    const params = new URLSearchParams({ format: "json", q, limit: "10", "accept-language": "es" });
    const url = `https://nominatim.openstreetmap.org/search?${params.toString()}`;
    const res = await fetch(url, { headers: { "User-Agent": NOMINATIM_UA } });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      name: string;
      type: string;
      class: string;
      lat: string;
      lon: string;
      display_name: string;
    }[];
    return data
      .filter((d) => GYM_TYPES.has(d.type) || /gym|fitness|crossfit|club/i.test(d.name))
      .map((d) => ({
        name: d.name,
        city: null,
        lat: Number(d.lat),
        lng: Number(d.lon),
        label: d.display_name,
      }));
  } catch {
    return [];
  }
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
    const res = await fetch(url, { headers: { "User-Agent": NOMINATIM_UA } });
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
