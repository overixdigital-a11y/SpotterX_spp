/**
 * Listas compartidas del catalogo (ejercicios y alimentos).
 *
 * Viven ACA y no en los componentes para que /admin/catalogo ofrezca
 * exactamente los mismos grupos y categorias que los selectores de rutinas y
 * dietas. Si se duplicaran, el admin podria crear un ejercicio con un grupo
 * que el picker nunca muestra.
 */

import { getDiscipline } from "@/lib/disciplines";

/** Grupos musculares del catalogo de ejercicios, en orden de despliegue. */
export const MUSCLE_ORDER = [
  "pecho",
  "espalda",
  "hombros",
  "bíceps",
  "tríceps",
  "antebrazo",
  "cuádriceps",
  "femoral",
  "glúteos",
  "pantorrilla",
  "core",
  "full body",
  "cardio",
  "técnica",
  "movilidad",
  "otro",
];

/** Categorias del catalogo de alimentos, en orden de despliegue. */
export const FOOD_CATEGORY_ORDER = [
  "Proteínas",
  "Carbohidratos",
  "Frutas",
  "Verduras",
  "Lácteos",
  "Grasas y frutos secos",
  "Panadería y tostadas",
  "Comidas preparadas",
  "Bebidas",
  "Snacks y ultraprocesados",
  "Conservas",
  "Condimentos y especias",
  "Otros",
];

/**
 * Movimientos que el catalogo guarda con DOS nombres distintos (es/en). El
 * admin lo ve como aviso al subir la foto, para no subirla dos veces a mano:
 * si una de las dos filas ya tiene foto propia, la otra muestra un boton para
 * copiarla en vez de un boton de subir.
 *
 * Si alguna de las dos filas no esta en la base (alguien la borro), el boton
 * simplemente no aparece: la busqueda del par se hace sobre lo que hay.
 */
export const EQUIVALENT_EXERCISE_PAIRS: string[][] = [
  ["Curl nórdico", "Nordic curl"],
  ["Toes to bar", "Punteras a la barra"],
  ["Cuerdas de batalla", "Battle ropes"],
  ["Subir escalones", "Step ups"],
];

/** Devuelve el par del que `name` forma parte, o null si no esta duplicado. */
export function findEquivalentExercise(name: string): string | null {
  const needle = name.trim().toLowerCase();
  for (const pair of EQUIVALENT_EXERCISE_PAIRS) {
    if (pair.some((n) => n.trim().toLowerCase() === needle)) {
      return pair.find((n) => n.trim().toLowerCase() !== needle) ?? null;
    }
  }
  return null;
}

/**
 * Normaliza texto para poder buscarlo. Saca acentos y pasa a minúsculas.
 *
 * Hace falta porque el usuario busca lo que VE en pantalla, y en pantalla la
 * disciplina dice "Musculación/Fuerza" mientras que en la base esta
 * "musculacion". Con un `toLowerCase().includes()` a secas, escribir
 * "musculación" no encontraba nada aunque la palabra se viera literally
 * enfrente.
 *
 * No colapsa espacios ni quita signos: para `includes` sobre el texto ya
 * normalizado alcanza, y no queremos perder por ejemplo el "/" de
 * "Musculación/Fuerza" (si lo quitáramos, "fuerza" seguiría matcheando pero
 * "musculación/fuerza" dejaria de matchear el slug completo).
 */
export const normalizeSearch = (s: string | null | undefined): string =>
  (s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

/**
 * Decide si un ejercicio entra en los resultados de una búsqueda de texto.
 *
 * Matchea por nombre, grupo muscular y disciplina. Y de la disciplina matchea
 * el **slug** (`musculacion`, que es lo que guarda la base) Y la **etiqueta**
 * (`Musculación/Fuerza`, que es lo que se muestra): las etiquetas tienen una
 * segunda palabra muy buscable — "fuerza", "resistencia", "trail", "pilates" —
 * que contra el slug nunca va a matchear.
 *
 * Ojo con normalizar el texto buscado y luego hacer `includes` sobre el campo
 * YA normalizado: no hay que re-normalizar los campos en cada llamada, se
 * normalizan contra `q` que ya viene normalizado de `normalizeSearch`.
 */
export function exerciseMatchesQuery(
  e: { name: string; muscle?: string | null; discipline?: string | null },
  q: string
): boolean {
  const needle = normalizeSearch(q);
  if (!needle) return true;
  return (
    normalizeSearch(e.name).includes(needle) ||
    normalizeSearch(e.muscle).includes(needle) ||
    normalizeSearch(e.discipline).includes(needle) ||
    normalizeSearch(getDiscipline(e.discipline ?? null)?.label).includes(needle)
  );
}

/** Etiqueta legible de una disciplina, o el valor crudo si no la conocemos. */
export function disciplineLabel(id: string | null | undefined): string {
  if (!id) return "";
  return getDiscipline(id)?.label ?? id;
}
