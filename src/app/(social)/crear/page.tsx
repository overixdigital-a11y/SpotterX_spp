"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Film, Type, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuthState } from "@/lib/auth-context";

const categories = [
  "#CrossFit",
  "#Running",
  "#Powerlifting",
  "#Calistenia",
  "#Yoga",
  "#Boxeo",
];

export default function CrearPage() {
  const router = useRouter();
  const { userId } = useAuthState();
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const [category, setCategory] = useState("#CrossFit");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFile(e.target.files?.[0] ?? null);
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

      const { error: insErr } = await supabase
        .from("posts")
        .insert({
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
      <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-edge bg-card p-8 text-center">
        <input type="file" accept="video/*,image/*" className="hidden" onChange={onFile} />
        {file ? (
          <>
            <Camera className={`h-12 w-12 ${isVideo ? "text-ember" : "text-neon"}`} />
            <p className="mt-3 text-sm text-ink">
              {file.name} ({isVideo ? "video" : "foto"})
            </p>
          </>
        ) : (
          <>
            <Camera className="mx-auto h-12 w-12 text-neon" />
            <p className="mt-3 text-sm text-muted">
              Subí un video o foto para compartir tu progreso
            </p>
            <span className="mt-2 text-xs text-muted/60">
              Tocar para seleccionar
            </span>
          </>
        )}
      </label>

      <textarea
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
        placeholder="Contá algo…"
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
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-neon px-4 py-3 font-semibold text-bg shadow-neon transition active:scale-[0.98] disabled:opacity-60"
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {loading ? "Publicando…" : "Publicar"}
      </button>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <button className="flex items-center justify-center gap-2 rounded-xl border border-edge bg-card py-4 text-sm font-medium text-ink">
          <Film className="h-4 w-4 text-ember" /> Reels
        </button>
        <button className="flex items-center justify-center gap-2 rounded-xl border border-edge bg-card py-4 text-sm font-medium text-ink">
          <Type className="h-4 w-4 text-neon" /> Texto
        </button>
      </div>
    </main>
  );
}
