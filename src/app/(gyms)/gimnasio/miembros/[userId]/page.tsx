"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Loader2,
  Save,
  Phone,
  MapPin,
  Shield,
  Cake,
  IdCard,
  Siren,
  StickyNote,
  Download,
  DoorOpen,
  DoorClosed,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuthState } from "@/lib/auth-context";

interface MemberProfile {
  id: string;
  full_name: string | null;
  email: string | null;
  username: string | null;
}

interface Membership {
  plan_name: string | null;
  status: string | null;
  pay_status: string | null;
  expires_on: string | null;
}

interface Details {
  phone: string | null;
  address: string | null;
  city: string | null;
  obra_social: string | null;
  birth_date: string | null;
  dni: string | null;
  emergency_name: string | null;
  emergency_phone: string | null;
  notes: string | null;
}

interface MemberLog {
  id: string;
  type: string;
  created_at: string;
}

interface MemberPay {
  id: string;
  amount: number | null;
  method: string | null;
  note: string | null;
  paid_at: string;
}

function exportMemberCsv(
  name: string,
  logs: MemberLog[],
  pays: MemberPay[]
) {
  const rows: (string | number)[][] = [
    ...logs.map((l) => ["Acceso", l.type === "ingreso" ? "Entrada" : "Salida", l.created_at, ""]),
    ...pays.map((p) => ["Pago", p.note ?? "Cuota", p.paid_at, p.amount ?? ""]),
  ];
  const lines = [
    "registro;detalle;fecha;monto",
    ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")),
  ];
  const blob = new Blob(["\uFEFF" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${(name || "miembro").replace(/[^\w.-]+/g, "_")}-historial.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function Field({
  icon,
  label,
  value,
  onChange,
  placeholder,
  type,
  textarea,
}: {
  icon: ReactNode;
  label: string;
  value: string | null;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  textarea?: boolean;
}) {
  return (
    <div>
      <label className="flex items-center gap-1.5 text-xs font-medium text-muted">
        {icon} {label}
      </label>
      {textarea ? (
        <textarea
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          placeholder={placeholder}
          className="mt-1 w-full resize-none rounded-xl border border-edge bg-card px-3.5 py-2.5 text-sm text-ink placeholder:text-muted focus:border-neon focus:outline-none"
        />
      ) : (
        <input
          type={type ?? "text"}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="mt-1 w-full rounded-xl border border-edge bg-card px-3.5 py-2.5 text-sm text-ink placeholder:text-muted focus:border-neon focus:outline-none"
        />
      )}
    </div>
  );
}

export default function MemberDetailPage() {
  const { userId: userIdParam } = useParams<{ userId: string }>();
  const { userId } = useAuthState();
  const [gymId, setGymId] = useState<string | null>(null);
  const [profile, setProfile] = useState<MemberProfile | null>(null);
  const [membership, setMembership] = useState<Membership | null>(null);
  const [isStaff, setIsStaff] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState<Details>({
    phone: "",
    address: "",
    city: "",
    obra_social: "",
    birth_date: "",
    dni: "",
    emergency_name: "",
    emergency_phone: "",
    notes: "",
  });
  const [age, setAge] = useState<number | null>(null);
  const [logs, setLogs] = useState<MemberLog[]>([]);
  const [pays, setPays] = useState<MemberPay[]>([]);

  const ageFrom = (birth: string) =>
    birth
      ? Math.floor(
          (Date.now() - new Date(birth).getTime()) /
            (365.25 * 24 * 60 * 60 * 1000)
        )
      : null;

  useEffect(() => {
    let active = true;
    (async () => {
      if (!userId) return;
      const supabase = createClient();
      const { data: gymData } = await supabase
        .from("gyms")
        .select("id")
        .eq("owner_id", userId)
        .maybeSingle();
      if (!active || !gymData) {
        if (active) setLoading(false);
        return;
      }
      setGymId(gymData.id);

      const [profRes, memRes, staffRes, detRes, logRes, payRes] = await Promise.all([
        supabase.from("profiles").select("id, full_name, email, username").eq("id", userIdParam).maybeSingle(),
        supabase
          .from("gym_memberships")
          .select("plan_name, status, pay_status, expires_on")
          .eq("gym_id", gymData.id)
          .eq("user_id", userIdParam)
          .maybeSingle(),
        supabase
          .from("gym_staff")
          .select("user_id")
          .eq("gym_id", gymData.id)
          .eq("user_id", userIdParam)
          .maybeSingle(),
        supabase
          .from("gym_member_details")
          .select("*")
          .eq("gym_id", gymData.id)
          .eq("user_id", userIdParam)
          .maybeSingle(),
        supabase
          .from("gym_access_logs")
          .select("id, type, created_at")
          .eq("gym_id", gymData.id)
          .eq("user_id", userIdParam)
          .order("created_at", { ascending: false })
          .limit(15),
        supabase
          .from("gym_payments")
          .select("id, amount, method, note, paid_at")
          .eq("gym_id", gymData.id)
          .eq("user_id", userIdParam)
          .order("paid_at", { ascending: false })
          .limit(15),
      ]);
      if (!active) return;

      if (profRes.data) setProfile(profRes.data as MemberProfile);
      if (memRes.data) setMembership(memRes.data as Membership);
      setIsStaff(!!staffRes.data);

      const d = detRes.data as Details | null;
      if (d) {
        setForm({
          phone: d.phone ?? "",
          address: d.address ?? "",
          city: d.city ?? "",
          obra_social: d.obra_social ?? "",
          birth_date: d.birth_date ?? "",
          dni: d.dni ?? "",
          emergency_name: d.emergency_name ?? "",
          emergency_phone: d.emergency_phone ?? "",
          notes: d.notes ?? "",
        });
        setAge(ageFrom(d.birth_date ?? ""));
      }

      if (active) {
        setLogs((logRes.data ?? []) as MemberLog[]);
        setPays((payRes.data ?? []) as MemberPay[]);
      }

      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [userId, userIdParam]);

  const set = (k: keyof Details, v: string) => {
    setForm((prev) => ({ ...prev, [k]: v }));
    if (k === "birth_date") setAge(ageFrom(v));
  };

  const onSave = async () => {
    if (!gymId || !userIdParam) return;
    setSaving(true);
    setSaved(false);
    const supabase = createClient();
    const { error } = await supabase
      .from("gym_member_details")
      .upsert(
        {
          gym_id: gymId,
          user_id: userIdParam,
          phone: form.phone?.trim() || null,
          address: form.address?.trim() || null,
          city: form.city?.trim() || null,
          obra_social: form.obra_social?.trim() || null,
          birth_date: form.birth_date || null,
          dni: form.dni?.trim() || null,
          emergency_name: form.emergency_name?.trim() || null,
          emergency_phone: form.emergency_phone?.trim() || null,
          notes: form.notes?.trim() || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "gym_id,user_id" }
      );
    if (error) {
      alert("Error al guardar: " + error.message);
    } else {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <main className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-neon" />
      </main>
    );
  }

  const displayName = profile?.full_name ?? profile?.username ?? "Miembro";
  const initial = displayName.slice(0, 2).toUpperCase();
  const payOk = membership?.pay_status === "pagado" || membership?.pay_status === "promo";

  return (
    <main className="mx-auto max-w-2xl">
      <div className="flex items-center gap-3 px-4 pt-4">
        <Link href="/gimnasio/miembros" className="text-muted hover:text-ink">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-lg font-bold text-ink">Ficha del miembro</h1>
      </div>

      <div className="mt-5 flex items-center gap-4 px-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-neon bg-neon/20 text-lg font-bold text-neon">
          {initial}
        </div>
        <div className="min-w-0">
          <h2 className="truncate text-lg font-bold text-ink">{displayName}</h2>
          <p className="truncate text-xs text-muted">
            @{profile?.username}
            {profile?.email ? ` · ${profile.email}` : ""}
          </p>
          <span
            className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${
              isStaff ? "bg-ember/20 text-ember" : "bg-neon/20 text-neon"
            }`}
          >
            {isStaff ? "Profesor del gimnasio" : "Alumno"}
          </span>
        </div>
      </div>

      {membership && (
        <div className="mx-4 mt-4 rounded-xl border border-edge bg-card p-3 text-xs">
          <div className="flex justify-between">
            <span className="text-muted">Plan</span>
            <span className="font-semibold text-ink">{membership.plan_name ?? "—"}</span>
          </div>
          <div className="mt-1 flex justify-between">
            <span className="text-muted">Vencimiento</span>
            <span className="font-semibold text-ink">{membership.expires_on ?? "—"}</span>
          </div>
          <div className="mt-1 flex justify-between">
            <span className="text-muted">Estado</span>
            <span
              className={`font-semibold ${
                membership.status === "activa" && payOk ? "text-neon" : "text-ember"
              }`}
            >
              {membership.status === "activa" && payOk ? "Activa" : "Inactiva / pendiente"}
            </span>
          </div>
        </div>
      )}

      {(logs.length > 0 || pays.length > 0) && (
        <div className="mx-4 mt-4 rounded-xl border border-edge bg-card p-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-ink">Historial (accesos y pagos)</p>
            <button
              onClick={() => exportMemberCsv(displayName, logs, pays)}
              className="flex items-center gap-1 text-xs font-medium text-neon"
            >
              <Download className="h-3.5 w-3.5" /> Exportar CSV
            </button>
          </div>
          {logs.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-semibold text-muted">Últimos accesos</p>
              <div className="mt-2 space-y-1.5">
                {logs.map((l) => (
                  <div key={l.id} className="flex items-center justify-between rounded-lg border border-edge bg-elevated p-2">
                    <span className="flex items-center gap-2 text-sm text-ink">
                      {l.type === "ingreso" ? (
                        <DoorOpen className="h-3.5 w-3.5 text-neon" />
                      ) : (
                        <DoorClosed className="h-3.5 w-3.5 text-ember" />
                      )}
                      {l.type === "ingreso" ? "Entrada" : "Salida"}
                    </span>
                    <span className="text-[11px] text-muted">
                      {new Date(l.created_at).toLocaleString("es-AR", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {pays.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-semibold text-muted">Pagos registrados</p>
              <div className="mt-2 space-y-1.5">
                {pays.map((p) => (
                  <div key={p.id} className="flex items-center justify-between rounded-lg border border-edge bg-elevated p-2">
                    <span className="min-w-0 truncate text-sm text-ink">{p.note ?? "Cuota"}</span>
                    <span className="ml-2 flex shrink-0 items-center gap-2">
                      <span className="text-[11px] text-muted">
                        {new Date(p.paid_at).toLocaleString("es-AR", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "2-digit",
                        })}
                      </span>
                      <span className="text-sm font-bold text-neon">${p.amount ?? 0}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="mt-5 space-y-4 px-4">
        <Field icon={<Phone className="h-3.5 w-3.5" />} label="Teléfono" value={form.phone} onChange={(v) => set("phone", v)} placeholder="+54 11 5555 5555" type="tel" />
        <div className="grid grid-cols-2 gap-3">
          <Field icon={<MapPin className="h-3.5 w-3.5" />} label="Dirección" value={form.address} onChange={(v) => set("address", v)} placeholder="Calle y número" />
          <Field icon={<MapPin className="h-3.5 w-3.5" />} label="Ciudad" value={form.city} onChange={(v) => set("city", v)} placeholder="Ciudad" />
        </div>
        <Field icon={<Shield className="h-3.5 w-3.5" />} label="Obra social" value={form.obra_social} onChange={(v) => set("obra_social", v)} placeholder="Ej: OSDE 210, o 'no tiene'" />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Field icon={<Cake className="h-3.5 w-3.5" />} label="Fecha de nacimiento" value={form.birth_date} onChange={(v) => set("birth_date", v)} type="date" />
            {age != null && <p className="mt-1 text-[10px] text-muted">{age} años</p>}
          </div>
          <Field icon={<IdCard className="h-3.5 w-3.5" />} label="DNI" value={form.dni} onChange={(v) => set("dni", v)} placeholder="DNI/CUIL" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field icon={<Siren className="h-3.5 w-3.5" />} label="Contacto de emergencia" value={form.emergency_name} onChange={(v) => set("emergency_name", v)} placeholder="Nombre" />
          <Field icon={<Siren className="h-3.5 w-3.5" />} label="Tel. emergencia" value={form.emergency_phone} onChange={(v) => set("emergency_phone", v)} placeholder="+54 9 11..." type="tel" />
        </div>
        <Field icon={<StickyNote className="h-3.5 w-3.5" />} label="Notas / observaciones" value={form.notes} onChange={(v) => set("notes", v)} textarea placeholder="Objetivos, lesiones, restricciones médicas…" />

        <button
          onClick={onSave}
          disabled={saving}
          className="mb-8 flex w-full items-center justify-center gap-2 rounded-xl bg-neon py-3 font-semibold text-bg shadow-neon transition active:scale-[0.98] disabled:opacity-60"
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Guardando…
            </>
          ) : saved ? (
            <>
              <Save className="h-4 w-4" /> Guardado
            </>
          ) : (
            <>
              <Save className="h-4 w-4" /> Guardar datos
            </>
          )}
        </button>
      </div>
    </main>
  );
}
