"use client";

import { useEffect, useState } from "react";
import { Loader2, MapPin, Plus, X, Search, Building2, Navigation, Clock3, UserPlus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuthState } from "@/lib/auth-context";
import { timeAgo } from "@/lib/format";

interface TrainerGym {
  id: string;
  gym_id: string | null;
  name: string | null;
  city: string | null;
  address: string | null;
  availability: string | null;
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
  const [locating, setLocating] = useState(false);
  const [form, setForm] = useState({
    name: "",
    city: "",
    address: "",
    availability: "",
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

  const addZone = async () => {
    if (!userId || !form.name.trim()) return;
    const supabase = createClient();
    const { data, error } = await supabase
      .from("trainer_gyms")
      .insert({
        trainer_id: userId,
        name: form.name.trim(),
        city: form.city.trim() || null,
        address: form.address.trim() || null,
        availability: form.availability.trim() || null,
        latitude: form.latitude,
        longitude: form.longitude,
      })
      .select()
      .maybeSingle();
    if (!error && data) setZones((prev) => [data as TrainerGym, ...prev]);
    setForm({ name: "", city: "", address: "", availability: "", latitude: null, longitude: null });
    setAdding(false);
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
    <main className="mx-auto max-w-md px-4 pt-5">
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
          onClick={() => setAdding((v) => !v)}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-edge bg-card py-3 text-sm font-medium text-ember"
        >
          <Plus className="h-4 w-4" /> Agregar gimnasio manual
        </button>

        {adding && (
          <div className="space-y-2 rounded-xl border border-edge bg-card p-3">
            <input
              value={form.name}
              onChange={(e) => setForm((v) => ({ ...v, name: e.target.value }))}
              placeholder="Gimnasio (ej: Smart Fit Güemes)"
              className="w-full rounded-lg border border-edge bg-bg px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-neon focus:outline-none"
            />
            <input
              value={form.city}
              onChange={(e) => setForm((v) => ({ ...v, city: e.target.value }))}
              placeholder="Ciudad / barrio (ej: Córdoba, Centro)"
              className="w-full rounded-lg border border-edge bg-bg px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-neon focus:outline-none"
            />
            <input
              value={form.address}
              onChange={(e) => setForm((v) => ({ ...v, address: e.target.value }))}
              placeholder="Dirección (opcional)"
              className="w-full rounded-lg border border-edge bg-bg px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-neon focus:outline-none"
            />
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
                Ubicación
              </button>
            </div>
            {form.latitude != null && (
              <p className="text-xs text-muted">
                Ubicación: {form.latitude.toFixed(5)}, {form.longitude?.toFixed(5)}
              </p>
            )}
            <button
              onClick={addZone}
              disabled={!form.name.trim()}
              className="w-full rounded-lg bg-neon py-2.5 text-sm font-semibold text-bg shadow-neon disabled:opacity-50"
            >
              Guardar
            </button>
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
              {z.created_at && <p className="text-[11px] text-muted">Agregado {timeAgo(z.created_at)}</p>}
            </div>
            <button onClick={() => removeZone(z.id)} className="shrink-0 text-muted hover:text-ember">
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </main>
  );
}