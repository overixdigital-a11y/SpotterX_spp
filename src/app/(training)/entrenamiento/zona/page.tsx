"use client";

import { useEffect, useState } from "react";
import { Loader2, MapPin, Plus, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuthState } from "@/lib/auth-context";

interface TrainerGym {
  id: string;
  gym_id: string | null;
  name: string | null;
  city: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
}

export default function ZonaPage() {
  const { userId } = useAuthState();
  const [zones, setZones] = useState<TrainerGym[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");

  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    let active = true;
    const load = async () => {
      const { data } = await supabase
        .from("trainer_gyms")
        .select("*")
        .eq("trainer_id", userId)
        .order("created_at", { ascending: false });
      if (active && data) setZones(data as TrainerGym[]);
      if (active) setLoading(false);
    };
    load();
    return () => {
      active = false;
    };
  }, [userId]);

  const addZone = async () => {
    if (!userId || !name.trim()) return;
    const supabase = createClient();
    // geolocalización básica por ciudad (sin API externa por ahora)
    const { data, error } = await supabase
      .from("trainer_gyms")
      .insert({ trainer_id: userId, name: name.trim(), city: city.trim() || null, address: address.trim() || null })
      .select()
      .maybeSingle();
    if (!error && data) setZones((prev) => [data as TrainerGym, ...prev]);
    setName(""); setCity(""); setAddress("");
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
        Los gimnasios donde trabajás aparecen en tu perfil para que los alumnos te encuentren por zona.
      </p>

      <button
        onClick={() => setAdding((v) => !v)}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-edge bg-card py-3 text-sm font-medium text-ember"
      >
        <Plus className="h-4 w-4" /> Agregar gimnasio
      </button>

      {adding && (
        <div className="mt-3 space-y-2 rounded-xl border border-edge bg-card p-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Gimnasio (ej: Smart Fit Güemes)"
            className="w-full rounded-lg border border-edge bg-bg px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-neon focus:outline-none"
          />
          <input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="Ciudad / barrio (ej: Córdoba, Centro)"
            className="w-full rounded-lg border border-edge bg-bg px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-neon focus:outline-none"
          />
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Dirección (opcional)"
            className="w-full rounded-lg border border-edge bg-bg px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-neon focus:outline-none"
          />
          <button
            onClick={addZone}
            disabled={!name.trim()}
            className="w-full rounded-lg bg-neon py-2.5 text-sm font-semibold text-bg shadow-neon disabled:opacity-50"
          >
            Guardar
          </button>
        </div>
      )}

      <div className="mt-4">
        {zones.length === 0 && (
          <p className="py-10 text-center text-sm text-muted">
            Aún no agregaste gimnasios.
          </p>
        )}
        {zones.map((z) => (
          <div key={z.id} className="flex items-center gap-3 rounded-xl border border-edge bg-card p-3.5 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-ember/15">
              <MapPin className="h-5 w-5 text-ember" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-ink">{z.name || "Sin nombre"}</p>
              <p className="text-xs text-muted">
                {[z.city, z.address].filter(Boolean).join(" · ") || "Sin ubicación"}
              </p>
            </div>
            <button onClick={() => removeZone(z.id)} className="text-muted hover:text-ember">
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </main>
  );
}
