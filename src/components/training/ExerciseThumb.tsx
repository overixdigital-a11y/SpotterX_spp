import { exerciseImage } from "@/lib/exercise-images";

type Props = {
  name: string | null | undefined;
  size?: number;
  className?: string;
};

/**
 * Miniatura cuadrada de un ejercicio. Devuelve null si el ejercicio no tiene
 * una foto exacta en el catalogo, para que la lista quede igual que siempre.
 */
export default function ExerciseThumb({ name, size = 40, className = "" }: Props) {
  const src = exerciseImage(name);
  if (!src) return null;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={name ?? ""}
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      className={`shrink-0 rounded-md object-cover ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
