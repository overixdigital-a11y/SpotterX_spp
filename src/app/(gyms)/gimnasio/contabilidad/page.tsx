"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  ClipboardList,
  Loader2,
  Users,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuthState } from "@/lib/auth-context";
import { useToast } from "@/components/core/ToastProvider";
import { AccountingSummary } from "@/components/accounting/AccountingSummary";
import { formatMoney } from "@/lib/memberships";
import {
  currentMonth,
  fillSeries,
  monthStart,
  normalizeAccounting,
  paymentsCsv,
  shiftMonth,
  type AccountingData,
} from "@/lib/accounting";
import { todayLocal } from "@/lib/format";

// recharts pesa (~100 KB): lazy para que no entre en el bundle inicial (patron Lote 32).
const MonthIncomeChart = dynamic(
  () => import("@/components/accounting/MonthIncomeChart").then((m) => m.MonthIncomeChart),
  { ssr: false }
);

export default function GymContabilidadPage() {
  const { userId } = useAuthState();
  const toast = useToast();

  const [gymId, setGymId] = useState<string | null>(null);
  const [month, setMonth] = useState<string>(() => currentMonth());
  const [data, setData] = useState<AccountingData | null>(null);
  const [names, setNames] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    const supabase = createClient();

    // El gym es del dueno (mismo criterio que /gimnasio/cobros).
    let gym = gymId;
    if (!gym) {
      const { data: g } = await supabase.from("gyms").select("id").eq("owner_id", userId).maybeSingle();
      if (!g) {
        setLoading(false);
        return;
      }
      gym = g.id as string;
      setGymId(gym);
    }

    const { data: raw, error } = await supabase.rpc("gym_accounting_summary", {
      p_gym: gym,
      p_month: month,
    });

    if (error) {
      // Solo "no existe la funcion" significa que falta la 00046. CUALQUIER otro
      // error (permisos, SQL interno, guard de ownership) se muestra tal cual:
      // antes el chequeo era "el mensaje menciona el nombre de la funcion?" y
      // eso disfrazaba un permission denied como "falta correr la migracion".
      const missingRpc =
        error.message.includes("Could not find the function") ||
        (error.message.includes("does not exist") && error.message.includes("schema cache"));
      if (missingRpc) {
        setMissing(true);
      } else {
        toast(`No se pudo cargar la contabilidad: ${error.message}`, "error");
      }
      setData(null);
      setLoading(false);
      return;
    }

    setMissing(false);
    const acc = normalizeAccounting(raw);
    setData(acc);

    // Nombres de los socios del movimiento del mes (consulta separada + Map:
    // nunca embed a profiles, leccion de /gimnasio/miembros).
    const ids = [...new Set(acc.detalle.map((p) => p.socio))];
    if (ids.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name, username")
        .in("id", ids);
      setNames(new Map((profs ?? []).map((p) => [p.id, p.full_name || p.username || "Socio"])));
    } else {
      setNames(new Map());
    }

    setLoading(false);
  }, [userId, gymId, month, toast]);

  // Patron anti-lint del repo: setState nunca sincrono en el cuerpo del efecto.
  useEffect(() => {
    let alive = true;
    (async () => {
      await load();
      if (!alive) setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [load]);

  const exportCsv = () => {
    if (!data || data.detalle.length === 0) {
      toast("No hay cobros en este mes para exportar", "info");
      return;
    }
    const csv = paymentsCsv(data.detalle, (id) => names.get(id) ?? "Socio");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `contabilidad-${month}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast("Movimiento exportado", "success");
  };

  if (loading) {
    return (
      <main className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-neon" />
      </main>
    );
  }

  if (!gymId) {
    return (
      <main className="mx-auto max-w-md px-4 pt-10 text-center">
        <p className="text-sm text-muted">Primero creá tu gimnasio desde el panel.</p>
      </main>
    );
  }

  if (missing) {
    return (
      <main className="mx-auto max-w-md px-4 pt-10 text-center">
        <ClipboardList className="mx-auto mb-3 h-8 w-8 text-muted" />
        <h1 className="text-lg font-bold text-ink">Contabilidad</h1>
        <p className="mt-2 text-sm text-muted">
          Falta correr la migracion <span className="font-semibold text-neon">00046</span> para ver la
          contabilidad.
        </p>
        <Link
          href="/gimnasio/cobros"
          className="mt-4 inline-block rounded-lg border border-edge px-4 py-2 text-sm text-ink"
        >
          Volver a Cobros
        </Link>
      </main>
    );
  }

  if (!data) return null;

  const now = currentMonth();
  const retention = data.altas + data.bajas > 0 ? Math.round((data.bajas / data.altas) * 100) : null;

  return (
    <main className="mx-auto max-w-xl px-4 pt-5 md:max-w-2xl">
      <div className="mb-4">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-ink">
          <ClipboardList className="h-6 w-6 text-neon" /> Contabilidad
        </h1>
        <p className="mt-0.5 text-sm text-muted">
          Cuanto entro cada mes, cuanto falta y quien debe. Cobro manual: la plata se mueve fuera de
          la app.
        </p>
      </div>

      {/* Tablero compartido con el del profesor (mismo componente, mismos numeros) */}
      <AccountingSummary
        data={data}
        month={month}
        isCurrentMonth={month >= now}
        canGoNext={month < monthStart(shiftMonth(now, 1))}
        today={todayLocal()}
        onPrev={() => setMonth((m) => monthStart(shiftMonth(m, -1)))}
        onNext={() => setMonth((m) => monthStart(shiftMonth(m, 1)))}
        onExport={exportCsv}
        chart={<MonthIncomeChart data={fillSeries(data.serie, month)} />}
      />

      {/* ---- Extras SOLO del gym (socios, no alumnos) ---- */}

      <div className="mt-5">
        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">
          Plantel del mes
        </p>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-2xl border border-edge bg-card p-3">
            <p className="flex items-center gap-1 text-[11px] font-semibold text-muted">
              <ArrowUpRight className="h-3 w-3 text-neon" /> Altas
            </p>
            <p className="text-lg font-black text-neon">{data.altas}</p>
          </div>
          <div className="rounded-2xl border border-edge bg-card p-3">
            <p className="flex items-center gap-1 text-[11px] font-semibold text-muted">
              <ArrowDownRight className="h-3 w-3 text-ember" /> Bajas
            </p>
            <p className="text-lg font-black text-ember">{data.bajas}</p>
          </div>
          <div className="rounded-2xl border border-edge bg-card p-3">
            <p className="flex items-center gap-1 text-[11px] font-semibold text-muted">
              <Users className="h-3 w-3 text-muted" /> Activos
            </p>
            <p className="text-lg font-black text-ink">{data.activos}</p>
          </div>
          {/* Los que dejaron vencer la cuota sin apretar Cancelar. Antes NO
              aparecian en ninguna parte y por eso la retencia de arriba puede
              decir 100% mientras el grupo se achica solo. */}
          <div className="rounded-2xl border border-edge bg-card p-3">
            <p className="flex items-center gap-1 text-[11px] font-semibold text-muted">
              <AlertTriangle className="h-3 w-3 text-muted" /> Se quedaron
            </p>
            <p className="text-lg font-black text-ink">{data.caidos_cantidad}</p>
          </div>
        </div>
        {data.caidos_cantidad > 0 && (
          <p className="mt-2 text-[11px] text-muted">
            Sin contar en &quot;Bajas&quot;: {data.caidos_cantidad}{" "}
            {data.caidos_cantidad === 1 ? "socio dejó vencer la cuota" : "socios dejaron vencer la cuota"}{" "}
            sin cancelar ({formatMoney(data.caidos_total)}).{" "}
            {retention !== null && data.altas > 0
              ? "Con ellos, la retención real es menor."
              : "Sumalos a las bajas para medir la retención real."}
          </p>
        )}
        {retention !== null && data.altas > 0 && (
          <p className="mt-2 text-[11px] text-muted">
            Se fueron {retention} de cada 100 que entraron. {data.altas - data.bajas >= 0 ? "El grupo crece" : "Cuidado: el grupo achica"}
            {" "}({data.altas - data.bajas >= 0 ? "+" : ""}
            {data.altas - data.bajas} neto).
          </p>
        )}
      </div>

      {/* Alertas accionables */}
      {(data.pv7_cantidad > 0 || data.d90 > 0 || (data.promos_por_vencer ?? 0) > 0) && (
        <div className="mt-5 space-y-2">
          <p className="mb-1 text-xs font-bold uppercase tracking-wider text-muted">
            Para revisar hoy
          </p>
          {data.pv7_cantidad > 0 && (
            <AlertLine
              tone="ember"
              text={`${data.pv7_cantidad} ${data.pv7_cantidad === 1 ? "socio vence" : "socios vencen"} en los proximos 7 dias: ${formatMoney(data.pv7)}`}
            />
          )}
          {data.d90 > 0 && (
            <AlertLine
              tone="ember"
              text={`${data.d90} ${data.d90 === 1 ? "socio debe" : "socios deben"} hace mas de 30 dias`}
            />
          )}
          {(data.promos_por_vencer ?? 0) > 0 && (
            <AlertLine
              tone="neon"
              text={`${data.promos_por_vencer} ${data.promos_por_vencer === 1 ? "socio promo" : "socios promo"} se les termina el beneficio esta semana`}
            />
          )}
        </div>
      )}

      <p className="mt-5 text-center text-[11px] text-muted">
        Movimientos de {month.slice(0, 7)} · corte al {todayLocal()}
      </p>
    </main>
  );
}

function AlertLine({ tone, text }: { tone: "ember" | "neon"; text: string }) {
  return (
    <p
      className={`flex items-start gap-2 rounded-xl border px-3 py-2.5 text-xs font-medium ${
        tone === "ember"
          ? "border-ember/30 bg-ember/5 text-ember"
          : "border-neon/30 bg-neon/5 text-neon"
      }`}
    >
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>{text}</span>
    </p>
  );
}
