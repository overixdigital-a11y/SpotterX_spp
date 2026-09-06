"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuthState } from "@/lib/auth-context";

const categories = [
  "#CrossFit",
  "#Running",
  "#Powerlifting",
  "#Calistenia",
  "#Yoga",
  "#Boxeo",
  "#Nutrición",
  "#Cardio",
];

export default function CrearPage() {
  const router = useRouter();
  const { userId } = useAuthState();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [category, setCategory] = useState("#CrossFit");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    if (preview) URL.revokeObjectURL(preview);
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : null);
  };

  const onSubmit = async () => {
    if (!userId) return;
    if (!file && !caption.trim()) {
      setError("Agregá un archivo o un texto");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      let media_url: string | null = null;
      let media_type: "video" | "image" | null = null;

      if (file) {
        media_type = file.type.startsWith("video") ? "video" : "image";
        const ext = file.name.split(".").pop();
        const path = `${userId}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("media")
          .upload(path, file, { upsert: false });
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from("media").getPublicUrl(path);
        media_url = pub.publicUrl;
      }

      const { error: insErr } = await supabase.from("posts").insert({
        user_id: userId,
        caption: caption.trim() || null,
        category,
        media_url,
        media_type,
      });
      if (insErr) throw insErr;

      router.push("/home");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al publicar");
    } finally {
      setLoading(false);
    }
  };

  const isVideo = file?.type.startsWith("video");

  return (
    <main className="mx-auto max-w-md px-4 pt-4">
      <label className="block cursor-pointer rounded-2xl border border-dashed border-edge bg-card p-4 text-center">
        <input type="file" accept="video/*,image/*" className="hidden" onChange={onFile} />
        {preview ? (
          isVideo ? (
            <video
              src={preview}
              controls
              muted
              playsInline
              className="mx-auto max-h-72 w-full rounded-xl bg-bg object-contain"
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview}
              alt="Vista previa"
              className="mx-auto max-h-72 w-full rounded-xl bg-bg object-contain"
            />
          )
        ) : (
          <div className="py-6">
            <Camera className="mx-auto h-12 w-12 text-neon" />
            <p className="mt-3 text-sm text-muted">
              Subí un video o foto para compartir tu progreso
            </p>
            <span className="mt-2 inline-block text-xs text-muted/60">
              Tocar para seleccionar
            </span>
          </div>
        )}
      </label>

      <p className="sr-only">Vista previa del archivo seleccionado.</p>

      <textarea
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
        placeholder="Contá algo… (mencioná con @usuario)"
        rows={3}
        className="mt-4 w-full rounded-xl border border-edge bg-card px-3.5 py-2.5 text-sm text-ink placeholder:text-muted focus:border-neon focus:outline-none"
      />

      <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-muted">
        Categoría
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {categories.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCategory(c)}
            className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
              category === c
                ? "border-neon text-neon shadow-neon"
                : "border-edge bg-card text-muted"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {error && <p className="mt-3 text-sm text-ember">{error}</p>}

      <button
        onClick={onSubmit}
        disabled={loading}
        className="mt-6 mb-8 flex w-full items-center justify-center gap-2 rounded-xl bg-neon px-4 py-3 font-semibold text-bg shadow-neon transition active:scale-[0.98] disabled:opacity-60"
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {loading ? "Publicando…" : "Publicar"}
      </button>
    </main>
  );
}