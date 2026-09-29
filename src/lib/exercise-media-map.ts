import { createClient } from "@/lib/supabase/client";
import { normalizeExerciseName } from "@/lib/exercise-images";

/**
 * Mapa de material propio de ejercicios (el que sube el admin desde
 * /admin/catalogo), indexado por el MISMO nombre normalizado que el mapa
 * estatico de `src/lib/exercise-images.ts`.
 *
 * Por que hace falta: `trainer_routine_items.exercise` y
 * `trainer_plan_items.exercise` guardan el nombre del ejercicio como TEXTO, no
 * un id. O sea que el material se busca SIEMPRE por nombre. El material propio
 * gana sobre la estatico de `public/exercises/`; si no hay, se usa la estatico,
 * y si tampoco, no se muestra nada.
 *
 * `fotos[0]` es la portada (la que se ve en la lista). `video` es opcional y
 * SOLO se reproduce cuando el usuario abre el visor: la lista nunca lo carga.
 *
 * Se baja UNA sola vez por sesion y se cachea a nivel de modulo. Las pantallas
 * que muestran rutinas la cargan dentro de su propio loading para que la
 * miniatura no aparezca "parpadeando" despues.
 */

/** Host de Storage. Los archivos del bucket `media` se sirven desde aca. */
export const SUPABASE_STORAGE_HOST = "dzalgziofiwcljgnphap.supabase.co";

/** Material propio de un ejercicio. `fotos` nunca es null (puede estar vacio). */
export type ExerciseMedia = {
  fotos: string[];
  video: string | null;
};

/** Nombre normalizado -> material. Sin entrada = sin material propio. */
export type ExerciseMediaMap = Record<string, ExerciseMedia>;

let cache: ExerciseMediaMap | null = null;
let inflight: Promise<ExerciseMediaMap> | null = null;

/**
 * Trae `exercises.image_urls` / `exercises.demo_url` de los que tienen algo.
 * Degrada con gracia: si la tabla todavia no tiene las columnas (migracion
 * 00049 sin correr) la query falla y devolvemos un mapa vacio => queda solo el
 * mapa estatico, sin romperse nada.
 *
 * Se filtran las filas en JS en vez de usar `.not(...)/.or(...)` porque son
 * ~157 filas y asi el filtro queda en un solo lugar y no se rompe si mañana la
 * consulta cambia.
 */
export async function loadExerciseMediaMap(): Promise<ExerciseMediaMap> {
  if (cache) return cache;
  if (inflight) return inflight;

  inflight = (async () => {
    const map: ExerciseMediaMap = {};
    try {
      const { data, error } = await createClient()
        .from("exercises")
        .select("name, image_urls, demo_url");

      if (!error && data) {
        for (const row of data as {
          name: string;
          image_urls: string[] | null;
          demo_url: string | null;
        }[]) {
          const fotos = (row.image_urls ?? []).filter(
            (u): u is string => typeof u === "string" && u !== ""
          );
          const video = row.demo_url ?? null;
          if (fotos.length === 0 && !video) continue;
          map[normalizeExerciseName(row.name)] = { fotos, video };
        }
      }
    } catch {
      // sin material propio => comportamiento anterior (solo mapa estatico)
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
export function exerciseMediaMap(): ExerciseMediaMap {
  return cache ?? {};
}

/** Invalida el cache. Se usa tras subir/quitar material para verlo al toque. */
export function resetExerciseMediaMap(): void {
  cache = null;
  inflight = null;
}

/**
 * Saca la ruta del bucket de una URL publica de Storage, para poder borrar el
 * archivo con `storage.from("media").remove([path])`.
 *
 * Las URLs del admin salen de `getPublicUrl()`, asi que tienen esta forma:
 *   https://<host>/storage/v1/object/public/media/<uid>/ejercicios/archivo.jpg
 * Devuelve null si la URL no es del bucket `media` => antes de borrar hay que
 * revisar que ninguna otra fila la este usando.
 */
export function mediaPathFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const marker = "/storage/v1/object/public/media/";
  const i = url.indexOf(marker);
  if (i === -1) return null;
  const path = url.slice(i + marker.length);
  return path ? decodeURIComponent(path) : null;
}
