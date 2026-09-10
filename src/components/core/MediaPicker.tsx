"use client";

import { useRef, useState } from "react";
import { Camera, Video, Images } from "lucide-react";

interface MediaPickerProps {
  mode: "row" | "popover";
  onPick: (file: File) => void;
}

export default function MediaPicker({ mode, onPick }: MediaPickerProps) {
  const photoRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLInputElement | null>(null);
  const galleryRef = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(false);

  const handle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    if (f) onPick(f);
    e.target.value = "";
    setOpen(false);
  };

  if (mode === "row") {
    return (
      <div className="flex items-center gap-2">
        <input ref={photoRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handle} />
        <input ref={videoRef} type="file" accept="video/*" capture="environment" className="hidden" onChange={handle} />
        <input ref={galleryRef} type="file" accept="image/*,video/*" className="hidden" onChange={handle} />
        <button
          onClick={() => photoRef.current?.click()}
          className="flex flex-col items-center gap-0.5 rounded-xl border border-edge bg-bg px-3 py-2 text-[11px] font-semibold text-neon transition active:scale-95"
        >
          <Camera className="h-5 w-5" /> Foto
        </button>
        <button
          onClick={() => videoRef.current?.click()}
          className="flex flex-col items-center gap-0.5 rounded-xl border border-edge bg-bg px-3 py-2 text-[11px] font-semibold text-neon transition active:scale-95"
        >
          <Video className="h-5 w-5" /> Reel
        </button>
        <button
          onClick={() => galleryRef.current?.click()}
          className="flex flex-col items-center gap-0.5 rounded-xl border border-edge bg-bg px-3 py-2 text-[11px] font-semibold text-neon transition active:scale-95"
        >
          <Images className="h-5 w-5" /> Galería
        </button>
      </div>
    );
  }

  return (
    <>
      <input ref={photoRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handle} />
      <input ref={videoRef} type="file" accept="video/*" capture="environment" className="hidden" onChange={handle} />
      <input ref={galleryRef} type="file" accept="image/*,video/*" className="hidden" onChange={handle} />

      <button
        onClick={() => setOpen(true)}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-edge bg-card text-neon transition active:scale-95"
        aria-label="Adjuntar foto o video"
      >
        <Images className="h-5 w-5" />
      </button>

      {open && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60" onClick={() => setOpen(false)}>
          <div
            className="mx-4 w-full max-w-sm rounded-2xl border border-edge bg-card p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="mb-3 text-sm font-semibold text-ink">Adjuntar</p>
            <div className="space-y-2">
              <button
                onClick={() => photoRef.current?.click()}
                className="flex w-full items-center gap-3 rounded-xl border border-edge bg-bg px-4 py-3 text-sm font-semibold text-ink transition active:scale-[0.98]"
              >
                <Camera className="h-5 w-5 text-neon" /> Sacar foto
              </button>
              <button
                onClick={() => videoRef.current?.click()}
                className="flex w-full items-center gap-3 rounded-xl border border-edge bg-bg px-4 py-3 text-sm font-semibold text-ink transition active:scale-[0.98]"
              >
                <Video className="h-5 w-5 text-neon" /> Grabar video
              </button>
              <button
                onClick={() => galleryRef.current?.click()}
                className="flex w-full items-center gap-3 rounded-xl border border-edge bg-bg px-4 py-3 text-sm font-semibold text-ink transition active:scale-[0.98]"
              >
                <Images className="h-5 w-5 text-neon" /> Elegir de la galería
              </button>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="mt-3 w-full rounded-xl border border-edge bg-card py-2.5 text-sm font-semibold text-muted"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </>
  );
}