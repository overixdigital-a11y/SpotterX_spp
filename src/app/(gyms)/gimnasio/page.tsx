"use client";

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Loader2, MapPin, Pencil, Check, Save } from "lucide-react";
import dynamic from "next/dynamic";
import { createClient } from "@/lib/supabase/client";
import { useAuthState } from "@/lib/auth-context";

const GymMap = dynamic(() => import("@/components/gyms/GymMap"), { ssr: false });

interface Gym {
  id: string;
  name: string | null;
  address: string | null;
  city: string | null;
  capacity: number | null;
  latitude: number | null;
  longitude: number | null;
  qr_code: string | null;
}

export default function GymPanelPage() {
  const { userId } = useAuthState();
  const [gym, setGym] = useState<Gym | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: "",
    address: "",
    city: "",
    capacity: "",
  });

  useEffect(() => {
    let active = true;
    (async () => {
      if (!userId) return;
      const supabase = createClient();
      const { data } = await supabase
        .from("gyms")
        .select("*")
        .eq("owner_id", userId)
        .maybeSingle();
      if (active && data) {
        setGym(data as Gym);
        setForm({
          name: data.name ?? "",
          address: data.address ?? "",
          city: data.city ?? "",
          capacity: data.capacity != null ? String(data.capacity) : "",
        });
      }
      if (active) setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [userId]);

  const saveGym = async () => {
    if (!userId) return;
    setSaving(true);
    const supabase = createClient();
    const payload = {
      owner_id: userId,
      name: form.name.trim(),
      address: form.address.trim() || null,
      city: form.city.trim() || null,
      capacity: form.capacity ? Number(form.capacity) : null,
      qr_code: gym?.qr_code ?? `SPX-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
    };
    if (gym) {
      const { data } = await supabase.from("gyms").update(payload).eq("id", gym.id).select().single();
      if (data) setGym(data as Gym);
    } else {
      const { data } = await supabase.from("gyms").insert(payload).select().single();
      if (data) setGym(data as Gym);
    }
    setEditing(false);
    setSaving(false);
  };

  const locate = () => {
    if (!("geolocation" in navigator)) return alert("Tu dispositivo no soporta geolocalización");
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setGym((prev) => (prev ? { ...prev, latitude: lat, longitude: lng } : prev));
        if (gym) {
          await createClient().from("gyms").update({ latitude: lat, longitude: lng }).eq("id", gym.id);
        }
        setLocating(false);
      },
      () => {
        alert("No se pudo obtener la ubicación");
        setLocating(false);
      },
      { enableHighAccuracy: true }
    );
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
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-ink">Mi gimnasio</h1>
        {gym && !editing && (
          <button onClick={() => setEditing(true)} className="flex items-center gap-1 text-xs font-medium text-neon">
            <Pencil className="h-3.5 w-3.5" /> Editar
          </button>
        )}
      </div>
      <p className="mt-1 text-sm text-muted">
        Configurá tu gimnasio para el control de acceso.
      </p>

      {!gym && !editing ? (
        <button
          onClick={() => setEditing(true)}
          className="mt-6 w-full rounded-xl bg-neon py-3 font-semibold text-bg shadow-neon"
        >
          Crear mi gimnasio
        </button>
      ) : (
        <div className="mt-5 space-y-3">
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Nombre del gimnasio"
            className="w-full rounded-xl border border-edge bg-card px-3.5 py-2.5 text-sm text-ink placeholder:text-muted focus:border-neon focus:outline-none"
          />
          <input
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            placeholder="Dirección"
            className="w-full rounded-xl border border-edge bg-card px-3.5 py-2.5 text-sm text-ink placeholder:text-muted focus:border-neon focus:outline-none"
          />
          <input
            value={form.city}
            onChange={(e) => setForm({ ...form, city: e.target.value })}
            placeholder="Ciudad / Barrio"
            className="w-full rounded-xl border border-edge bg-card px-3.5 py-2.5 text-sm text-ink placeholder:text-muted focus:border-neon focus:outline-none"
          />
          <input
            value={form.capacity}
            onChange={(e) => setForm({ ...form, capacity: e.target.value })}
            placeholder="Capacidad (aforo)"
            type="number"
            className="w-full rounded-xl border border-edge bg-card px-3.5 py-2.5 text-sm text-ink placeholder:text-muted focus:border-neon focus:outline-none"
          />

          <button
            onClick={locate}
            disabled={locating}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-neon/40 bg-neon/10 py-2.5 text-sm font-medium text-neon disabled:opacity-60"
          >
            <MapPin className="h-4 w-4" />
            {locating ? "Obteniendo ubicación…" : "Obtener mi ubicación (GPS)"}
          </button>

          {gym?.latitude && gym?.longitude ? (
            <GymMap latitude={gym.latitude} longitude={gym.longitude} name={gym.name} />
          ) : (
            <p className="rounded-xl border border-dashed border-edge bg-card p-4 text-center text-xs text-muted">
              Usá &quot;Obtener mi ubicación&quot; para mostrar tu gimnasio en el mapa.
            </p>
          )}

          {editing && (
            <button
              onClick={saveGym}
              disabled={saving || !form.name.trim()}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-neon py-3 font-semibold text-bg shadow-neon disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Guardar
            </button>
          )}
        </div>
      )}

      {gym?.latitude && gym?.longitude && (
        <p className="mt-2 text-xs text-muted">
          📍 {gym.latitude.toFixed(5)}, {gym.longitude.toFixed(5)}
        </p>
      )}

      {gym && (
        <div className="mt-6 rounded-2xl border border-edge bg-card p-5 text-center">
          <p className="text-sm font-semibold text-ink">Código QR de tu gimnasio</p>
          <p className="mt-0.5 text-xs text-muted">
            Imprimilo y pegalo en la entrada. Los miembros lo escanean con su celular.
          </p>
          <div className="mx-auto mt-4 w-fit rounded-xl bg-white p-3">
            <QRCodeSVG
              value={`https://spotterx-five.vercel.app/checkin/${gym.qr_code}`}
              size={180}
              fgColor="#05070a"
            />
          </div>
          <p className="mt-2 font-mono text-xs text-neon">{gym.qr_code}</p>
          <button
            onClick={() => window.print()}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-edge bg-elevated py-2.5 text-sm font-medium text-ink"
          >
            <Save className="h-4 w-4" /> Imprimir QR
          </button>
        </div>
      )}
    </main>
  );
}
