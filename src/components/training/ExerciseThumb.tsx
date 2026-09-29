import { exerciseImage } from "@/lib/exercise-images";

/**
 * Miniatura de un ejercicio del catalogo.
 *
 * Devuelve `null` si el ejercicio no tiene imagen en el mapa: la fila que lo
 * contiene se renderiza EXACTAMENTE igual que antes de este feature (mismo alto,
 * mismo `truncate`). Eso es lo que permite apagar el piloto entero vaciando
 * `src/lib/exercise-images.ts` sin tocar los call sites.
 *
 * `alt` vacio a proposito: es decorativo, el nombre del ejercicio ya esta en
 * texto al lado, y un `alt` con el nombre haria que el lector de pantalla lo
 * leyera dos veces.
 */
export default function ExerciseThumb({
  name,
  size = 36,
  className = "",
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  const src = exerciseImage(name);
  if (!src) return null;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      className={`shrink-0 rounded-md object-cover ring-1 ring-edge ${className}`}
    />
  );
}
