import { AlertTriangle } from "lucide-react";
import { formatMoney } from "@/lib/memberships";
import { monthLabel, monthStart, type CaidosBucket } from "@/lib/accounting";

/**
 * Lote 39b - "Caidos por mes".
 *
 * La tarjeta de "Vencidos" dice cuanto te deben HOY, toda junta y sin fecha. Esa
 * plata cambia de significado segun cuando se vencio: lo de hace 3 dias se
 * recupera, lo de hace 3 meses ya se dio por perdido. Este bloque agrupa los
 * mismos socios por mes de vencimiento para que se vea la tendencia.
 *
 * Es a proposito una lista y no un grafico: hoy hay muy pocos meses con datos y
 * un grafico de barras con 1 o 2 barras no dice nada (mismo criterio que el de no
 * agregar "perdida" como porcentaje: la barra de cumplimiento ya cubre el hueco
 * dentro del mes).
 */
export function CaidosByMonth({
  buckets,
  today,
}: {
  buckets: CaidosBucket[];
  today: string; // YYYY-MM-DD
}) {
  if (buckets.length === 0) return null;

  // Antiguedad de cada mes, para poder marcar el gris hace mucho.
  const ageOf = (mes: string) => {
    const a = new Date(`${monthStart(mes)}T00:00:00`);
    const b = new Date(`${today}T00:00:00`);
    return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24 * 30.44));
  };

  return (
    <div>
      <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">
        Se quedaron sin renovar
      </p>
      <div className="space-y-1.5">
        {buckets.map((b) => {
          const months = ageOf(b.mes);
          const viejo = months >= 3;
          return (
            <div
              key={b.mes}
              className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2 ${
                viejo
                  ? "border-edge bg-elevated"
                  : "border-ember/30 bg-ember/5"
              }`}
            >
              <div className="flex min-w-0 items-center gap-2">
                <AlertTriangle
                  className={`h-3.5 w-3.5 shrink-0 ${viejo ? "text-muted" : "text-ember"}`}
                />
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-ink">
                    {b.cantidad} {b.cantidad === 1 ? "socio se quedó" : "socios se quedaron"}{" "}
                    en {monthLabel(b.mes)}
                  </p>
                  <p className="text-[11px] text-muted">
                    {viejo
                      ? `hace ${months} meses · probablemente perdido`
                      : months === 0
                        ? "este mes · recuperable"
                        : `hace ${months} ${months === 1 ? "mes" : "meses"} · recuperable`}
                  </p>
                </div>
              </div>
              <span className="shrink-0 text-sm font-black text-ember">
                {formatMoney(b.total)}
              </span>
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-[11px] text-muted">
        Los que apretaron Cancelar no aparecen acá: esos ya están contados como bajas.
      </p>
    </div>
  );
}
