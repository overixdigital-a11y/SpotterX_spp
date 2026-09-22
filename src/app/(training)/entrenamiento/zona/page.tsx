"use client";

import { useEffect, useState } from "react";
import { Loader2, MapPin, Plus, X, Search, Building2, Navigation, Clock3, UserPlus, Pencil } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuthState } from "@/lib/auth-context";
import { geocodeAddress, formatAddress } from "@/lib/geo";
import { DISCIPLINES } from "@/lib/disciplines";
import { timeAgo } from "@/lib/format";

const DISCIPLINE_LABELS = DISCIPLINES.map((d) => d.label);

interface TrainerGym {
  id: string;
  gym_id: string | null;
  name: string | null;
  city: string | null;
  address: string | null;
  street: string | null;
  street_number: string | null;
  postal_code: string | null;
  province: string | null;
  availability: string | null;
  disciplines: string[] | null;
  description: string | null;
  notes: string | null;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
}

interface GymRow {
  id: string;
  name: string;
  city: string | null;
  address: string | null;
}

interface RequestRow {
  gym_id: string;
  status: string;
}

const STATUS_LABEL: Record<string, string> = {
  pending: "Pendiente",
  approved: "Aprobado",
  rejected: "Rechazado",
};

const STATUS_CLASS: Record<string, string> = {
  pending: "border-edge bg-bg text-muted",
  approved: "border-neon/40 bg-neon/10 text-neon",
  rejected: "border-ember/40 bg-ember/10 text-ember",
};

export default function ZonaPage() {
  const { userId } = useAuthState();
  const [zones, setZones] = useState<TrainerGym[]>([]);
  const [requests, setRequests] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [geoMsg, setGeoMsg] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    street: "",
    streetNumber: "",
    postalCode: "",
    province: "",
    city: "",
    availability: "",
    disciplines: [] as string[],
    description: "",
    notes: "",
    latitude: null as number | null,
    longitude: null as number | null,
  });

  const [q, setQ] = useState("");
  const [results, setResults] = useState<GymRow[]>([]);
  const [asking, setAsking] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    let active = true;
    const load = async () => {
      const { data: z } = await supabase
        .from("trainer_gyms")
        .select("*")
        .eq("trainer_id", userId)
        .order("created_at", { ascending: false });
      if (active && z) setZones(z as TrainerGym[]);
      const { data: r } = await supabase
        .from("trainer_gym_requests")
        .select("gym_id, status")
        .eq("trainer_id", userId);
      if (active && r) {
        const map: Record<string, string> = {};
        (r as RequestRow[]).forEach((x) => {
          map[x.gym_id] = x.status;
        });
        setRequests(map);
      }
      if (active) setLoading(false);
    };
    load();
    return () => {
      active = false;
    };
  }, [userId]);

  const search = async (text: string) => {
    setQ(text);
    if (!text.trim()) {
      setResults([]);
      return;
    }
    const supabase = createClient();
    const { data } = await supabase
      .from("gyms")
      .select("id, name, city, address")
      .or(`name.ilike.%${text}%,city.ilike.%${text}%`)
      .limit(8);
    setResults((data as GymRow[]) ?? []);
  };

  const postular = async (g: GymRow) => {
    if (!userId || asking) return;
    setAsking(g.id);
    const supabase = createClient();
    await supabase
      .from("trainer_gym_requests")
      .upsert({ trainer_id: userId, gym_id: g.id }, { onConflict: "trainer_id,gym_id", ignoreDuplicates: true });
    setRequests((prev) => ({ ...prev, [g.id]: "pending" }));
    setAsking(null);
  };

  const locate = () => {
    setLocating(true);
    if (!navigator.geolocation) {
      setLocating(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((v) => ({ ...v, latitude: pos.coords.latitude, longitude: pos.coords.longitude }));
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const formParts = () => ({
    street: form.street.trim(),
    streetNumber: form.streetNumber.trim(),
    postalCode: form.postalCode.trim(),
    province: form.province.trim(),
    city: form.city.trim(),
  });

  const emptyForm = () => ({
    name: "",
    street: "",
    streetNumber: "",
    postalCode: "",
    province: "",
    city: "",
    availability: "",
    disciplines: [] as string[],
    description: "",
    notes: "",
    latitude: null as number | null,
    longitude: null as number | null,
  });

  const startEdit = (z: TrainerGym) => {
    setForm({
      name: z.name ?? "",
      street: z.street ?? "",
      streetNumber: z.street_number ?? "",
      postalCode: z.postal_code ?? "",
      province: z.province ?? "",
      city: z.city ?? "",
      availability: z.availability ?? "",
      disciplines: z.disciplines ?? [],
      description: z.description ?? "",
      notes: z.notes ?? "",
      latitude: z.latitude,
      longitude: z.longitude,
    });
    setEditingId(z.id);
    setAdding(true);
    setGeoMsg(null);
  };

  const cancelEdit = () => {
    setForm(emptyForm());
    setEditingId(null);
    setAdding(false);
    setGeoMsg(null);
  };

  const toggleDiscipline = (label: string) => {
    setForm((v) => ({
      ...v,
      disciplines: v.disciplines.includes(label)
        ? v.disciplines.filter((d) => d !== label)
        : [...v.disciplines, label],
    }));
  };

  const saveZone = async () => {
    if (!userId || !form.name.trim()) return;
    const supabase = createClient();
    const parts = formParts();
    const payload = {
      trainer_id: userId,
      name: form.name.trim(),
      city: parts.city || null,
      address: formatAddress(parts) || null,
      street: parts.street || null,
      street_number: parts.streetNumber || null,
      postal_code: parts.postalCode || null,
      province: parts.province || null,
      availability: form.availability.trim() || null,
      disciplines: form.disciplines.length > 0 ? form.disciplines : null,
      description: form.description.trim() || null,
      notes: form.notes.trim() || null,
      latitude: form.latitude,
      longitude: form.longitude,
    };
    if (editingId) {
      const { error } = await supabase.from("trainer_gyms").update(payload).eq("id", editingId);
      if (!error) {
        setZones((prev) => prev.map((z) => (z.id === editingId ? { ...z, ...payload } : z)));
      }
    } else {
      const { data, error } = await supabase
        .from("trainer_gyms")
        .insert(payload)
        .select()
        .maybeSingle();
      if (!error && data) setZones((prev) => [data as TrainerGym, ...prev]);
    }
    setForm(emptyForm());
    setGeoMsg(null);
    setEditingId(null);
    setAdding(false);
  };

  const geocodeForm = async () => {
    const parts = formParts();
    if (!parts.street && !parts.city) return;
    setGeocoding(true);
    setGeoMsg(null);
    try {
      const geo = await geocodeAddress(parts);
      if (geo) {
        setForm((v) => ({ ...v, latitude: geo.lat, longitude: geo.lng }));
        setGeoMsg(`Pin ubicado: ${geo.displayName}`);
      } else {
        setGeoMsg("No encontramos esa dirección. Revisá calle, altura, código postal, provincia y ciudad.");
      }
    } catch {
      setGeoMsg("Error al buscar la dirección. Probá de nuevo.");
    }
    setGeocoding(false);
  };

  const removeZone = async (id: string) => {
    await createClient().from("trainer_gyms").delete().eq("id", id);
    setZones((prev) => prev.filter((z) => z.id !== id));
  };

  if (loading) {
    return (
      <main className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-neon" />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-xl px-4 pt-5 md:max-w-2xl lg:max-w-3xl">
      <h1 className="text-xl font-bold text-ink">Mi zona</h1>
      <p className="mt-1 text-sm text-muted">
        Postulate a gimnasios o sumá los lugares donde trabajás para que los alumnos te encuentren por zona.
      </p>

      <div className="mt-4 space-y-3">
        <div className="rounded-xl border border-ember/30 bg-ember/5 p-3">
          <div className="flex items-center gap-2 rounded-lg border border-edge bg-bg px-3 py-2">
            <Search className="h-4 w-4 text-muted" />
            <input
              value={q}
              onChange={(e) => search(e.target.value)}
              placeholder="Buscar gimnasio para postularte…"
              className="w-full bg-transparent text-sm text-ink placeholder:text-muted focus:outline-none"
            />
          </div>
          {results.length > 0 && (
            <div className="mt-2 divide-y divide-edge">
              {results.map((g) => {
                const st = requests[g.id];
                return (
                  <div key={g.id} className="flex items-center justify-between py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">
                        <Building2 className="mr-1 inline h-3.5 w-3.5 text-muted" />
                        {g.name}
                      </p>
                      <p className="text-xs text-muted">
                        {[g.city, g.address].filter(Boolean).join(" · ") || "Sin ubicación"}
                      </p>
                    </div>
                    {st ? (
                      <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${STATUS_CLASS[st] ?? ""}`}>
                        {STATUS_LABEL[st] ?? st}
                      </span>
                    ) : (
                      <button
                        onClick={() => postular(g)}
                        disabled={asking === g.id}
                        className="flex shrink-0 items-center gap-1 rounded-lg bg-ember px-3 py-1.5 text-xs font-semibold text-bg"
                      >
                        <UserPlus className="h-3.5 w-3.5" /> Postularme
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {q.trim().length > 0 && results.length === 0 && (
            <p className="py-3 text-center text-sm text-muted">No se encontró ningún gimnasio.</p>
          )}
        </div>

        <button
          onClick={() => {
            if (adding) cancelEdit();
            else setAdding(true);
          }}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-edge bg-card py-3 text-sm font-medium text-ember"
        >
          <Plus className="h-4 w-4" /> Agregar gimnasio manual
        </button>

        {adding && (
          <div className="space-y-2 rounded-xl border border-edge bg-card p-3">
            {editingId && (
              <p className="flex items-center gap-1 text-xs font-semibold text-neon">
                <Pencil className="h-3 w-3" /> Editando ubicación
              </p>
            )}
            <input
              value={form.name}
              onChange={(e) => setForm((v) => ({ ...v, name: e.target.value }))}
              placeholder="Gimnasio (ej: Smart Fit Güemes)"
              className="w-full rounded-lg border border-edge bg-bg px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-neon focus:outline-none"
            />
            <input
              value={form.street}
              onChange={(e) => setForm((v) => ({ ...v, street: e.target.value }))}
              placeholder="Calle (ej: Bv. San Juan)"
              className="w-full rounded-lg border border-edge bg-bg px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-neon focus:outline-none"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                value={form.streetNumber}
                onChange={(e) => setForm((v) => ({ ...v, streetNumber: e.target.value }))}
                placeholder="Altura"
                className="w-full rounded-lg border border-edge bg-bg px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-neon focus:outline-none"
              />
              <input
                value={form.postalCode}
                onChange={(e) => setForm((v) => ({ ...v, postalCode: e.target.value }))}
                placeholder="Código postal"
                className="w-full rounded-lg border border-edge bg-bg px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-neon focus:outline-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                value={form.province}
                onChange={(e) => setForm((v) => ({ ...v, province: e.target.value }))}
                placeholder="Provincia (ej: Córdoba)"
                className="w-full rounded-lg border border-edge bg-bg px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-neon focus:outline-none"
              />
              <input
                value={form.city}
                onChange={(e) => setForm((v) => ({ ...v, city: e.target.value }))}
                placeholder="Ciudad / barrio (ej: Córdoba, Centro)"
                className="w-full rounded-lg border border-edge bg-bg px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-neon focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-2">
              <div className="flex grow items-center gap-2 rounded-lg border border-edge bg-bg px-3 py-2">
                <Clock3 className="h-3.5 w-3.5 text-muted" />
                <input
                  value={form.availability}
                  onChange={(e) => setForm((v) => ({ ...v, availability: e.target.value }))}
                  placeholder="Horarios (ej: Lun a Vie 8-14)"
                  className="w-full bg-transparent text-sm text-ink placeholder:text-muted focus:outline-none"
                />
              </div>
              <button
                onClick={locate}
                disabled={locating}
                className="flex shrink-0 items-center gap-1 rounded-lg border border-neon/40 bg-neon/10 px-3 py-2 text-xs font-semibold text-neon"
              >
                {locating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Navigation className="h-3.5 w-3.5" />}
                GPS
              </button>
            </div>
            <button
              onClick={geocodeForm}
              disabled={geocoding}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-edge bg-elevated px-3 py-2 text-sm font-medium text-ink transition hover:border-neon/40 hover:text-neon disabled:opacity-60"
            >
              {geocoding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
              {geocoding ? "Buscando dirección…" : "Buscar dirección en el mapa"}
            </button>
            {geoMsg && <p className="text-xs text-neon">{geoMsg}</p>}
            {form.latitude != null && (
              <p className="text-xs text-muted">
                Ubicación: {form.latitude.toFixed(5)}, {form.longitude?.toFixed(5)}
              </p>
            )}
            <div className="pt-1">
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
                Disciplinas que se entrenan
              </p>
              <div className="flex flex-wrap gap-1.5">
                {DISCIPLINE_LABELS.map((label) => {
                  const on = form.disciplines.includes(label);
                  return (
                    <button
                      key={label}
                      type="button"
                      onClick={() => toggleDiscipline(label)}
                      className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${
                        on
                          ? "border-neon/60 bg-neon/15 text-neon"
                          : "border-edge bg-bg text-muted hover:border-neon/40 hover:text-ink"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
            <textarea
              value={form.description}
              onChange={(e) => setForm((v) => ({ ...v, description: e.target.value }))}
              placeholder="Descripción (ej: Entrenamiento personalizado de fuerza 1 a 1)"
              rows={2}
              className="w-full resize-none rounded-lg border border-edge bg-bg px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-neon focus:outline-none"
            />
            <textarea
              value={form.notes}
              onChange={(e) => setForm((v) => ({ ...v, notes: e.target.value }))}
              placeholder="Notas / condiciones (ej: Boxeo disponible, no hay ducha)"
              rows={2}
              className="w-full resize-none rounded-lg border border-edge bg-bg px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-neon focus:outline-none"
            />
            <button
              onClick={saveZone}
              disabled={!form.name.trim()}
              className="w-full rounded-lg bg-neon py-2.5 text-sm font-semibold text-bg shadow-neon disabled:opacity-50"
            >
              {editingId ? "Guardar cambios" : "Guardar"}
            </button>
            {editingId && (
              <button
                onClick={cancelEdit}
                className="w-full rounded-lg border border-edge bg-bg py-2.5 text-sm font-medium text-muted transition hover:border-ember/40 hover:text-ember"
              >
                Cancelar edición
              </button>
            )}
          </div>
        )}
      </div>

      <div className="mt-5">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">Mis lugares</p>
        {zones.length === 0 && (
          <p className="py-10 text-center text-sm text-muted">
            Aún no agregaste gimnasios.
          </p>
        )}
        {zones.map((z) => (
          <div key={z.id} className="mb-2 flex items-center gap-3 rounded-xl border border-edge bg-card p-3.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ember/15">
              <MapPin className="h-5 w-5 text-ember" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-ink">{z.name || "Sin nombre"}</p>
              <p className="truncate text-xs text-muted">
                {[z.city, z.address].filter(Boolean).join(" · ") || "Sin ubicación"}
              </p>
              {z.availability && (
                <p className="flex items-center gap-1 text-xs text-neon">
                  <Clock3 className="h-3 w-3" /> {z.availability}
                </p>
              )}
              {z.disciplines && z.disciplines.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {z.disciplines.map((d) => (
                    <span key={d} className="rounded-full border border-neon/40 bg-neon/10 px-2 py-0.5 text-[10px] font-semibold text-neon">
                      {d}
                    </span>
                  ))}
                </div>
              )}
              {z.description && <p className="mt-1 text-xs text-muted">{z.description}</p>}
              {z.notes && <p className="mt-1 text-xs text-muted">📌 {z.notes}</p>}
              {z.created_at && <p className="mt-0.5 text-[11px] text-muted">Agregado {timeAgo(z.created_at)}</p>}
            </div>
            <button
              onClick={() => startEdit(z)}
              className="shrink-0 text-muted transition hover:text-neon"
              title="Editar"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button onClick={() => removeZone(z.id)} className="shrink-0 text-muted hover:text-ember" title="Eliminar">
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </main>
  );
}