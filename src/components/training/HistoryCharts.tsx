"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

const tooltipStyle = {
  backgroundColor: "#161b22",
  border: "1px solid #1e2530",
  borderRadius: 8,
  fontSize: 12,
};
const labelStyle = { color: "#9ca3af" };

export function ProgressLine({ data }: { data: { date: string; value: number }[] }) {
  return (
    <div className="mt-4 h-48">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e2530" />
          <XAxis
            dataKey="date"
            tick={{ fill: "#6b7280", fontSize: 10 }}
            tickFormatter={(v) => v.slice(5)}
          />
          <YAxis tick={{ fill: "#6b7280", fontSize: 10 }} width={40} />
          <Tooltip contentStyle={tooltipStyle} labelStyle={labelStyle} />
          <Line
            type="monotone"
            dataKey="value"
            stroke="#00f2fe"
            strokeWidth={2}
            dot={{ fill: "#00f2fe", r: 3 }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function MonthlyBars({
  bars,
}: {
  bars: { mes: string; hechas: number; planificadas: number }[];
}) {
  return (
    <div className="mt-3 h-40">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={bars}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e2530" vertical={false} />
          <XAxis dataKey="mes" tick={{ fill: "#6b7280", fontSize: 10 }} />
          <YAxis tick={{ fill: "#6b7280", fontSize: 10 }} width={24} allowDecimals={false} />
          <Tooltip contentStyle={tooltipStyle} labelStyle={labelStyle} />
          <Bar dataKey="hechas" name="Hechas" fill="#00f2fe" radius={[4, 4, 0, 0]} />
          <Bar dataKey="planificadas" name="Planificadas" fill="#ff5e36" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}