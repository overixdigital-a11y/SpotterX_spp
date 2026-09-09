"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Camera, Save, AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuthState } from "@/lib/auth-context";
import { useToast } from "@/components/core/ToastProvider";
import { DISCIPLINES } from "@/lib/disciplines";

export default function EditarPerfilPage() {
  const { profile, userId } = useAuthState();
  const router = useRouter();
  const toast = useToast();
  const [fullName, setFullName] = useState(profile?.full_name ?? "");
  const [username, setUsername] = useState(profile?.username ?? "");
  const [bio, setBio] = useState(profile?.bio ?? "");
  const [location, setLocation] = useState(profile?.location ?? "");
  const [website, setWebsite] = useState(profile?.website ?? "");
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [birthDate, setBirthDate] = useState(profile?.birth_date ?? "");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(
    profile?.avatar_url ?? null
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [disciplines, setDisciplines] = useState<string[]>(profile?.disciplines ?? []);
  const [customDiscipline, setCustomDiscipline] = useState("");

  const initial = (profile?.full_name || profile?.username || "U")
    .slice(0, 2)
    .toUpperCase();

  const onPickAvatar = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const onSave = async () => {
    if (!userId) return;
    if (!username.trim()) {
      setError("El usuario no puede estar vacío");
      return;
    }
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const normalizedUsername = username.trim().toLowerCase().replace(/[^a-z0-9_.]/g, "");
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

      if (normalizedUsername !== profile?.username) {
        const { data: taken } = await supabase
          .from("profiles")
          .select("id")
          .eq("username", normalizedUsername)
          .neq("id", userId)
          .maybeSingle();
        if (taken) {
          setError(`El usuario @${normalizedUsername} ya está en uso. Probá otro.`);
          setSaving(false);
          return;
        }
      }

      const base = {
        full_name: fullName.trim() || null,
        bio: bio.trim() || null,
        location: location.trim() || null,
        avatar_url,
      };
      const extended = {
        username: normalizedUsername,
        phone: phone.trim() || null,
        birth_date: birthDate || null,
        website: website.trim() || null,
      };

      const { error: err1 } = await supabase.from("profiles").update(base).eq("id", userId);
      if (err1) throw err1;

      const { error: err2 } = await supabase.from("profiles").update(extended).eq("id", userId);
      if (err2) {
        const msg = (err2 as { message?: string }).message ?? "";
        if (!/column|does not exist|could not find/i.test(msg)) throw err2;
        toast("Datos básicos guardados. Corré la migración 00010 para habilitar los campos extra.", "info");
      }

      if (profile?.role === "profesor") {
        const { error: err3 } = await supabase.from("profiles").update({ disciplines }).eq("id", userId);
        if (err3) {
          const msg = (err3 as { message?: string }).message ?? "";
          if (!/column|does not exist|could not find/i.test(msg)) throw err3;
        }
      }

      router.refresh();
      router.push("/perfil");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar el perfil");
      if (avatarPreview && avatarPreview.startsWith("blob:")) URL.revokeObjectURL(avatarPreview);
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
      </div>

      <div className="mt-6 space-y-4 px-4">
        {profile?.email && (
          <div>
            <label className="text-xs font-medium text-muted">Email</label>
            <p className="mt-1 w-full rounded-xl border border-edge bg-card px-3.5 py-2.5 text-sm text-muted">
              {profile.email}
            </p>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
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
            <label className="text-xs font-medium text-muted">Usuario</label>
            <div className="mt-1 flex items-center rounded-xl border border-edge bg-card">
              <span className="pl-3 text-sm text-muted">@</span>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-transparent px-2 py-2.5 text-sm text-ink focus:outline-none"
                placeholder="usuario"
              />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-muted">Teléfono</label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              type="tel"
              className="mt-1 w-full rounded-xl border border-edge bg-card px-3.5 py-2.5 text-sm text-ink focus:border-neon focus:outline-none"
              placeholder="+54 9 11 0000 0000"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted">Nacimiento</label>
            <input
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              type="date"
              className="mt-1 w-full rounded-xl border border-edge bg-card px-3 py-2.5 text-sm text-ink focus:border-neon focus:outline-none [color-scheme:dark]"
            />
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-muted">Website</label>
          <input
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            className="mt-1 w-full rounded-xl border border-edge bg-card px-3.5 py-2.5 text-sm text-ink focus:border-neon focus:outline-none"
            placeholder="https://tusitio.com"
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
            placeholder="Contá algo sobre vos… (mencioná con @usuario)"
          />
        </div>

        {profile?.role === "profesor" && (
          <div>
            <label className="text-xs font-medium text-muted">Mis disciplinas</label>
            <p className="mt-1 text-xs text-muted">Elegí las disciplinas que enseñás</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {DISCIPLINES.filter((d) => d.id !== "otras").map((d) => {
                const active = disciplines.includes(d.id);
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() =>
                      setDisciplines((prev) =>
                        active ? prev.filter((x) => x !== d.id) : [...prev, d.id]
                      )
                    }
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                      active
                        ? "border-neon bg-neon/15 text-neon"
                        : "border-edge bg-card text-muted hover:border-neon/40"
                    }`}
                  >
                    {d.label}
                  </button>
                );
              })}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <input
                value={customDiscipline}
                onChange={(e) => setCustomDiscipline(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && customDiscipline.trim()) {
                    e.preventDefault();
                    const val = customDiscipline.trim().toLowerCase().replace(/\s+/g, "_");
                    if (!disciplines.includes(val)) setDisciplines((prev) => [...prev, val]);
                    setCustomDiscipline("");
                  }
                }}
                className="flex-1 rounded-xl border border-edge bg-card px-3 py-2 text-xs text-ink focus:border-neon focus:outline-none"
                placeholder="Agregar disciplina personalizada..."
              />
              <button
                type="button"
                onClick={() => {
                  if (customDiscipline.trim()) {
                    const val = customDiscipline.trim().toLowerCase().replace(/\s+/g, "_");
                    if (!disciplines.includes(val)) setDisciplines((prev) => [...prev, val]);
                    setCustomDiscipline("");
                  }
                }}
                className="rounded-xl border border-edge bg-card px-3 py-2 text-xs text-muted hover:border-neon/40"
              >
                +
              </button>
            </div>
            {disciplines.filter((d) => !DISCIPLINES.some((cd) => cd.id === d)).length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {disciplines
                  .filter((d) => !DISCIPLINES.some((cd) => cd.id === d))
                  .map((d) => (
                    <span
                      key={d}
                      className="flex items-center gap-1 rounded-full border border-ember/40 bg-ember/10 px-2.5 py-0.5 text-[11px] text-ember"
                    >
                      {d.replace(/_/g, " ")}
                      <button
                        type="button"
                        onClick={() => setDisciplines((prev) => prev.filter((x) => x !== d))}
                        className="ml-0.5 hover:text-bg"
                      >
                        ×
                      </button>
                    </span>
                  ))}
              </div>
            )}
          </div>
        )}

        {error && (
          <p className="flex items-start gap-2 rounded-xl border border-ember/30 bg-ember/10 px-3 py-2.5 text-sm text-ember">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
          </p>
        )}

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