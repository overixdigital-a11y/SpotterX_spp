/**
 * Genera `src/lib/exercise-images.ts` a partir de `yuhonas/free-exercise-db`.
 *
 * Herramienta de desarrollo: NO se deploya ni se importa desde la app.
 *
 *   node scripts/build-exercise-images.mjs           genera el archivo
 *   node scripts/build-exercise-images.mjs --check   solo reporta, no escribe
 *
 * El mapeo espanol -> ingles es curado a mano (CURATED) porque los nombres del
 * catalogo usan una taxonomia propia que no existe en el dataset. Lo que el
 * script automatiza es encontrar el `id` exacto de cada nombre ingles, que es lo
 * que se equivoca al escribirlo a mano.
 */

import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const DATASET_URL =
  "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json";
const IMAGE_BASE =
  "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_FILE = join(ROOT, "src", "lib", "exercise-images.ts");
const CACHE_FILE = join(tmpdir(), "free-exercise-db-exercises.json");
const SEEDS = [
  join(ROOT, "supabase", "migrations", "00018_exercises_catalog.sql"),
  join(ROOT, "supabase", "migrations", "00019_exercises_muscle_es.sql"),
];

/**
 * Mapeo curado: nombre exacto de `public.exercises` -> nombre en el dataset.
 *
 * La lista esta elegida a proposito:
 *  - 15 ejercicios comunes (lo que un profe elige el 90% de las veces)
 *  - 5 delicados, donde el equivalente en ingles no es obvio
 *  - 5 de cola, de los que dos NO existen en el dataset a proposito, para
 *    probar que la degradacion (fila sin imagen, igual que hoy) funciona.
 */
const CURATED = [
  // --- comunes ---
  { es: "Press de banca", en: "Barbell Bench Press - Medium Grip" },
  { es: "Press inclinado con mancuernas", en: "Incline Dumbbell Press" },
  { es: "Press de hombros", en: "Barbell Shoulder Press" },
  { es: "Sentadilla", en: "Barbell Squat" },
  { es: "Sentadilla búlgara", en: "Barbell Side Split Squat" },
  { es: "Peso muerto", en: "Barbell Deadlift" },
  { es: "Remo con barra", en: "Bent Over Barbell Row" },
  { es: "Remo con mancuerna", en: "One-Arm Dumbbell Row" },
  { es: "Dominadas", en: "Pullups" },
  { es: "Curl de bíceps con barra", en: "Barbell Curl" },
  { es: "Extensiones de tríceps en polea", en: "Triceps Pushdown" },
  { es: "Hip thrust", en: "Barbell Hip Thrust" },
  { es: "Crunch abdominal", en: "Crunches" },
  { es: "Plancha abdominal", en: "Plank" },
  { es: "Fondos en paralelas", en: "Parallel Bar Dip" },
  { es: "Zancadas", en: "Barbell Walking Lunge" },

  // --- delicados (el equivalente en ingles no es obvio) ---
  { es: "Peso muerto rumano", en: "Romanian Deadlift" },
  { es: "Press francés", en: "EZ-Bar Skullcrusher" },
  { es: "Sentadilla pistola", en: "Kettlebell Pistol Squat" },
  { es: "Dominadas lastradas", en: "Weighted Pull Ups" },
  { es: "Kettlebell clean and press", en: "Clean and Press" },

  // --- cola ---
  { es: "Handstand push-up", en: "Handstand Push-Ups" },
  { es: "Flexión de pino", en: "Handstand Push-Ups" },
  { es: "Mountain climbers", en: "Mountain Climbers" },
  { es: "Caminata del granjero", en: "Farmer's Walk" },
  { es: "Salto al cajón", en: "Front Box Jump" },

  // --- ausentes a proposito: verifican que la app degrade en vez de romper ---
  { es: "Curl nórdico", en: "Nordic Curl", optional: true },
  { es: "Bird dog", en: "Bird Dog", optional: true },
];

/** minusculas, sin acentos, sin puntuacion, espacios colapsados. */
function norm(s) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

async function loadDataset() {
  if (!existsSync(CACHE_FILE)) {
    process.stdout.write("bajando dataset... ");
    const res = await fetch(DATASET_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status} bajando ${DATASET_URL}`);
    await writeFile(CACHE_FILE, await res.text(), "utf8");
    console.log("ok");
  }
  return JSON.parse(await readFile(CACHE_FILE, "utf8"));
}

/**
 * Nombres que los seeds de `exercises` insertan. Sirve para detectar una falta
 * de acento o un nombre mal tipeado en CURATED: si el espanol no existe en el
 * catalogo, el mapping no sirve aunque el ingles haya matcheado.
 */
async function loadSeedNames() {
  const names = new Set();
  for (const file of SEEDS) {
    if (!existsSync(file)) continue;
    const sql = await readFile(file, "utf8");
    for (const m of sql.matchAll(/\(\s*'((?:[^']|'')+)'\s*,/g)) {
      names.add(m[1].replace(/''/g, "'"));
    }
  }
  return names;
}

function suggest(dataset, en, limit = 4) {
  const words = new Set(norm(en).split(" ").filter((w) => w.length > 3));
  return dataset
    .map((e) => {
      const n = norm(e.name).split(" ");
      const hits = n.filter((w) => words.has(w)).length;
      return { e, score: hits / Math.max(words.size, 1) };
    })
    .filter((x) => x.score >= 0.5)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.e.name);
}

async function main() {
  const checkOnly = process.argv.includes("--check");
  const dataset = await loadDataset();
  const seedNames = await loadSeedNames();

  const byName = new Map(dataset.map((e) => [norm(e.name), e]));
  const byId = new Map(dataset.map((e) => [e.id.toLowerCase(), e]));

  const rows = [];
  const missing = [];
  const badSpanish = [];

  for (const { es, en, optional } of CURATED) {
    if (!seedNames.has(es)) badSpanish.push(es);

    // 1) por nombre normalizado, 2) por id (por si se paso el id en vez del nombre)
    const hit = byName.get(norm(en)) ?? byId.get(en.toLowerCase());

    if (!hit) {
      missing.push({ es, en, optional, near: suggest(dataset, en) });
      continue;
    }
    if (!hit.images?.length) {
      missing.push({ es, en, optional, near: [`(id ${hit.id} existe pero sin imagen)`] });
      continue;
    }
    rows.push({ es, en: hit.name, id: hit.id });
  }

  const okCount = rows.length;
  console.log(`\nmatcheados: ${okCount}/${CURATED.length}`);

  if (badSpanish.length) {
    console.log(`\n[AVISO] ${badSpanish.length} nombre(s) es NO estan en los seeds:`);
    for (const es of badSpanish) console.log(`  - "${es}"  -> revisar acentos o nombre`);
  }

  if (missing.length) {
    console.log(`\nSIN IMAGEN (${missing.length}):`);
    for (const m of missing) {
      const tag = m.optional ? "esperado" : "REVISAR";
      console.log(`  - ${m.es}  ->  "${m.en}"  [${tag}]`);
      if (m.near.length) console.log(`      parecidos: ${m.near.join(" | ")}`);
    }
  }

  if (checkOnly) {
    console.log("\n--check: no se escribio nada.\n");
    return;
  }

  const lines = rows.map(
    (r) => `  "${r.es}":\n    "${IMAGE_BASE}/${r.id}/0.jpg",`
  );

  const out = `// AUTO-GENERADO por scripts/build-exercise-images.mjs. No editar a mano.
//
// Imagenes de \`yuhonas/free-exercise-db\` (Unlicense), hotlinkeadas a GitHub.
// Para regenerar o cambiar la muestra: node scripts/build-exercise-images.mjs
//
// Solo cubre ${okCount} de los ~156 ejercicios del catalogo, y a proposito:
// los que no estan en este mapa NO muestran imagen y la fila se renderiza
// exactamente como antes (sin thumbnail). Ver \`exerciseImage()\`.

/** Interruptor de una linea para apagar todas las imagenes sin borrar codigo. */
export const SHOW_EXERCISE_IMAGES = true;

const IMAGES: Record<string, string> = {
${lines.join("\n")}
};

/**
 * Devuelve la URL de la imagen de un ejercicio por su nombre, o \`null\`.
 * El catalogo tiene \`unique(lower(name))\`, asi que la busqueda va en minusculas.
 */
export function exerciseImage(name: string | null | undefined): string | null {
  if (!SHOW_EXERCISE_IMAGES || !name) return null;
  return IMAGES[name.toLowerCase().trim()] ?? null;
}
`;

  await writeFile(OUT_FILE, out, "utf8");
  console.log(`\nescrito: ${OUT_FILE} (${okCount} imagenes)\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
