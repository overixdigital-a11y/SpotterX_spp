/**
 * Listas compartidas del catalogo (ejercicios y alimentos).
 *
 * Viven ACA y no en los componentes para que /admin/catalogo ofrezca
 * exactamente los mismos grupos y categorias que los selectores de rutinas y
 * dietas. Si se duplicaran, el admin podria crear un ejercicio con un grupo
 * que el picker nunca muestra.
 */

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
