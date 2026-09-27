import { todayLocal } from "@/lib/format";

/**
 * Lote 39 - contabilidad de cuotas.
 *
 * El shape de AccountingData tiene que coincidir EXACTAMENTE con el jsonb que
 * devuelven las dos RPCs de la migracion 00046:
 *   - public.gym_accounting_summary(p_gym uuid, p_month date)
 *   - public.trainer_accounting_summary(p_month date)
 * Si se agrega una metrica, se agrega en las dos RPCs (ver el bloque "-- SHAPE"
 * del comentario de la migracion) y aca en la interface.
 */

export interface PaymentDetail {
  id: string;
  monto: number | null;
  metodo: string | null;
  nota: string | null;
  fecha: string; // YYYY-MM-DD
  socio: string; // user_id
}

export interface MonthPoint {
  mes: string; // YYYY-MM
  total: number;
  cantidad: number;
}

/** Un mes con socios que dejaron vencer la cuota sin renovar. */
export interface CaidosBucket {
  mes: string; // YYYY-MM
  cantidad: number;
  total: number;
}

export interface AccountingData {
  // Caja del mes
  cantidad: number;
  total: number;
  prev_cantidad: number;
  prev_total: number;
  // Caja acumulada (historia del gym/profe)
  total_all: number;
  total_year: number;
  // Lo que deberia haber entrado (membresias que vencen este mes)
  esperado_cantidad: number;
  esperado: number;
  // Proximos vencimientos
  pv7_cantidad: number;
  pv7: number;
  pv15_cantidad: number;
  pv15: number;
  pv30_cantidad: number;
  pv30: number;
  // Deuda
  vencidos_cantidad: number;
  vencidos: number;
  d7: number;
  d30: number;
  d90: number;
  // Los mismos vencidos, agrupados por mes de vencimiento: plata recuperable
  // (vencieron hace dias) vs plata perdida (hace meses).
  caidos: CaidosBucket[];
  caidos_cantidad: number;
  caidos_total: number;
  // extras
  por_metodo: Record<string, number>;
  serie: MonthPoint[];
  detalle: PaymentDetail[];
  // Altas/bajas/activos (los calcula cada RPC segun su lado)
  activos: number;
  altas: number;
  bajas: number;
  // Solo el gym lo devuelve; el profe no lo manda y queda undefined
  promos_por_vencer?: number;
}

const ZERO: AccountingData = {
  cantidad: 0,
  total: 0,
  prev_cantidad: 0,
  prev_total: 0,
  total_all: 0,
  total_year: 0,
  esperado_cantidad: 0,
  esperado: 0,
  pv7_cantidad: 0,
  pv7: 0,
  pv15_cantidad: 0,
  pv15: 0,
  pv30_cantidad: 0,
  pv30: 0,
  vencidos_cantidad: 0,
  vencidos: 0,
  d7: 0,
  d30: 0,
  d90: 0,
  caidos: [],
  caidos_cantidad: 0,
  caidos_total: 0,
  por_metodo: {},
  serie: [],
  detalle: [],
  activos: 0,
  altas: 0,
  bajas: 0,
};

/**
 * Normaliza lo que devuelve la RPC. Postgres devuelve `null` en los
 * `sum()` de tablas vacias y a veces omite claves, asi que se completa con
 * ceros para que el TypeScript no tenga que usar optionals en todos lados.
 */
export function normalizeAccounting(raw: unknown): AccountingData {
  if (!raw || typeof raw !== "object") return ZERO;
  const d = raw as Partial<AccountingData>;
  const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
  return {
    cantidad: n(d.cantidad),
    total: n(d.total),
    prev_cantidad: n(d.prev_cantidad),
    prev_total: n(d.prev_total),
    total_all: n(d.total_all),
    total_year: n(d.total_year),
    esperado_cantidad: n(d.esperado_cantidad),
    esperado: n(d.esperado),
    pv7_cantidad: n(d.pv7_cantidad),
    pv7: n(d.pv7),
    pv15_cantidad: n(d.pv15_cantidad),
    pv15: n(d.pv15),
    pv30_cantidad: n(d.pv30_cantidad),
    pv30: n(d.pv30),
    vencidos_cantidad: n(d.vencidos_cantidad),
    vencidos: n(d.vencidos),
    d7: n(d.d7),
    d30: n(d.d30),
    d90: n(d.d90),
    caidos: Array.isArray(d.caidos)
      ? d.caidos
          .filter((b): b is CaidosBucket => !!b && typeof b.mes === "string")
          .map((b) => ({ mes: b.mes, cantidad: n(b.cantidad), total: n(b.total) }))
          .sort((a, b) => a.mes.localeCompare(b.mes))
      : [],
    caidos_cantidad: n(d.caidos_cantidad),
    caidos_total: n(d.caidos_total),
    por_metodo: d.por_metodo && typeof d.por_metodo === "object" ? d.por_metodo : {},
    serie: Array.isArray(d.serie) ? d.serie : [],
    detalle: Array.isArray(d.detalle) ? d.detalle : [],
    activos: n(d.activos),
    altas: n(d.altas),
    bajas: n(d.bajas),
    ...(typeof d.promos_por_vencer === "number" ? { promos_por_vencer: d.promos_por_vencer } : {}),
  };
}

/** Primer dia del mes de una fecha "YYYY-MM-DD" o "YYYY-MM". */
export function monthStart(dateStr: string): string {
  return `${dateStr.slice(0, 7)}-01`;
}

/** Suma un mes a "YYYY-MM-DD" (o "YYYY-MM") y vuelve al dia 1. */
export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

const MONTH_LABELS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/** "septiembre 2026" */
export function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return `${MONTH_LABELS[m - 1] ?? ""} ${y}`;
}

/** "sep 26" para el eje del grafico. */
export function monthShort(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return `${(MONTH_LABELS[m - 1] ?? "").slice(0, 3)} ${String(y).slice(2)}`;
}

export function currentMonth(today = todayLocal()): string {
  return `${today.slice(0, 7)}-01`;
}

/** Variacion porcentual contra el mes anterior. null si no hay base de calculo. */
export function pctChange(current: number, previous: number): number | null {
  if (!previous) return null;
  return ((current - previous) / previous) * 100;
}

/** % de cumplimiento: cuanto de lo esperado se facturo. null si no hay esperado. */
export function compliancePct(cobrado: number, esperado: number): number | null {
  if (!esperado) return null;
  return (cobrado / esperado) * 100;
}

export function formatSigned(n: number): string {
  const r = Math.round(n * 10) / 10;
  return `${r > 0 ? "+" : ""}${r.toLocaleString("es-AR", { maximumFractionDigits: 1 })}%`;
}

/**
 * Completa los 6 meses de la serie con los meses sin cobros en 0, para que el
 * grafico no "salte" meses que el usuario todavia no vio. El ultimo mes de la
 * serie es el mes seleccionado.
 */
export function fillSeries(
  serie: MonthPoint[],
  selectedMonth: string,
  months = 6
): { mes: string; label: string; total: number; cantidad: number; selected: boolean }[] {
  const byMonth = new Map(serie.map((p) => [p.mes, p]));
  const out: { mes: string; label: string; total: number; cantidad: number; selected: boolean }[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const month = monthStart(shiftMonth(selectedMonth, -i));
    const key = month.slice(0, 7);
    const point = byMonth.get(key);
    out.push({
      mes: key,
      label: monthShort(month),
      total: point?.total ?? 0,
      cantidad: point?.cantidad ?? 0,
      selected: key === selectedMonth.slice(0, 7),
    });
  }
  return out;
}

/** CSV del movimiento del mes. Devuelve el texto ya con BOM y separador ';'. */
export function paymentsCsv(
  detalle: PaymentDetail[],
  nameOf: (userId: string) => string
): string {
  const head = "fecha;socio;monto;metodo;nota";
  const rows = detalle.map((p) =>
    [p.fecha, nameOf(p.socio), String(p.monto ?? 0), p.metodo ?? "manual", p.nota ?? ""]
      .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
      .join(";")
  );
  return `\uFEFF${[head, ...rows].join("\r\n")}`;
}
