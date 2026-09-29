"use client";

import { useState } from "react";
import Image from "next/image";
import { Play } from "lucide-react";
import { exerciseImage, normalizeExerciseName } from "@/lib/exercise-images";
import { exerciseMediaMap } from "@/lib/exercise-media-map";
import ExerciseMediaSheet from "@/components/training/ExerciseMediaSheet";

type Props = {
  name: string | null | undefined;
  size?: number;
  className?: string;
  /**
   * Con `interactive` la miniatura abre el visor de fotos/video al tocarla.
   * Se usa en las listas de rutinas. En el ExercisePicker NO se usa, porque
   * ahi el click de la fila ya hace otra cosa (elegir el ejercicio).
   */
  interactive?: boolean;
};

/**
 * Miniatura cuadrada de un ejercicio. Devuelve null si el ejercicio no tiene
 * ninguna imagen, para que la lista quede igual que siempre.
 *
 * Prioridad de la portada:
 *   1. foto propia subida por el admin (Supabase Storage)
 *   2. si hay video pero no fotos, el primer frame del video (`preload=metadata`)
 *   3. miniatura estatica de `public/exercises/`
 *
 * Como el nombre es TEXTO en las rutinas, el match es por nombre normalizado en
 * los dos mapas.
 *
 * Las fotos propias van por el optimizador de `next/image` (por eso hay que
 * permitir el host de Storage en `next.config.ts`): un archivo de 3 MB del
 * celu mostrado a 36 px se convierte en un par de KB. Las estaticas ya pesan
 * 2 KB y van directas con `<img>`.
 *
 * El VIDEO nunca se reproduce en la lista: el tag `<video>` de la portada se
 * monta solo cuando no hay foto, con `preload="metadata"` (unos KB, no el
 * archivo entero) y sin `autoPlay`.
 *
 * Si una imagen falla (archivo borrado de Storage) se oculta en vez de dejar
 * el icono de imagen rota. Se guarda la URL que fallo, no un booleano, para que
 * al cambiar de ejercicio el thumbnail vuelva a intentar.
 */
export default function ExerciseThumb({
  name,
  size = 40,
  className = "",
  interactive = false,
}: Props) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const key = name ? normalizeExerciseName(name) : "";
  const media = key ? exerciseMediaMap()[key] : undefined;
  const fotos = media?.fotos ?? [];
  const video = media?.video ?? null;

  const propia = fotos[0] ?? null;
  const statica = propia ? null : exerciseImage(name);

  // Sin foto propia: si hay video se muestra el primer frame, si no, la estatica.
  const src = propia ?? statica;
  if ((!src || src === failedSrc) && !(video && !propia)) return null;

  const box = `shrink-0 rounded-md object-cover ${className}`;
  const style = { width: size, height: size };
  const onError = () => {
    if (src) setFailedSrc(src);
  };

  const thumb = !src || src === failedSrc ? (
    // Video sin foto propia: primer frame. No se reproduce ni descarga entero.
    <video
      src={video ?? undefined}
      muted
      playsInline
      preload="metadata"
      aria-hidden
      className={box}
      style={style}
    />
  ) : src.startsWith("http") ? (
    <Image
      src={src}
      alt={name ?? ""}
      width={size}
      height={size}
      className={box}
      style={style}
      onError={onError}
    />
  ) : (
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

  const badges = (fotos.length > 1 || video) && (
    <>
      {fotos.length > 1 && (
        <span
          className="absolute bottom-0 right-0 rounded-tl-md bg-black/70 px-1 text-[9px] font-bold leading-3 text-white"
          aria-hidden
        >
          {fotos.length}
        </span>
      )}
      {video && (
        <span
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-black/60 p-0.5 text-white"
          aria-hidden
        >
          <Play className="h-3 w-3 fill-white" />
        </span>
      )}
    </>
  );

  if (!interactive || !media) {
    return (
      <span className="relative inline-block shrink-0">
        {thumb}
        {badges}
      </span>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Ver fotos y video de ${name ?? "este ejercicio"}`}
        className="relative inline-block shrink-0 rounded-md transition active:scale-95"
      >
        {thumb}
        {badges}
      </button>
      <ExerciseMediaSheet
        open={open}
        onClose={() => setOpen(false)}
        name={name ?? "Ejercicio"}
        media={media}
      />
    </>
  );
}
