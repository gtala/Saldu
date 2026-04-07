"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const sample = [
  { mes: "Ene", total: 1200000 },
  { mes: "Feb", total: 980000 },
  { mes: "Mar", total: 1450000 },
  { mes: "Abr", total: 1100000 },
];

/** Ejemplo liviano de Recharts (datos de muestra). */
export function ChartDemo() {
  return (
    <>
    <div className="text-muted-foreground mb-2 text-xs">
      Gráfico de ejemplo (Recharts) — después conectamos datos reales desde la API.
    </div>
    <div className="bg-card text-card-foreground w-full min-h-56 rounded-xl border p-2 md:min-h-64">
      <ResponsiveContainer width="100%" height={240} minHeight={200}>
        <LineChart data={sample} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
          <XAxis dataKey="mes" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
          <YAxis
            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            tickFormatter={(v) => `${Math.round(v / 1000)}k`}
          />
          <Tooltip
            contentStyle={{
              background: "var(--popover)",
              border: "1px solid var(--border)",
              borderRadius: "8px",
            }}
            labelStyle={{ color: "var(--foreground)" }}
          />
          <Line
            type="monotone"
            dataKey="total"
            stroke="var(--primary)"
            strokeWidth={2}
            dot={{ r: 3, fill: "var(--primary)" }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
    </>
  );
}
