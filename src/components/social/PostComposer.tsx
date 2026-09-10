"use client";

import { useEffect, useState } from "react";
import { Loader2, Send, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuthState } from "@/lib/auth-context";
import MediaPicker from "@/components/core/MediaPicker";

export const POST_CATEGORIES = [
  "#CrossFit",
  "#Running",
  "#Powerlifting",
  "#Calistenia",
  "#Yoga",
  "#Boxeo",
  "#Nutrición",
  "#Cardio",
];

interface PostComposerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  defaultCaption: string;
  category: string;
  onPosted?: (id: string) => void;
}

export default function PostComposer({
  open,
  onClose,
  title,
  defaultCaption,
  category,
  onPosted,
}: PostComposerProps) {
  const { userId } = useAuthState();
  const [caption, setCaption] = useState(defaultCaption);
  const [chosenCategory, setChosenCategory] = useState(category);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  if (!open) return null;

  const clearFile = () => {
    if (preview) URL.revokeObjectURL(preview);
    setFile(null);
    setPreview(null);
  };

  const publish = async () => {
    if (!userId || posting) return;
    if (!caption.trim() && !file) {
      setError("Agregá un archivo o un texto");
      return;
    }
    setPosting(true);
    setError(null);
    try {
      const supabase = createClient();
      let media_url: string | null = null;
      let media_type: "video" | "image" | null = null;

      if (file) {
        media_type = file.type.startsWith("video") ? "video" : "image";
        const ext = file.name.split(".").pop() || "jpg";
        const path = `${userId}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("media")
          .upload(path, file, { upsert: false });
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from("media").getPublicUrl(path);
        media_url = pub.publicUrl;
      }

      const { data, error: insErr } = await supabase
        .from("posts")
        .insert({
          user_id: userId,
          caption: caption.trim(),
          category: chosenCategory,
          media_url,
          media_type,
        })
        .select("id")
        .single();
      if (insErr) throw insErr;
      onPosted?.(data.id);
      setPosting(false);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al publicar");
      setPosting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-t-2xl border border-edge bg-card p-4 pb-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-ink">{title}</p>
          <button onClick={onClose} className="text-muted" aria-label="Cerrar">
            ✕
          </button>
        </div>

        {preview ? (
          <div className="relative mt-3">
            {file?.type.startsWith("video") ? (
              <video
                src={preview}
                controls
                muted
                playsInline
                className="max-h-64 w-full rounded-xl bg-bg object-contain"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={preview}
                alt="Vista previa"
                className="max-h-64 w-full rounded-xl bg-bg object-cover"
              />
            )}
            <button
              onClick={clearFile}
              className="absolute right-2 top-2 rounded-full bg-bg/80 p-1.5 text-ember"
              aria-label="Quitar archivo"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="mt-3 flex justify-center">
            <MediaPicker
              mode="row"
              onPick={(f) => {
                if (preview) URL.revokeObjectURL(preview);
                setFile(f);
                setPreview(URL.createObjectURL(f));
              }}
            />
          </div>
        )}

        <textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          rows={3}
          className="mt-3 w-full rounded-xl border border-edge bg-bg px-3.5 py-2.5 text-sm text-ink placeholder:text-muted focus:border-neon focus:outline-none"
        />

        <div className="mt-2 flex flex-wrap gap-2">
          {POST_CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setChosenCategory(c)}
              className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                chosenCategory === c
                  ? "border-neon text-neon shadow-neon"
                  : "border-edge bg-bg text-muted"
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        {error && <p className="mt-3 text-sm text-ember">{error}</p>}

        <button
          onClick={publish}
          disabled={posting}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-neon px-4 py-3 font-semibold text-bg shadow-neon transition active:scale-[0.98] disabled:opacity-60"
        >
          {posting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {posting ? "Publicando…" : "Publicar"}
        </button>
      </div>
    </div>
  );
}