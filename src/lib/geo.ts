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
  url: "https://{s}.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
  attribution:
    'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community',
  subdomains: "abcd",
  maxZoom: 19,
};
