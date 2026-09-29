/**
 * Genera el mapa de miniaturas de ejercicios.
 *
 * Uso:
 *   node scripts/build-exercise-images.mjs            # genera mapa + descarga miniaturas
 *   node scripts/build-exercise-images.mjs --check    # solo valida (no escribe)
 *
 * REGLAS (no negociar):
 *  1. La clave del mapa se emite YA NORMALIZADA (minusculas, sin acentos, sin signos),
 *     exactamente igual que lo que hace `exerciseImage()` al buscar. Si divergen,
 *     el lookup devuelve null y no se ve ninguna foto.
 *  2. Un ejercicio SOLO tiene foto si el dataset tiene ese MOVIMIENTO EXACTO.
 *     Nada de "el mas parecido": una foto de Handstand Push-Ups al lado de
 *     "Flexion de pino" ensena el movimiento equivocado.
 *  3. `--check` prueba el LOOKUP REAL (`exerciseImage`) sobre cada clave y exige
 *     100% de acierto. Verificar que el nombre exista en los seeds no alcanza:
 *     asi paso el primer piloto con 0 de 25 imagenes.
 */

import { readFile, writeFile, mkdir, access } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import path from "node:path";
import os from "node:os";
import sharp from "sharp";

const DATASET_URL = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json";
const IMAGE_BASE = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/";
const THUMB_SIZE = 96;
const OUT_DIR = "public/exercises";
const OUT_MAP = "src/lib/exercise-images.ts";

const SEEDS = [
  "supabase/migrations/00018_exercises_catalog.sql",
  "supabase/migrations/00019_exercises_muscle_es.sql",
];

const DISCIPLINES = ["musculacion", "crossfit", "calistenia", "funcional"];

/** Mapeo curado a mano: nombre del catalogo (es) -> nombre exacto en el dataset (en). */
const MAP = {
  // ------------------------------------------------------------- musculacion
  "press de banca": "Barbell Bench Press - Medium Grip",
  "press inclinado con mancuernas": "Incline Dumbbell Press",
  "press de hombros": "Dumbbell Shoulder Press",
  "press militar": "Standing Military Press",
  "press frances": "EZ-Bar Skullcrusher",
  "sentadilla": "Barbell Squat",
  "sentadilla frontal": "Front Barbell Squat",
  "sentadilla bulgara": "Barbell Side Split Squat",
  "peso muerto": "Barbell Deadlift",
  "peso muerto rumano": "Romanian Deadlift",
  "remo con barra": "Bent Over Barbell Row",
  "remo con mancuerna": "One-Arm Dumbbell Row",
  "remo en polea baja": "Seated Cable Rows",
  "jalon al pecho": "Wide-Grip Lat Pulldown",
  "dominadas": "Pullups",
  "dominadas lastradas": "Weighted Pull Ups",
  "curl de biceps con barra": "Barbell Curl",
  "curl de biceps con mancuerna": "Dumbbell Bicep Curl",
  "curl martillo": "Hammer Curls",
  "extensiones de triceps en polea": "Triceps Pushdown - Rope Attachment",
  "aperturas con mancuernas": "Dumbbell Flyes",
  "elevaciones laterales": "Side Lateral Raise",
  "pajaros vuelos inversos": "Reverse Flyes",
  "hip thrust": "Barbell Hip Thrust",
  "prensa de piernas": "Leg Press",
  "extensiones de cuadriceps": "Leg Extensions",
  "curl de femoral en maquina": "Lying Leg Curls",
  "peso muerto sumo": "Sumo Deadlift",
  "zancadas": "Barbell Walking Lunge",
  "zancadas con mancuernas": "Dumbbell Lunges",
  "elevacion de pantorrillas": "Standing Calf Raises",
  "crunch abdominal": "Crunches",
  "plancha abdominal": "Plank",
  "russian twist": "Russian Twist",
  "ab wheel": "Ab Roller",
  "cruce de poleas": "Cable Crossover",
  "apertura en peck deck": "Butterfly",
  "press de pecho en maquina": "Leverage Chest Press",
  "pull over con mancuerna": "Bent-Arm Dumbbell Pullover",
  "remo en maquina": "Leverage High Row",
  "jalon con agarre cerrado": "Close-Grip Front Lat Pulldown",
  "dominada asistida": "Band Assisted Pull-Up",
  "encogimiento de hombros": "Barbell Shrug",
  "curl concentrado": "Concentration Curls",
  "curl en predicador": "Preacher Curl",
  "press de banca con agarre cerrado": "Close-Grip Barbell Bench Press",
  "extension de triceps con mancuerna": "Dumbbell One-Arm Triceps Extension",
  "puente de gluteos": "Barbell Glute Bridge",
  "sentadilla goblet": "Goblet Squat",
  "plancha lateral": "Side Bridge",
  "superman": "Superman",

  // ---------------------------------------------------------------- crossfit
  thruster: "Kettlebell Thruster",
  clean: "Clean",
  snatch: "Snatch",
  "clean jerk": "Clean and Jerk",
  "box jump": "Box Jump (Multiple Response)",
  "lanzamiento de balon medicinal": "Medicine Ball Chest Pass",
  "sandbag over shoulder": "Sandbag Load",
  "sled push": "Sled Push",
  "assault bike": "Air Bike",
  "pull up kipping": "Kipping Muscle Up",
  "ring muscle up": "Muscle Up",
  "handstand push up": "Handstand Push-Ups",
  "cargada de fuerza": "Power Clean",
  arrancada: "Snatch",
  envion: "Power Snatch",
  "salto al cajon": "Box Jump (Multiple Response)",
  "balon a la pared": "Medicine Ball Chest Pass",
  "doble salto a la cuerda": "Rope Jumping",

  // ------------------------------------------------------------- calistenia
  "flexiones de brazos": "Pushups",
  "flexiones diamante": "Pushups (Close and Wide Hand Positions)",
  "flexiones declinadas": "Decline Push-Up",
  "flexiones con palmas": "Pushups",
  "dominadas pronas": "Chin-Up",
  "fondos en paralelas": "Parallel Bar Dip",
  "fondos en banco": "Bench Dips",
  "dips con lastre": "Weighted Bench Dip",
  "muscle up en barra": "Kipping Muscle Up",
  "pistol squat": "Kettlebell Pistol Squat",
  "sentadilla pistola": "Kettlebell Pistol Squat",
  "plancha l sit": "Hanging Pike",
  "muscle up en anillas": "Muscle Up",

  // -------------------------------------------------------------- funcional
  "mountain climbers": "Mountain Climbers",
  "kettlebell goblet squat": "Goblet Squat",
  "goblet squat": "Goblet Squat",
  "kettlebell clean and press": "Clean and Press",
  "medicine ball slam": "One-Arm Medicine Ball Slam",
  "farmer walk": "Farmer's Walk",
  "caminata del granjero": "Farmer's Walk",
  "lunge walk": "Barbell Walking Lunge",
  "split jump": "Split Jump",
  "empuje de trineo": "Sled Push",
  "sentadilla con salto": "Weighted Jump Squat",
};


const norm = (s) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const readSeeds = async () => {
  const byName = new Map();
  for (const file of SEEDS) {
    const sql = await readFile(file, "utf8");
    const at = file.includes("00018") ? sql.indexOf("values") : sql.indexOf("insert into public.exercises");
    const values = [...sql.slice(at).matchAll(/'((?:[^']|'')*)'/g)].map((m) => m[1].replace(/''/g, "'"));
    const stride = file.includes("00018") ? 2 : 3;
    values
      .filter((_, i) => i % stride === 0)
      .forEach((name, i) => {
        const k = norm(name);
        if (!byName.has(k)) byName.set(k, { name, discipline: values[i * stride + 1], muscle: values[i * stride + 2] ?? "?" });
      });
  }
  return byName;
};

const loadDataset = async () => {
  const cache = path.join(os.tmpdir(), "free-exercise-db-exercises.json");
  try {
    await access(cache);
    return JSON.parse(await readFile(cache, "utf8"));
  } catch {
    const res = await fetch(DATASET_URL);
    if (!res.ok) throw new Error(`No se pudo bajar el dataset: HTTP ${res.status}`);
    const text = await res.text();
    await mkdir(os.tmpdir(), { recursive: true });
    await writeFile(cache, text);
    return JSON.parse(text);
  }
};

const fail = (msg) => {
  console.error(`\n  ERROR: ${msg}\n`);
  process.exit(1);
};

const main = async () => {
  const checkOnly = process.argv.includes("--check");
  const [catalog, dataset] = await Promise.all([readSeeds(), loadDataset()]);

  const byEnName = new Map();
  for (const e of dataset) if (!byEnName.has(e.name)) byEnName.set(e.name, e);

  console.log(`Catalogo: ${catalog.size} ejercicios | dataset: ${dataset.length}`);

  // --- validar el mapeo contra el dataset ---------------------------------
  const rows = [];
  const usedIds = new Map();
  for (const [key, enName] of Object.entries(MAP)) {
    const en = byEnName.get(enName);
    if (!en) {
      fail(`el mapeo "${key}" apunta a "${enName}", que NO existe en el dataset`);
    }
    if (!usedIds.has(en.id)) usedIds.set(en.id, []);
    usedIds.get(en.id).push(key);
    rows.push({ key, es: catalog.get(key)?.name ?? key, en: enName, id: en.id, img: en.images[0], muscle: en.primaryMuscles.join("/"), catMuscle: catalog.get(key)?.muscle ?? "?" });
  }

  // claves del mapa que no existen en el catalogo => typo mio
  for (const key of Object.keys(MAP)) {
    if (!catalog.has(key)) fail(`clave del mapa "${key}" no existe en los seeds del catalogo`);
  }

  const targets = [...catalog.values()].filter((r) => DISCIPLINES.includes(r.discipline));
  const mapped = new Set(Object.keys(MAP));
  const missing = targets.filter((r) => !mapped.has(norm(r.name)));

  console.log(`\n  Disciplinas de fuerza: ${targets.length}`);
  console.log(`  Con foto:               ${rows.length}  (${Math.round((rows.length / targets.length) * 100)}%)`);
  console.log(`  Sin foto:               ${missing.length}`);

  const byDisc = {};
  for (const r of rows) {
    const d = catalog.get(r.key)?.discipline ?? "?";
    byDisc[d] = (byDisc[d] ?? 0) + 1;
  }
  for (const d of DISCIPLINES) {
    const total = targets.filter((r) => r.discipline === d).length;
    console.log(`    - ${d.padEnd(12)} ${String(byDisc[d] ?? 0).padStart(3)}/${total}`);
  }

  if (missing.length) {
    console.log(`\n  Sin foto (${missing.length}) - el dataset no tiene ese movimiento:`);
    for (const m of missing) console.log(`    ${m.name}  [${m.discipline}]`);
  }

  const shared = [...usedIds.entries()].filter(([, keys]) => keys.length > 1);
  if (shared.length) {
    console.log(`\n  Comparten imagen (mismo movimiento, distinto nombre):`);
    for (const [id, keys] of shared) console.log(`    ${id} <- ${keys.join(" | ")}`);
  }

  // --- test del LOOKUP REAL (la leccion del primer piloto) -----------------
  const IMAGES_BLOCK = /(?:export )?const IMAGES: Record<string, string> = \{[\s\S]*?\n\};/;
  const lookupSource = await readFile(OUT_MAP, "utf8").catch(() => null);
  if (lookupSource === null) {
    // Sin el consumidor no se puede validar nada: hay que generarlo primero.
    if (checkOnly) fail(`${OUT_MAP} no existe. Generalo con: npm run build:images`);
    await writeFile(OUT_MAP, await renderModule(rows), "utf8");
    console.log(`  Mapa escrito en ${OUT_MAP}`);
  } else {
    const mapLiteral = await renderMap(rows, checkOnly);
    const consumer = lookupSource.replace(IMAGES_BLOCK, mapLiteral.trim());
    if (consumer === lookupSource && checkOnly) {
      console.log("  (mapa sin cambios, no se regenera el consumidor)");
    } else {
      // Importamos el consumidor REAL (el de disco, con su normalize y su
      // exerciseImage) con el bloque IMAGES ya actualizado.
      await writeFile(path.join(os.tmpdir(), "lookup-selfcheck.mts"), consumer, "utf8");
      const { exerciseImage } = await import("file:///" + path.join(os.tmpdir(), "lookup-selfcheck.mts").replace(/\\/g, "/"));
      const broken = rows.filter((r) => exerciseImage(r.es) === null);
      if (broken.length) {
        fail(`${broken.length} claves NO resuelven con el consumidor real:\n` + broken.map((b) => `      ${b.es} (${b.key})`).join("\n"));
      }
      console.log(`  Lookup real: OK (${rows.length}/${rows.length} claves resuelven)`);
    }
  }

  if (process.argv.includes("--report")) {
    console.log("\n=== MAPEO (revisar que la foto sea el movimiento correcto) ===\n");
    for (const r of rows) {
      const en = byEnName.get(r.en);
      const first = (en.instructions?.[0] ?? "").replace(/\s+/g, " ").trim();
      console.log(`${r.es}  [${catalog.get(r.key)?.discipline ?? "?"}]`);
      console.log(`   -> ${r.en}   (${r.id})`);
      console.log(`   musculos: ${r.muscle} | catalogo dice: ${r.catMuscle} | equipo: ${en.equipment ?? "-"}`);
      console.log(`   ${first}`);
    }
    console.log();
  }

  if (checkOnly) {
    console.log("\nSin cambios (--check).\n");
    return;
  }

  // --- descargar y redimensionar ------------------------------------------
  await mkdir(OUT_DIR, { recursive: true });
  let saved = 0;
  let reused = 0;
  for (const r of rows) {
    const dest = path.join(OUT_DIR, `${r.id}.webp`);
    try {
      await access(dest);
      reused++;
      continue;
    } catch {}
    const url = `${IMAGE_BASE}${r.img}`;
    const res = await fetch(url);
    if (!res.ok) fail(`HTTP ${res.status} bajando ${url}`);
    await pipeline(
      Readable.fromWeb(res.body),
      sharp().resize(THUMB_SIZE, THUMB_SIZE, { fit: "cover", position: "attention" }).webp({ quality: 82 }),
      createWriteStream(dest)
    );
    saved++;
  }
  console.log(`\n  Miniaturas: ${saved} generadas, ${reused} ya estaban (${THUMB_SIZE}px webp en ${OUT_DIR}/)`);

  await writeFile(OUT_MAP, await renderModule(rows), "utf8");
  console.log(`  Mapa escrito en ${OUT_MAP}`);
  console.log("\nListo.\n");
};

const renderMap = async (rows) =>
  `export const IMAGES: Record<string, string> = {\n${rows
    .map((r) => `  "${r.key}": "/exercises/${r.id}.webp",`)
    .join("\n")}\n};\n`;

const renderModule = async (rows) => `// GENERADO POR scripts/build-exercise-images.mjs - no editar a mano.
// Correr \`npm run build:images\` para regenerar.
// Un ejercicio solo aparece aca si el dataset tiene ese movimiento EXACTO.

const IMAGES: Record<string, string> = {
${rows.map((r) => `  "${r.key}": "/exercises/${r.id}.webp",`).join("\n")}
};

const SHOW_EXERCISE_IMAGES = true;

const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\\u0300-\\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Ruta de la miniatura del ejercicio, o null si todavia no tiene. */
export const exerciseImage = (name: string | null | undefined): string | null => {
  if (!SHOW_EXERCISE_IMAGES || !name) return null;
  return IMAGES[normalize(name)] ?? null;
};
`;

main();
