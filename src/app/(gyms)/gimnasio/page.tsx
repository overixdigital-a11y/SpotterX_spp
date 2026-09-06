"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { Loader2, MapPin, Pencil, Check, Save, Send, Users, Activity, AlertTriangle, Wallet, Clock3 } from "lucide-react";
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

interface Summary {
  members: number;
  presence: number;
  debtors: number;
  income: number;
}

interface StaffRow {
  user_id: string;
  role: string;
  authorized: boolean;
}

interface StaffView {
  user_id: string;
  role: string;
  authorized: boolean;
  name: string;
  hours: number;
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function startOfMonth() {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function computeHours(logs: { type: string; created_at: string }[]) {
  const sorted = [...logs].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  let total = 0;
  let openAt: number | null = null;
  for (const l of sorted) {
    const t = new Date(l.created_at).getTime();
    if (l.type === "ingreso") {
      if (openAt == null) openAt = t;
    } else if (l.type === "egreso" && openAt != null) {
      total += (t - openAt) / 3600000;
      openAt = null;
    }
  }
  if (openAt != null) total += (Date.now() - openAt) / 3600000;
  return Math.round(total * 10) / 10;
}

export default function GymPanelPage() {
  const { userId } = useAuthState();
  const [gym, setGym] = useState<Gym | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [summary, setSummary] = useState<Summary>({ members: 0, presence: 0, debtors: 0, income: 0 });
  const [staff, setStaff] = useState<StaffView[]>([]);

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

        const [membersRes, presRes, debtRes, payRes, staffRes] = await Promise.all([
          supabase.from("gym_memberships").select("id").eq("gym_id", data.id).eq("status", "activa"),
          supabase.from("gym_presence").select("user_id").eq("gym_id", data.id),
          supabase
            .from("gym_memberships")
            .select("pay_status, expires_on")
            .eq("gym_id", data.id)
            .eq("status", "activa"),
          supabase
            .from("gym_payments")
            .select("amount")
            .eq("gym_id", data.id)
            .gte("paid_at", startOfMonth()),
          supabase.from("gym_staff").select("user_id, role, authorized").eq("gym_id", data.id),
        ]);
        if (active) {
          const memberships = (debtRes.data ?? []) as { pay_status: string; expires_on: string | null }[];
          const today = new Date(new Date().toDateString()).getTime();
          const debtors = memberships.filter(
            (m) =>
              (m.pay_status !== "pagado" && m.pay_status !== "promo") ||
              (m.expires_on ? new Date(m.expires_on).getTime() < today : false)
          );
          setSummary({
            members: (membersRes.data ?? []).length,
            presence: (presRes.data ?? []).length,
            debtors: debtors.length,
            income:
              ((payRes.data ?? []) as { amount: number | null }[]).reduce(
                (acc, p) => acc + (p.amount ?? 0),
                0
              ),
          });
        }

        const staffRows = (staffRes.data ?? []) as StaffRow[];
        if (staffRows.length > 0) {
          const ids = [...new Set(staffRows.map((s) => s.user_id))];
          const { data: profs } = await supabase
            .from("profiles")
            .select("id, full_name, username")
            .in("id", ids);
          const nameMap = new Map(
            ((profs ?? []) as { id: string; full_name: string | null; username: string | null }[]).map(
              (p) => [p.id, p.full_name ?? p.username ?? "Profesor"]
            )
          );
          const { data: logs } = await supabase
            .from("gym_access_logs")
            .select("user_id, type, created_at")
            .eq("gym_id", data.id)
            .in("user_id", ids)
            .gte("created_at", startOfToday());
          const byUser = new Map<string, { type: string; created_at: string }[]>();
          for (const l of (logs ?? []) as { user_id: string; type: string; created_at: string }[]) {
            const arr = byUser.get(l.user_id) ?? [];
            arr.push({ type: l.type, created_at: l.created_at });
            byUser.set(l.user_id, arr);
          }
          if (active) {
            setStaff(
              staffRows.map((s) => ({
                user_id: s.user_id,
                role: s.role,
                authorized: s.authorized,
                name: nameMap.get(s.user_id) ?? "Profesor",
                hours: computeHours(byUser.get(s.user_id) ?? []),
              }))
            );
          }
        }
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
        <>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-2xl border border-edge bg-card p-4">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-muted">
                <Users className="h-3.5 w-3.5 text-neon" /> Miembros activos
              </p>
              <p className="mt-1 text-3xl font-extrabold text-ink">{summary.members}</p>
            </div>
            <div className="rounded-2xl border border-edge bg-card p-4">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-muted">
                <Activity className="h-3.5 w-3.5 text-neon" /> Ahora dentro
              </p>
              <p className="mt-1 text-3xl font-extrabold text-ink">
                {summary.presence}
                {gym.capacity != null && <span className="text-base font-medium text-muted">/{gym.capacity}</span>}
              </p>
            </div>
            <div className="rounded-2xl border border-edge bg-card p-4">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-muted">
                <AlertTriangle className="h-3.5 w-3.5 text-ember" /> Deudores
              </p>
              <p className={`mt-1 text-3xl font-extrabold ${summary.debtors > 0 ? "text-ember" : "text-ink"}`}>
                {summary.debtors}
              </p>
            </div>
            <div className="rounded-2xl border border-edge bg-card p-4">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-muted">
                <Wallet className="h-3.5 w-3.5 text-ember" /> Ingresos del mes
              </p>
              <p className="mt-1 text-3xl font-extrabold text-ink">${summary.income}</p>
            </div>
          </div>

          <Link
            href="/crear"
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-neon/40 bg-neon/10 py-2.5 text-sm font-semibold text-neon"
          >
            <Send className="h-4 w-4" /> Publicar en el feed
          </Link>

          {staff.length > 0 && (
            <div className="mt-6">
              <p className="text-sm font-semibold text-ink">Staff</p>
              <p className="mt-0.5 text-xs text-muted">Horas trabajadas hoy (según accesos).</p>
              <div className="mt-3 space-y-2">
                {staff.map((s) => (
                  <div
                    key={s.user_id}
                    className="flex items-center justify-between rounded-xl border border-edge bg-card p-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink">{s.name}</p>
                      <p className="text-[11px] text-muted">
                        {s.role} {s.authorized ? "" : "· pendiente de autorización"}
                      </p>
                    </div>
                    <span className="flex shrink-0 items-center gap-1 rounded-full bg-neon/20 px-2.5 py-1 text-xs font-bold text-neon">
                      <Clock3 className="h-3.5 w-3.5" /> {s.hours} h
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

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
        </>
      )}
    </main>
  );
}