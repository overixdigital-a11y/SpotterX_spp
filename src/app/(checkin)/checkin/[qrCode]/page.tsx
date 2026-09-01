"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, LogIn, DoorOpen, DoorClosed, Clock3, MapPin, Ban } from "lucide-react";
import dynamic from "next/dynamic";
import { createClient } from "@/lib/supabase/client";
import { useAuthState } from "@/lib/auth-context";
import type { AppRole } from "@/lib/types";

const GymMap = dynamic(() => import("@/components/gyms/GymMap"), { ssr: false });

interface Gym {
  id: string;
  name: string | null;
  address: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  qr_code: string;
}

interface MemberInfo {
  isMember: boolean;
  isStaff: boolean;
  role: AppRole;
  plan_name: string | null;
  status: string | null;
  pay_status: string | null;
  expires_on: string | null;
}

export default function CheckinPage({ params }: { params: { qrCode: string } }) {
  const { userId, profile, loading: authLoading } = useAuthState();
  const [gym, setGym] = useState<Gym | null>(null);
  const [member, setMember] = useState<MemberInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState(false);
  const [lastAction, setLastAction] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("gyms")
        .select("id, name, address, city, latitude, longitude, qr_code")
        .eq("qr_code", params.qrCode)
        .maybeSingle();
      if (!active) return;
      if (!data) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setGym(data as Gym);
      if (userId) {
        const g = data as Gym;
        const [staffRes, memRes] = await Promise.all([
          supabase.from("gym_staff").select("id, role").eq("gym_id", g.id).eq("user_id", userId).maybeSingle(),
          supabase
            .from("gym_memberships")
            .select("plan_name, status, pay_status, expires_on")
            .eq("gym_id", g.id)
            .eq("user_id", userId)
            .maybeSingle(),
        ]);
        if (active) {
          const isStaff = !!staffRes.data;
          const isMember = !!memRes.data;
          setMember({
            isMember,
            isStaff,
            role: (profile?.role as AppRole) ?? "alumno",
            plan_name: memRes.data?.plan_name ?? null,
            status: memRes.data?.status ?? null,
            pay_status: memRes.data?.pay_status ?? null,
            expires_on: memRes.data?.expires_on ?? null,
          });
        }
      }
      if (active) setLoading(false);
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.qrCode, userId]);

  const register = async (type: "ingreso" | "egreso") => {
    if (!gym) return;
    setBusy(true);
    setLastAction(null);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setBusy(false);
      return;
    }
    const { error } = await supabase
      .from("gym_access_logs")
      .insert({ gym_id: gym.id, user_id: user.id, type });
    setBusy(false);
    if (error) {
      setLastAction("error");
    } else {
      setLastAction(type === "ingreso" ? "in" : "out");
    }
  };

  if (loading || authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-neon" />
      </div>
    );
  }

  if (notFound || !gym) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <Ban className="h-10 w-10 text-ember" />
        <h1 className="mt-3 text-xl font-bold text-ink">QR inválido</h1>
        <p className="mt-1 text-sm text-muted">No encontramos este gimnasio.</p>
      </div>
    );
  }

  const expires = member?.expires_on ? new Date(member.expires_on) : null;
  const notExpired = !expires || expires >= new Date(new Date().toDateString());
  const paidOk = member?.pay_status === "pagado" || member?.pay_status === "promo";
  const isEnabled = !!member?.isMember && member?.status === "activa" && paidOk && notExpired;

  return (
    <div className="flex min-h-screen flex-col px-5 py-8">
      <div className="mx-auto w-full max-w-md">
        <div className="rounded-2xl border border-edge bg-card p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-neon">Control de acceso</p>
          <h1 className="mt-1 text-2xl font-bold text-ink">{gym.name ?? "Gimnasio"}</h1>
          {gym.address && (
            <p className="mt-1 flex items-center gap-1 text-sm text-muted">
              <MapPin className="h-3.5 w-3.5" /> {gym.address}
              {gym.city ? `, ${gym.city}` : ""}
            </p>
          )}

          {!userId ? (
            <div className="mt-5">
              <p className="text-sm text-muted">Iniciá sesión para registrarte en este gimnasio.</p>
              <Link
                href={`/login?next=${encodeURIComponent(`/checkin/${params.qrCode}`)}`}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-neon py-3 font-semibold text-bg shadow-neon"
              >
                <LogIn className="h-4 w-4" /> Ingresar
              </Link>
            </div>
          ) : (
            <div className="mt-5">
              <div className="rounded-xl border border-edge bg-elevated p-3">
                <p className="text-sm font-semibold text-ink">
                  {profile?.full_name ?? profile?.username ?? "Usuario"}
                </p>
                <p className="text-xs text-muted">@{profile?.username}</p>
                {member?.isStaff ? (
                  <span className="mt-1 inline-block rounded-full bg-ember/20 px-2 py-0.5 text-[10px] font-semibold text-ember">
                    Profesor del gimnasio
                  </span>
                ) : member?.isMember ? (
                  <div className="mt-1">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        isEnabled ? "bg-neon/20 text-neon" : "bg-ember/20 text-ember"
                      }`}
                    >
                      {member.pay_status === "promo" ? "Promo 🎁 (primer mes)" : isEnabled ? "Membresía activa" : "Sin membresía vigente"}
                    </span>
                    {member.plan_name && (
                      <p className="mt-1 text-xs text-muted">
                        {member.plan_name}
                        {member.expires_on ? ` · hasta ${member.expires_on}` : ""}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="mt-1 text-xs text-ember">No sos miembro de este gimnasio.</p>
                )}
              </div>

              {member?.isStaff ? (
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button
                    onClick={() => register("ingreso")}
                    disabled={busy}
                    className="flex items-center justify-center gap-2 rounded-xl bg-neon py-3 font-semibold text-bg shadow-neon disabled:opacity-60"
                  >
                    <DoorOpen className="h-4 w-4" /> Entrada
                  </button>
                  <button
                    onClick={() => register("egreso")}
                    disabled={busy}
                    className="flex items-center justify-center gap-2 rounded-xl border border-ember/40 bg-ember/10 py-3 font-semibold text-ember disabled:opacity-60"
                  >
                    <DoorClosed className="h-4 w-4" /> Salida
                  </button>
                </div>
              ) : member?.isMember && isEnabled ? (
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button
                    onClick={() => register("ingreso")}
                    disabled={busy}
                    className="flex items-center justify-center gap-2 rounded-xl bg-neon py-3 font-semibold text-bg shadow-neon disabled:opacity-60"
                  >
                    <DoorOpen className="h-4 w-4" /> Ingreso
                  </button>
                  <button
                    onClick={() => register("egreso")}
                    disabled={busy}
                    className="flex items-center justify-center gap-2 rounded-xl border border-edge bg-elevated py-3 font-semibold text-ink disabled:opacity-60"
                  >
                    <DoorClosed className="h-4 w-4" /> Egreso
                  </button>
                </div>
              ) : (
                <div className="mt-4 flex items-center justify-center gap-2 rounded-xl border border-dashed border-ember/40 bg-ember/10 p-3 text-sm text-ember">
                  <Ban className="h-4 w-4" /> No tenés acceso habilitado
                </div>
              )}

              {lastAction && (
                <p className="mt-3 text-center text-xs font-medium text-neon">
                  {lastAction === "in"
                    ? "Acceso registrado. ¡Bienvenido!"
                    : lastAction === "out"
                    ? "Salida registrada. ¡Hasta la próxima!"
                    : "No se pudo registrar el acceso."}
                </p>
              )}

              <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-[11px] text-muted">
                <Clock3 className="h-3 w-3" />{" "}
                {member?.isStaff ? "Contabilizás tus horas de trabajo." : "Tu acceso queda registrado."}
              </p>
            </div>
          )}
        </div>

        {gym.latitude && gym.longitude && (
          <div className="mt-4">
            <GymMap latitude={gym.latitude} longitude={gym.longitude} name={gym.name} />
          </div>
        )}
      </div>
    </div>
  );
}
