// AUTO-GENERADO por scripts/build-exercise-images.mjs. No editar a mano.
//
// Imagenes de `yuhonas/free-exercise-db` (Unlicense), hotlinkeadas a GitHub.
// Para regenerar o cambiar la muestra: node scripts/build-exercise-images.mjs
//
// Solo cubre 26 de los ~156 ejercicios del catalogo, y a proposito:
// los que no estan en este mapa NO muestran imagen y la fila se renderiza
// exactamente como antes (sin thumbnail). Ver `exerciseImage()`.

/** Interruptor de una linea para apagar todas las imagenes sin borrar codigo. */
export const SHOW_EXERCISE_IMAGES = true;

const IMAGES: Record<string, string> = {
  "Press de banca":
    "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Barbell_Bench_Press_-_Medium_Grip/0.jpg",
  "Press inclinado con mancuernas":
    "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Incline_Dumbbell_Press/0.jpg",
  "Press de hombros":
    "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Barbell_Shoulder_Press/0.jpg",
  "Sentadilla":
    "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Barbell_Squat/0.jpg",
  "Sentadilla búlgara":
    "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Barbell_Side_Split_Squat/0.jpg",
  "Peso muerto":
    "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Barbell_Deadlift/0.jpg",
  "Remo con barra":
    "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Bent_Over_Barbell_Row/0.jpg",
  "Remo con mancuerna":
    "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/One-Arm_Dumbbell_Row/0.jpg",
  "Dominadas":
    "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Pullups/0.jpg",
  "Curl de bíceps con barra":
    "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Barbell_Curl/0.jpg",
  "Extensiones de tríceps en polea":
    "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Triceps_Pushdown/0.jpg",
  "Hip thrust":
    "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Barbell_Hip_Thrust/0.jpg",
  "Crunch abdominal":
    "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Crunches/0.jpg",
  "Plancha abdominal":
    "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Plank/0.jpg",
  "Fondos en paralelas":
    "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Parallel_Bar_Dip/0.jpg",
  "Zancadas":
    "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Barbell_Walking_Lunge/0.jpg",
  "Peso muerto rumano":
    "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Romanian_Deadlift/0.jpg",
  "Press francés":
    "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/EZ-Bar_Skullcrusher/0.jpg",
  "Sentadilla pistola":
    "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Kettlebell_Pistol_Squat/0.jpg",
  "Dominadas lastradas":
    "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Weighted_Pull_Ups/0.jpg",
  "Kettlebell clean and press":
    "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Clean_and_Press/0.jpg",
  "Handstand push-up":
    "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Handstand_Push-Ups/0.jpg",
  "Flexión de pino":
    "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Handstand_Push-Ups/0.jpg",
  "Mountain climbers":
    "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Mountain_Climbers/0.jpg",
  "Caminata del granjero":
    "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Farmers_Walk/0.jpg",
  "Salto al cajón":
    "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Front_Box_Jump/0.jpg",
};

/**
 * Devuelve la URL de la imagen de un ejercicio por su nombre, o `null`.
 * El catalogo tiene `unique(lower(name))`, asi que la busqueda va en minusculas.
 */
export function exerciseImage(name: string | null | undefined): string | null {
  if (!SHOW_EXERCISE_IMAGES || !name) return null;
  return IMAGES[name.toLowerCase().trim()] ?? null;
}
