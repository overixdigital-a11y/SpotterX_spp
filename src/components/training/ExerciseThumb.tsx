"use client";

import { useState } from "react";
import Image from "next/image";
import { exerciseImage, normalizeExerciseName } from "@/lib/exercise-images";
import { exercisePhotoMap } from "@/lib/exercise-photo-map";

type Props = {
  name: string | null | undefined;
  size?: number;
  className?: string;
};

/**
 * Miniatura cuadrada de un ejercicio. Devuelve null si el ejercicio no tiene
 * una foto exacta, para que la lista quede igual que siempre.
 *
 * Prioridad: foto propia subida por el admin (Supabase Storage) > miniatura
 * estatica de `public/exercises/`. Como el nombre es TEXTO en las rutinas, el
 * match es por nombre normalizado en los dos mapas.
 *
 * Las fotos propias van por el optimizador de `next/image` (por eso hay que
 * permitir el host de Storage en `next.config.ts`): un archivo de 3 MB del
 * celu mostrado a 36 px se convierte en un par de KB. Las estaticas ya pesan
 * 2 KB y van directas con `<img>`.
 *
 * Si una imagen falla (archivo borrado de Storage) se oculta en vez de dejar
 * el icono de imagen rota. Se guarda la URL que fallo, no un booleano, para que
 * al cambiar de ejercicio el thumbnail vuelva a intentar.
 */
export default function ExerciseThumb({ name, size = 40, className = "" }: Props) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  const key = name ? normalizeExerciseName(name) : "";
  const own = key ? exercisePhotoMap()[key] : undefined;
  const src = own ?? exerciseImage(name);

  if (!src || src === failedSrc) return null;

  const isRemote = src.startsWith("http");
  const box = `shrink-0 rounded-md object-cover ${className}`;
  const style = { width: size, height: size };
  const onError = () => setFailedSrc(src);

  if (isRemote) {
    return (
      <Image
        src={src}
        alt={name ?? ""}
        width={size}
        height={size}
        className={box}
        style={style}
        onError={onError}
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={name ?? ""}
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      className={box}
      style={style}
      onError={onError}
    />
  );
}
