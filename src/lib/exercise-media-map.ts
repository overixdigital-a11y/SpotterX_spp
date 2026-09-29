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
 * ---------------------------------------------------------------------------
 * POR QUE ESTO ES UN STORE Y NO UNA CACHE CIEGA
 * ---------------------------------------------------------------------------
 * La primera version era `if (cache) return cache;` sin vencimiento, y eso
 * rompia en el caso mas comun de todos: el admin sube una foto en UNA pestana
 * y mira la rutina en OTRA. La memoria de un modulo JS es POR PESTANA, asi que
 * `resetExerciseMediaMap()` en la pestana del admin no toca la copia de la
 * otra, y esa otra se queda sirviendo el snapshot viejo para siempre. El
 * sintoma era "subi la foto y sigue la de la app"; recargar lo tapaba, por eso
 * parecia intermitente. Con 64 fotos y 64 videos por cargar era un problema
 * de verdad, no un detalle.
 *
 * Ahora son tres cosas juntas:
 *   1. REALTIME sobre `exercises` (ya esta en `supabase_realtime` desde la
 *      00018, pero nadie se suscribia) => una pestana abierta se entera sola
 *      de lo que se sube en otra, o en otro dispositivo.
 *   2. TTL => si realtime no llega (red floja, o si algun dia se saca la tabla
 *      de la publicacion), el dato se refresca solo al pasar el plazo.
 *   3. Suscribirse => los `<ExerciseThumb>` ya montados se repintan con
 *      `useSyncExternalStore` sin que las pantallas testeen nada.
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

/**
 * Cuanto vive el snapshot antes de darse por viejo. Es una red de seguridad,
 * no el mecanismo principal: con realtime andando casi nunca se llega aca.
 */
const TTL_MS = 60_000;

/**
 * Agrupacion de eventos. Un rename en cascada o un lote de fotos cambian
 * varias filas juntas; sin esto seria un request por fila.
 */
const REALTIME_DEBOUNCE_MS = 1_500;

let cache: ExerciseMediaMap | null = null;
let cachedAt = 0;
let inflight: Promise<ExerciseMediaMap> | null = null;
let realtimeOn = false;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Snapshot vacio ESTABLE. `useSyncExternalStore` compara con `Object.is` en
 * cada render: devolver un `{}` recien creado cada vez lo haria entrar en loop
 * infinito. Tiene que ser la misma referencia siempre.
 */
const EMPTY_MAP: ExerciseMediaMap = {};

// --- store: avisar a los que estan mirando -----------------------------------

const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

/**
 * Se suscribe a los cambios del mapa. Lo usan las miniaturas montadas para
 * repintarse solas; ninguna pantalla tiene que enterarse de nada.
 */
export function subscribeExerciseMedia(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/**
 * El mapa actual, o el vacio estable si todavia no se cargo. Se pasa tal cual
 * a `useSyncExternalStore` como `getSnapshot`.
 */
export function getExerciseMediaMap(): ExerciseMediaMap {
  return cache ?? EMPTY_MAP;
}

/** Compara contenido. Si no cambio nada se conserva la referencia anterior. */
function sameMap(a: ExerciseMediaMap, b: ExerciseMediaMap): boolean {
  const keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length) return false;
  for (const k of keys) {
    const x = a[k];
    const y = b[k];
    if (!y) return false;
    if (x.video !== y.video) return false;
    if (x.fotos.length !== y.fotos.length) return false;
    for (let i = 0; i < x.fotos.length; i++) {
      if (x.fotos[i] !== y.fotos[i]) return false;
    }
  }
  return true;
}

// --- carga -------------------------------------------------------------------

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
async function fetchExerciseMediaMap(): Promise<ExerciseMediaMap> {
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

  // Si el contenido es identico se conserva la referencia previa: `emit()` con
  // un objeto nuevo repintaria todas las miniaturas sin motivo.
  if (cache && sameMap(cache, map)) {
    cachedAt = Date.now();
    return cache;
  }
  cache = map;
  cachedAt = Date.now();
  emit();
  return cache;
}

/**
 * Devuelve el mapa, refetch solo si todavia no se cargo o ya vencio el TTL.
 * Se sigue llamando al arranque de las pantallas de rutinas: como el mapa se
 * pide antes de dibujar los items, la miniatura no aparece "parpadeando" un
 * instante despues del nombre.
 */
export async function loadExerciseMediaMap(): Promise<ExerciseMediaMap> {
  ensureRealtime();
  if (cache && Date.now() - cachedAt < TTL_MS) return cache;
  if (inflight) return inflight;
  inflight = fetchExerciseMediaMap().finally(() => {
    inflight = null;
  });
  return inflight;
}

/**
 * Fuerza el refetch sin mirar el TTL. Es lo que dispara el evento de realtime
 * y el `resetExerciseMediaMap()` del admin.
 */
export async function refreshExerciseMediaMap(): Promise<ExerciseMediaMap> {
  ensureRealtime();
  if (inflight) return inflight;
  inflight = fetchExerciseMediaMap().finally(() => {
    inflight = null;
  });
  return inflight;
}

/**
 * Invalida el cache. Se usa tras subir/quitar material para verlo al toque.
 *
 * NO se vacia a la fuerza: se marca viejo y se refresca en background. Asi las
 * miniaturas que ya estan montadas no parpadean a la imagen estatica mientras
 * vuelve la consulta.
 */
export function resetExerciseMediaMap(): void {
  cachedAt = 0;
  void refreshExerciseMediaMap();
}

// --- realtime ----------------------------------------------------------------

/**
 * Se suscribe a los cambios de `exercises`. La tabla ya estaba en
 * `supabase_realtime` desde la 00018 pero nadie la escuchaba.
 *
 * Se arma de forma perezosa en el primer uso: una sesion que nunca muestra
 * rutinas no abre el websocket. Si la suscripcion falla (o la tabla no esta
 * en la publicacion) no rompe nada: queda el TTL de 60 s como red.
 */
function ensureRealtime() {
  if (realtimeOn) return;
  realtimeOn = true;
  try {
    createClient()
      .channel("exercise-media-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "exercises" },
        () => {
          if (debounceTimer) clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => {
            debounceTimer = null;
            void refreshExerciseMediaMap();
          }, REALTIME_DEBOUNCE_MS);
        }
      )
      .subscribe();
  } catch {
    realtimeOn = false;
  }
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
