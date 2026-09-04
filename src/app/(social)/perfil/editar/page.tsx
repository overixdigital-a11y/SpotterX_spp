"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Camera, Save } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuthState } from "@/lib/auth-context";

export default function EditarPerfilPage() {
  const { profile, userId } = useAuthState();
  const router = useRouter();
  const [fullName, setFullName] = useState(profile?.full_name ?? "");
  const [bio, setBio] = useState(profile?.bio ?? "");
  const [location, setLocation] = useState(profile?.location ?? "");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(
    profile?.avatar_url ?? null
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initial = (profile?.full_name || profile?.username || "U")
    .slice(0, 2)
    .toUpperCase();

  const onPickAvatar = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const onSave = async () => {
    if (!userId) return;
    setSaving(true);
    setError(null);
    const supabase = createClient();
    try {
      let avatar_url: string | null = profile?.avatar_url ?? null;
      if (avatarFile) {
        const ext = avatarFile.name.split(".").pop() ?? "jpg";
        const path = `avatars/${userId}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("media")
          .upload(path, avatarFile, { upsert: true });
        if (upErr) throw new Error(`No se pudo subir la foto: ${upErr.message}`);
        const { data: pub } = supabase.storage.from("media").getPublicUrl(path);
        avatar_url = pub.publicUrl;
      }
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: fullName.trim() || null,
          bio: bio.trim() || null,
          location: location.trim() || null,
          avatar_url,
        })
        .eq("id", userId);
      if (error) throw error;
      router.refresh();
      router.push("/perfil");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar el perfil");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="mx-auto max-w-md">
      <div className="flex items-center gap-3 px-4 pt-4">
        <Link href="/perfil" className="text-muted hover:text-ink">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-lg font-bold text-ink">Editar perfil</h1>
      </div>

      <div className="mt-6 flex flex-col items-center">
        <label className="relative cursor-pointer">
          {avatarPreview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarPreview}
              alt="Avatar"
              className="h-24 w-24 rounded-full border-2 border-neon object-cover shadow-neon"
            />
          ) : (
            <div className="flex h-24 w-24 items-center justify-center rounded-full border-2 border-neon bg-neon/20 text-2xl font-bold text-neon shadow-neon">
              {initial}
            </div>
          )}
          <span className="absolute -bottom-1 -right-1 rounded-full bg-neon p-1.5 text-bg">
            <Camera className="h-4 w-4" />
          </span>
          <input
            type="file"
            accept="image/*"
            onChange={onPickAvatar}
            className="hidden"
          />
        </label>
        <p className="mt-2 text-xs text-muted">Tocá la foto para cambiarla</p>
      </div>

      <div className="mt-6 space-y-4 px-4">
        <div>
          <label className="text-xs font-medium text-muted">Nombre</label>
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="mt-1 w-full rounded-xl border border-edge bg-card px-3.5 py-2.5 text-sm text-ink focus:border-neon focus:outline-none"
            placeholder="Tu nombre"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted">Ubicación</label>
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="mt-1 w-full rounded-xl border border-edge bg-card px-3.5 py-2.5 text-sm text-ink focus:border-neon focus:outline-none"
            placeholder="Ciudad o zona"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted">Bio</label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={3}
            className="mt-1 w-full resize-none rounded-xl border border-edge bg-card px-3.5 py-2.5 text-sm text-ink focus:border-neon focus:outline-none"
            placeholder="Contá algo sobre vos…"
          />
        </div>

        {error && <p className="text-sm text-ember">{error}</p>}

        <button
          onClick={onSave}
          disabled={saving}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-neon py-3 font-semibold text-bg shadow-neon transition active:scale-[0.98] disabled:opacity-60"
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Guardando…
            </>
          ) : (
            <>
              <Save className="h-4 w-4" /> Guardar cambios
            </>
          )}
        </button>
      </div>
    </main>
  );
}