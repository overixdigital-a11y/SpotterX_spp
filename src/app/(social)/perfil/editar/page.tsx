"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Camera, Save, AlertTriangle, Plus, X, Award, DollarSign, Briefcase, Star } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuthState } from "@/lib/auth-context";
import { useToast } from "@/components/core/ToastProvider";
import { DISCIPLINES } from "@/lib/disciplines";

interface Certification {
  name: string;
  issuer: string;
  year: number | string;
}

const DAYS = ["lun", "mar", "mie", "jue", "vie", "sab", "dom"] as const;
const SPECIALTIES = [
  "fuerza", "cardio", "nutricion", "rehabilitacion", "funcional",
  "hipertrofia", "crossfit", "yoga", "movilidad", "deportes_especificos",
];

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

  // Professor fields
  const isProfe = profile?.role === "profesor";
  const [certifications, setCertifications] = useState<Certification[]>(
    (profile?.certifications as Certification[] | null) ?? []
  );
  const [hourlyRate, setHourlyRate] = useState<string>(
    profile?.hourly_rate != null ? String(profile.hourly_rate) : ""
  );
  const [specialties, setSpecialties] = useState<string[]>(
    (profile?.specialties as string[] | null) ?? []
  );
  const [yearsExperience, setYearsExperience] = useState<string>(
    profile?.years_experience != null ? String(profile.years_experience) : ""
  );
  const [availability, setAvailability] = useState<Record<string, string[]>>(
    (profile?.availability as Record<string, string[]> | null) ?? {}
  );
  const [newCert, setNewCert] = useState<Certification>({ name: "", issuer: "", year: "" });
  const [newSlot, setNewSlot] = useState<Record<string, string>>({});

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

      // Professor fields
      if (isProfe) {
        const profeData: Record<string, unknown> = { disciplines };
        profeData.certifications = certifications;
        profeData.hourly_rate = hourlyRate ? Number(hourlyRate) : null;
        profeData.specialties = specialties;
        profeData.years_experience = yearsExperience ? Number(yearsExperience) : null;
        profeData.availability = availability;
        const { error: err3 } = await supabase.from("profiles").update(profeData).eq("id", userId);
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

  // Certification helpers
  const addCertification = () => {
    if (!newCert.name.trim()) return;
    setCertifications((prev) => [...prev, { ...newCert, year: newCert.year ? Number(newCert.year) : "" }]);
    setNewCert({ name: "", issuer: "", year: "" });
  };
  const removeCertification = (idx: number) => {
    setCertifications((prev) => prev.filter((_, i) => i !== idx));
  };

  // Availability helpers
  const addSlot = (day: string) => {
    const time = newSlot[day]?.trim();
    if (!time) return;
    setAvailability((prev) => ({
      ...prev,
      [day]: [...(prev[day] ?? []), time],
    }));
    setNewSlot((prev) => ({ ...prev, [day]: "" }));
  };
  const removeSlot = (day: string, idx: number) => {
    setAvailability((prev) => ({
      ...prev,
      [day]: (prev[day] ?? []).filter((_, i) => i !== idx),
    }));
  };

  return (
    <main className="mx-auto max-w-full">
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

        {/* ─── Secciones exclusivas del profesor ─── */}
        {isProfe && (
          <>
            {/* Disciplinas */}
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

            {/* Tarifa por hora */}
            <div className="rounded-xl border border-edge bg-card p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-ink">
                <DollarSign className="h-4 w-4 text-neon" />
                Tarifa por hora
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted">$</span>
                <input
                  value={hourlyRate}
                  onChange={(e) => setHourlyRate(e.target.value.replace(/[^0-9.]/g, ""))}
                  type="number"
                  min="0"
                  className="flex-1 rounded-xl border border-edge bg-bg px-3.5 py-2.5 text-sm text-ink focus:border-neon focus:outline-none"
                  placeholder="0 = consultar"
                />
              </div>
            </div>

            {/* Certificaciones */}
            <div className="rounded-xl border border-edge bg-card p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-ink">
                <Award className="h-4 w-4 text-neon" />
                Certificaciones
              </div>
              {certifications.map((c, idx) => (
                <div key={idx} className="flex items-center gap-2 text-sm">
                  <span className="flex-1 truncate text-ink">{c.name}</span>
                  {c.issuer && <span className="text-muted">· {c.issuer}</span>}
                  {c.year && <span className="text-muted">({c.year})</span>}
                  <button onClick={() => removeCertification(idx)} className="text-muted hover:text-ember">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <div className="grid grid-cols-3 gap-2">
                <input
                  value={newCert.name}
                  onChange={(e) => setNewCert((p) => ({ ...p, name: e.target.value }))}
                  className="rounded-lg border border-edge bg-bg px-3 py-2 text-xs text-ink focus:border-neon focus:outline-none"
                  placeholder="Certificación"
                />
                <input
                  value={newCert.issuer}
                  onChange={(e) => setNewCert((p) => ({ ...p, issuer: e.target.value }))}
                  className="rounded-lg border border-edge bg-bg px-3 py-2 text-xs text-ink focus:border-neon focus:outline-none"
                  placeholder="Entidad"
                />
                <div className="flex items-center gap-1">
                  <input
                    value={newCert.year}
                    onChange={(e) => setNewCert((p) => ({ ...p, year: e.target.value }))}
                    type="number"
                    min="1900"
                    max="2099"
                    className="w-full rounded-lg border border-edge bg-bg px-3 py-2 text-xs text-ink focus:border-neon focus:outline-none"
                    placeholder="Año"
                  />
                  <button
                    onClick={addCertification}
                    className="rounded-lg bg-neon/10 p-2 text-neon hover:bg-neon/20"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Especialidades */}
            <div className="rounded-xl border border-edge bg-card p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-ink">
                <Briefcase className="h-4 w-4 text-neon" />
                Especialidades
              </div>
              <div className="flex flex-wrap gap-2">
                {SPECIALTIES.map((s) => {
                  const active = specialties.includes(s);
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() =>
                        setSpecialties((prev) =>
                          active ? prev.filter((x) => x !== s) : [...prev, s]
                        )
                      }
                      className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                        active
                          ? "border-neon bg-neon/15 text-neon"
                          : "border-edge bg-card text-muted hover:border-neon/40"
                      }`}
                    >
                      {s.replace(/_/g, " ")}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Años de experiencia */}
            <div className="rounded-xl border border-edge bg-card p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-ink">
                <Star className="h-4 w-4 text-neon" />
                Experiencia
              </div>
              <div className="flex items-center gap-2">
                <input
                  value={yearsExperience}
                  onChange={(e) => setYearsExperience(e.target.value.replace(/[^0-9]/g, ""))}
                  type="number"
                  min="0"
                  max="60"
                  className="w-24 rounded-xl border border-edge bg-bg px-3.5 py-2.5 text-sm text-ink focus:border-neon focus:outline-none"
                  placeholder="0"
                />
                <span className="text-sm text-muted">años</span>
              </div>
            </div>

            {/* Disponibilidad horaria */}
            <div className="rounded-xl border border-edge bg-card p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-ink">
                📅 Disponibilidad horaria
              </div>
              {DAYS.map((day) => (
                <div key={day} className="flex flex-col gap-1">
                  <p className="text-xs font-medium text-muted uppercase">{day}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(availability[day] ?? []).map((slot, idx) => (
                      <span
                        key={idx}
                        className="flex items-center gap-1 rounded-full border border-neon/30 bg-neon/10 px-2.5 py-0.5 text-[11px] text-neon"
                      >
                        {slot}
                        <button
                          onClick={() => removeSlot(day, idx)}
                          className="ml-0.5 hover:text-bg"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                    <div className="flex items-center gap-1">
                      <input
                        value={newSlot[day] ?? ""}
                        onChange={(e) => setNewSlot((p) => ({ ...p, [day]: e.target.value }))}
                        className="w-28 rounded-lg border border-edge bg-bg px-2 py-1 text-[11px] text-ink focus:border-neon focus:outline-none"
                        placeholder="09:00-12:00"
                      />
                      <button
                        onClick={() => addSlot(day)}
                        className="rounded-md bg-neon/10 p-1 text-neon hover:bg-neon/20"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
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