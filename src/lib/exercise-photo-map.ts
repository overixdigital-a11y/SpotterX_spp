import { createClient } from "@/lib/supabase/client";
import { normalizeExerciseName } from "@/lib/exercise-images";

/**
 * Mapa de fotos propias de ejercicios (las que sube el admin desde
 * /admin/catalogo), indexado por el MISMO nombre normalizado que el mapa
 * estatico de `src/lib/exercise-images.ts`.
 *
 * Por que hace falta: `trainer_routine_items.exercise` y
 * `trainer_plan_items.exercise` guardan el nombre del ejercicio como TEXTO, no
 * un id. O sea que la foto se busca SIEMPRE por nombre. La foto propia gana
 * sobre la estatica de `public/exercises/`; si no hay foto propia, se usa la
 * estatica, y si tampoco, no se muestra nada.
 *
 * Se baja UNA sola vez por sesion y se cachea a nivel modulo. Las pantallas que
 * muestran rutinas la cargan dentro de su propio loading para que la miniatura
 * no aparezca "parpadeando" despues.
 */

/** Host de Storage. Las fotos del bucket `media` se sirven desde aca. */
export const SUPABASE_STORAGE_HOST = "dzalgziofiwcljgnphap.supabase.co";

let cache: Record<string, string> | null = null;
let inflight: Promise<Record<string, string>> | null = null;

/**
 * Trae `exercises.image_url` de los que tienen foto. Degrada con gracia: si la
 * tabla todavia no tiene la columna (migracion 00048 sin correr) la query falla
 * y devolvemos un mapa vacio => queda solo el mapa estatico, sin romperse nada.
 */
export async function loadExercisePhotoMap(): Promise<Record<string, string>> {
  if (cache) return cache;
  if (inflight) return inflight;

  inflight = (async () => {
    const map: Record<string, string> = {};
    try {
      const { data, error } = await createClient()
        .from("exercises")
        .select("name, image_url")
        .not("image_url", "is", null);

      if (!error && data) {
        for (const row of data as { name: string; image_url: string | null }[]) {
          if (row.image_url) map[normalizeExerciseName(row.name)] = row.image_url;
        }
      }
    } catch {
      // sin foto propia => comportamiento anterior (solo mapa estatico)
    }
    cache = map;
    inflight = null;
    return map;
  })();

  return inflight;
}

/**
 * Version sincronica para renderizar. Devuelve {} si todavia no se cargo, y en
 * ese caso el ExerciseThumb cae al mapa estatico: se ve algo desde el primer
 * frame, nunca un hueco.
 */
export function exercisePhotoMap(): Record<string, string> {
  return cache ?? {};
}

/** Invalida el cache. Se usa tras subir/quitar una foto para verla al toque. */
export function resetExercisePhotoMap(): void {
  cache = null;
  inflight = null;
}
