"use client";

import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight, Download, TrendingDown, TrendingUp } from "lucide-react";
import { formatMoney } from "@/lib/memberships";
import { compliancePct, formatSigned, monthLabel, pctChange } from "@/lib/accounting";
import type { AccountingData } from "@/lib/accounting";

interface Props {
  data: AccountingData;
  /** "YYYY-MM-01" del mes que se esta mirando. */
  month: string;
  /** No se puede avanzar mas alla del mes actual. */
  isCurrentMonth: boolean;
  /** Permite avanzar mas alla del mes actual (ver `canGoNext` en las paginas). */
  canGoNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  onExport?: () => void;
  /** Se inyecta lazy desde la pagina (recharts pesa; patron Lote 32). */
  chart?: ReactNode;
}

/**
 * Lote 39 - tablero de contabilidad de cuotas.
 *
 * UN solo componente para gym y profesor: recibe los numeros ya calculados (por
 * las RPCs de la 00046, que devuelven el mismo shape) y solo los dibuja. Lo
 * unico que cambia entre los dos son los datos y el chart, asi que no hay
 * banderas `showX` que se pudran ir desincronizando.
 *
 * Las extras que son exclusivas del gym (altas, bajas, retencion, promos que
 * vencen) NO van aca: viven en la pagina /gimnasio/contabilidad.
 */
export function AccountingSummary({
  data,
  month,
  isCurrentMonth,
  canGoNext,
  onPrev,
  onNext,
  onExport,
  chart,
}: Props) {
  const change = pctChange(data.total, data.prev_total);
  const compliance = compliancePct(data.total, data.esperado);
  const ticket = data.cantidad ? data.total / data.cantidad : 0;
  const methods = Object.entries(data.por_metodo).filter(([, v]) => v > 0);

  return (
    <div className="space-y-4">
      {/* Navegacion de mes */}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onPrev}
          aria-label="Mes anterior"
          className="rounded-lg border border-edge bg-elevated p-2 text-muted transition hover:border-neon/40 hover:text-neon"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="text-center">
          <p className="text-sm font-bold text-ink">{monthLabel(month)}</p>
          {!isCurrentMonth && (
            <button
              type="button"
              onClick={onNext}
              className="text-[11px] font-semibold text-neon hover:underline"
            >
              Volver a este mes
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={onNext}
          disabled={!canGoNext}
          aria-label="Mes siguiente"
          className="rounded-lg border border-edge bg-elevated p-2 text-muted transition hover:border-neon/40 hover:text-neon disabled:opacity-30"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Cobrado + comparacion */}
      <div className="rounded-2xl border border-neon/30 bg-neon/5 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-muted">Cobrado</p>
            <p className="text-3xl font-black text-neon">{formatMoney(data.total)}</p>
            <p className="mt-0.5 text-xs text-muted">
              {data.cantidad} {data.cantidad === 1 ? "cuota cobrada" : "cuotas cobradas"}
            </p>
          </div>
          {change !== null && (
            <span
              className={`flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-bold ${
                change >= 0
                  ? "border-neon/40 bg-neon/10 text-neon"
                  : "border-ember/40 bg-ember/10 text-ember"
              }`}
            >
              {change >= 0 ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              {formatSigned(change)}
            </span>
          )}
        </div>
        {data.prev_total > 0 && (
          <p className="mt-2 text-[11px] text-muted">
            Mes anterior: {formatMoney(data.prev_total)} ({data.prev_cantidad} cuotas)
          </p>
        )}

        {/* Cumplimiento: cuanto de lo que vencia este mes se facturo */}
        {data.esperado > 0 && (
          <div className="mt-3">
            <div className="flex items-baseline justify-between text-[11px]">
              <span className="text-muted">Esperado del mes</span>
              <span className="font-semibold text-ink">
                {formatMoney(data.total)} / {formatMoney(data.esperado)}
                {compliance !== null && ` · ${Math.round(compliance)}%`}
              </span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-elevated">
              <div
                className={`h-full rounded-full ${
                  compliance !== null && compliance >= 100 ? "bg-neon" : "bg-ember"
                }`}
                style={{ width: `${Math.min(100, Math.max(compliance ?? 0, 2))}%` }}
              />
            </div>
            <p className="mt-1 text-[11px] text-muted">
              {data.esperado_cantidad} {data.esperado_cantidad === 1 ? "membresia vence" : "membresias vencen"}{" "}
              este mes
            </p>
          </div>
        )}
      </div>

      {/* Activos SIEMPRE visible (es el unico numero util cuando todavia no hay
          pagos registrados; antes estaba escondido detras de `cantidad > 0` y un
          gym sin cobrosEDIA no muestra ni cuantos socios tiene). El ticket
          promedio si depende de que haya pagos. */}
      <div className={`grid gap-3 ${data.cantidad > 0 ? "grid-cols-2" : "grid-cols-1"}`}>
        <div className="rounded-2xl border border-edge bg-card p-3">
          <p className="text-[11px] font-semibold text-muted">Activos</p>
          <p className="text-lg font-black text-ink">{data.activos}</p>
        </div>
        {data.cantidad > 0 && (
          <div className="rounded-2xl border border-edge bg-card p-3">
            <p className="text-[11px] font-semibold text-muted">Ticket promedio</p>
            <p className="text-lg font-black text-ink">{formatMoney(Math.round(ticket))}</p>
          </div>
        )}
      </div>

      {/* Proximos vencimientos: 7 / 15 / 30 dias */}
      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">
          Proximos vencimientos
        </p>
        <div className="grid grid-cols-3 gap-2">
          {[
            { dias: 7, count: data.pv7_cantidad, total: data.pv7 },
            { dias: 15, count: data.pv15_cantidad, total: data.pv15 },
            { dias: 30, count: data.pv30_cantidad, total: data.pv30 },
          ].map((w) => (
            <div key={w.dias} className="rounded-2xl border border-edge bg-card p-3">
              <p className="text-[11px] font-semibold text-muted">{w.dias} días</p>
              <p className="text-base font-black text-ink">{w.count}</p>
              <p className="truncate text-[11px] text-ember">{formatMoney(w.total)}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Deuda + antiguedad */}
      <div className="rounded-2xl border border-ember/30 bg-ember/5 p-4">
        <div className="flex items-baseline justify-between">
          <p className="text-xs font-semibold text-muted">Vencidos</p>
          <p className="text-2xl font-black text-ember">{formatMoney(data.vencidos)}</p>
        </div>
        <p className="mt-0.5 text-xs text-muted">
          {data.vencidos_cantidad} {data.vencidos_cantidad === 1 ? "persona" : "personas"}
        </p>
        {(data.d7 > 0 || data.d30 > 0 || data.d90 > 0) && (
          <div className="mt-3 grid grid-cols-3 gap-2 border-t border-ember/20 pt-3 text-center">
            <div>
              <p className="text-sm font-black text-ink">{data.d7}</p>
              <p className="text-[10px] text-muted">1 a 7 días</p>
            </div>
            <div>
              <p className="text-sm font-black text-ink">{data.d30}</p>
              <p className="text-[10px] text-muted">8 a 30 días</p>
            </div>
            <div>
              <p className="text-sm font-black text-ink">{data.d90}</p>
              <p className="text-[10px] text-muted">más de 30</p>
            </div>
          </div>
        )}
      </div>

      {/* Metodos de pago */}
      {methods.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">
            Formas de pago
          </p>
          <div className="flex flex-wrap gap-2">
            {methods.map(([m, v]) => (
              <span
                key={m}
                className="rounded-full border border-edge bg-card px-3 py-1.5 text-xs font-semibold text-ink"
              >
                {m} · {formatMoney(v)}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Grafico de 6 meses */}
      {chart && (
        <div>
          <p className="mb-1 text-xs font-bold uppercase tracking-wider text-muted">
            Ingresos por mes
          </p>
          {chart}
        </div>
      )}

      {onExport && (
        <button
          type="button"
          onClick={onExport}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-edge bg-card py-2.5 text-xs font-semibold text-ink transition hover:border-neon/40 hover:text-neon"
        >
          <Download className="h-3.5 w-3.5" />
          Exportar movimiento del mes
        </button>
      )}
    </div>
  );
}
