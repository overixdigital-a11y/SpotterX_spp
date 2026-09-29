"use client";

import { useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { BottomSheet } from "@/components/core/BottomSheet";
import type { ExerciseMedia } from "@/lib/exercise-media-map";

type Props = {
  open: boolean;
  onClose: () => void;
  name: string;
  media: ExerciseMedia;
};

/**
 * Visor de material de un ejercicio: la galeria de fotos y el video demo.
 *
 * Se abre tocando la miniatura de una rutina. El video se reproduce SOLO
 * adentro del visor: la lista de rutinas nunca lo descarga (por eso el mapa
 * guarda URLs y no bytes).
 *
 * `muted` + `autoPlay` es obligatorio: iOS/Safari bloquea el autoplay si el
 * video tiene sonido. El usuario lo puede sacar el mute con los controles.
 */
export default function ExerciseMediaSheet({ open, onClose, name, media }: Props) {
  const [index, setIndex] = useState(0);
  const [failed, setFailed] = useState<string | null>(null);

  const total = media.fotos.length;
  const foto = total > 0 ? media.fotos[Math.min(index, total - 1)] : null;
  const showFoto = Boolean(foto) && foto !== failed;

  // Reset al CERRAR (no durante el render: el React compiler lo marca como
  // impureza), asi al reabrir arranca siempre en la primera foto.
  const close = () => {
    setIndex(0);
    setFailed(null);
    onClose();
  };

  return (
    <BottomSheet open={open} onClose={close} title={name}>
      {showFoto && foto ? (
        <div className="mb-4">
          <div className="relative overflow-hidden rounded-xl border border-edge bg-bg">
            <Image
              src={foto}
              alt={name}
              width={560}
              height={560}
              className="h-auto w-full object-contain"
              onError={() => setFailed(foto)}
            />
            {total > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => setIndex((i) => Math.max(0, i - 1))}
                  disabled={index === 0}
                  aria-label="Foto anterior"
                  className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-2 text-white transition disabled:opacity-25"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={() => setIndex((i) => Math.min(total - 1, i + 1))}
                  disabled={index >= total - 1}
                  aria-label="Foto siguiente"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-2 text-white transition disabled:opacity-25"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
                <span className="absolute bottom-2 right-2 rounded-full bg-black/70 px-2 py-0.5 text-xs font-semibold text-white">
                  {index + 1} / {total}
                </span>
              </>
            )}
          </div>

          {total > 1 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {media.fotos.map((u, i) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => setIndex(i)}
                  aria-label={`Foto ${i + 1}`}
                  className={`h-12 w-12 overflow-hidden rounded-md border-2 transition ${
                    i === index ? "border-accent" : "border-transparent opacity-60"
                  }`}
                >
                  <Image
                    src={u}
                    alt=""
                    width={48}
                    height={48}
                    className="h-full w-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {media.video ? (
        <div>
          {total > 0 && (
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
              Video demo
            </p>
          )}
          <video
            src={media.video}
            controls
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            className="w-full rounded-xl border border-edge bg-black"
          />
        </div>
      ) : null}
    </BottomSheet>
  );
}
