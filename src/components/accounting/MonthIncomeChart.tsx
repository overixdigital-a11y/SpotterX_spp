"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatMoney } from "@/lib/memberships";

const tooltipStyle = {
  backgroundColor: "#161b22",
  border: "1px solid #1e2530",
  borderRadius: 8,
  fontSize: 12,
};
const labelStyle = { color: "#9ca3af" };

export interface MonthBar {
  mes: string;
  label: string;
  total: number;
  cantidad: number;
  selected: boolean;
}

/**
 * Ingresos de los ultimos 6 meses. Se monta con next/dynamic (ssr:false) desde
 * las paginas, mismo patron que HistoryCharts (Lote 32), para que recharts no
 * entre en el bundle inicial de /gimnasio/contabilidad ni de /entrenamiento/cuotas.
 *
 * La barra del mes seleccionado va en neon y el resto en un tono apagado, para
 * ver de un vistazo donde estas parado.
 */
export function MonthIncomeChart({ data }: { data: MonthBar[] }) {
  const empty = data.every((d) => d.total === 0);
  if (empty) {
    return (
      <p className="py-8 text-center text-xs text-muted">
        Todavia no hay cobros registrados para mostrar.
      </p>
    );
  }
  return (
    <div className="h-44">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e2530" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: "#6b7280", fontSize: 10 }} />
          <YAxis
            tick={{ fill: "#6b7280", fontSize: 10 }}
            width={52}
            tickFormatter={(v) => `$${Number(v).toLocaleString("es-AR")}`}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            labelStyle={labelStyle}
            formatter={(value, _name, item) => [
              formatMoney(Number(value ?? 0)),
              `${(item?.payload as MonthBar | undefined)?.cantidad ?? 0} cuotas`,
            ]}
          />
          <Bar dataKey="total" radius={[4, 4, 0, 0]}>
            {data.map((d) => (
              <Cell key={d.mes} fill={d.selected ? "#00f2fe" : "#2a3f47"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
