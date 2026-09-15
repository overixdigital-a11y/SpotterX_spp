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
    <main className="mx-auto max-w-5xl px-4 pt-2 md:pt-4">
      <div className="flex items-center justify-between border-b border-edge/60 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-ink">Mi gimnasio</h1>
          <p className="mt-0.5 text-sm text-muted">
            Configurá tu gimnasio, datos de contacto, ubicación GPS y pase QR de acceso.
          </p>
        </div>
        {gym && !editing && (
          <button
            onClick={() => setEditing(true)}
            className="flex items-center gap-1.5 rounded-xl border border-neon/40 bg-neon/10 px-3.5 py-2 text-xs font-semibold text-neon transition hover:bg-neon/20"
          >
            <Pencil className="h-4 w-4" /> Editar Datos
          </button>
        )}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Columna Izquierda: Formulario & Ubicación */}
        <div className="space-y-4 rounded-2xl border border-edge bg-card p-5">
          <h2 className="text-base font-bold text-ink">Información del Establecimiento</h2>

          {!gym && !editing ? (
            <button
              onClick={() => setEditing(true)}
              className="mt-4 w-full rounded-xl bg-neon py-3 font-semibold text-bg shadow-neon"
            >
              Crear mi gimnasio
            </button>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-muted">Nombre Comercial</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ej: PowerGym Centro"
                  className="w-full rounded-xl border border-edge bg-bg px-3.5 py-2.5 text-sm text-ink placeholder:text-muted focus:border-neon focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-muted">Dirección Completa</label>
                <input
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  placeholder="Ej: Av. Corrientes 1234"
                  className="w-full rounded-xl border border-edge bg-bg px-3.5 py-2.5 text-sm text-ink placeholder:text-muted focus:border-neon focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-muted">Ciudad / Barrio</label>
                  <input
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                    placeholder="Ej: Palermo"
                    className="w-full rounded-xl border border-edge bg-bg px-3.5 py-2.5 text-sm text-ink placeholder:text-muted focus:border-neon focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-muted">Aforo Máximo</label>
                  <input
                    value={form.capacity}
                    onChange={(e) => setForm({ ...form, capacity: e.target.value })}
                    placeholder="Ej: 100 personas"
                    type="number"
                    className="w-full rounded-xl border border-edge bg-bg px-3.5 py-2.5 text-sm text-ink placeholder:text-muted focus:border-neon focus:outline-none"
                  />
                </div>
              </div>

              <button
                onClick={locate}
                disabled={locating}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-neon/40 bg-neon/10 py-2.5 text-sm font-medium text-neon transition hover:bg-neon/20 disabled:opacity-60"
              >
                <MapPin className="h-4 w-4" />
                {locating ? "Obteniendo ubicación…" : "Obtener mi ubicación (GPS)"}
              </button>

              {gym?.latitude && gym?.longitude && (
                <p className="text-xs text-muted">
                  📍 Ubicación guardada: {gym.latitude.toFixed(5)}, {gym.longitude.toFixed(5)}
                </p>
              )}

              {editing && (
                <button
                  onClick={saveGym}
                  disabled={saving || !form.name.trim()}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-neon py-3 font-semibold text-bg shadow-neon transition hover:opacity-90 disabled:opacity-60"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  Guardar cambios
                </button>
              )}
            </div>
          )}
        </div>

        {/* Columna Derecha: Mapa & Pase QR */}
        <div className="space-y-6">
          {/* Leaflet Map Card */}
          <div className="rounded-2xl border border-edge bg-card p-5">
            <h2 className="mb-3 text-base font-bold text-ink">Mapa de Ubicación</h2>
            {gym?.latitude && gym?.longitude ? (
              <GymMap latitude={gym.latitude} longitude={gym.longitude} name={gym.name} />
            ) : (
              <p className="rounded-xl border border-dashed border-edge bg-bg p-8 text-center text-xs text-muted">
                Usá &quot;Obtener mi ubicación (GPS)&quot; para desplegar tu gimnasio en el mapa interactivo.
              </p>
            )}
          </div>

          {/* QR Code Card */}
          {gym && (
            <div className="rounded-2xl border border-edge bg-card p-5 text-center space-y-3">
              <p className="text-base font-bold text-ink">Código QR de Ingreso</p>
              <p className="text-xs text-muted">
                Imprimilo o mostralo en tu recepción para que alumnos y profesores registren su check-in.
              </p>
              <div className="mx-auto w-fit rounded-2xl bg-white p-4 shadow-xl">
                <QRCodeSVG
                  value={`https://spotterx-five.vercel.app/checkin/${gym.qr_code}`}
                  size={200}
                  fgColor="#05070a"
                />
              </div>
              <p className="font-mono text-xs font-semibold text-neon">{gym.qr_code}</p>
              <button
                onClick={() => window.print()}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-edge bg-elevated py-2.5 text-sm font-medium text-ink transition hover:border-neon/40 hover:text-neon"
              >
                <Save className="h-4 w-4" /> Imprimir Pase QR
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
