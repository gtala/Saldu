"use client";

import {
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { MonthPayload } from "@/lib/gastos-types";
import { formatMoneyArs } from "@/lib/gastos-format";

type Props = {
  month: MonthPayload;
  currency: "ARS" | "USD";
  venta: number | null;
};

export function ExpensesDailyLineChart({ month, currency, venta }: Props) {
  const series = month.dailyGastos ?? [];
  const avgArs = month.avgDailyGastoArs ?? 0;
  const dim = month.daysInMonth ?? series.length;

  if (!series.length || dim === 0) return null;

  const toDisplayArs = (ars: number) => {
    if (currency === "USD" && venta != null && venta > 0) return ars / venta;
    return ars;
  };

  const data = series.map((p) => ({
    day: p.day,
    montoDisplay: toDisplayArs(p.totalArs),
    count: p.count,
  }));

  const avgDisplay = toDisplayArs(avgArs);

  const tickMoney = (v: number) => {
    const ars =
      currency === "USD" && venta != null && venta > 0 ? v * venta : v;
    const s = formatMoneyArs(ars, currency, venta);
    return s.length > 12 ? s.replace(/\s/g, "").slice(0, 10) + "…" : s;
  };

  return (
    <section
      className="border-border bg-card text-card-foreground rounded-xl border p-4 shadow-sm"
      aria-label="Gastos por día del mes"
    >
      <h3 className="text-foreground mb-1 text-sm font-semibold tracking-tight">
        Gastos por día
      </h3>
      <p className="text-muted-foreground mb-4 text-xs">
        Línea principal: total gastado ese día. Línea fina: cantidad de movimientos.
        Línea punteada: promedio de gasto por día (total del mes ÷ {dim} días).
      </p>
      <div className="text-muted-foreground mb-2 text-xs">
        Promedio:{" "}
        <span className="text-foreground font-medium tabular-nums">
          {formatMoneyArs(avgArs, currency, venta)}
        </span>{" "}
        / día
      </div>
      <div className="h-[260px] w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={data}
            margin={{ top: 8, right: 4, left: 0, bottom: 0 }}
          >
            <CartesianGrid
              stroke="hsl(var(--border))"
              strokeDasharray="3 3"
              vertical={false}
            />
            <XAxis
              dataKey="day"
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              tickLine={false}
              axisLine={{ stroke: "hsl(var(--border))" }}
              label={{
                value: "Día del mes",
                position: "insideBottom",
                offset: -2,
                fontSize: 10,
                fill: "hsl(var(--muted-foreground))",
              }}
            />
            <YAxis
              yAxisId="money"
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              tickLine={false}
              axisLine={{ stroke: "hsl(var(--border))" }}
              tickFormatter={tickMoney}
              width={56}
            />
            <YAxis
              yAxisId="count"
              orientation="right"
              allowDecimals={false}
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              tickLine={false}
              axisLine={{ stroke: "hsl(var(--border))" }}
              width={36}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const row = payload[0].payload as {
                  montoDisplay: number;
                  count: number;
                };
                const ars =
                  currency === "USD" && venta != null && venta > 0
                    ? row.montoDisplay * venta
                    : row.montoDisplay;
                return (
                  <div className="border-border bg-popover text-popover-foreground rounded-md border px-2 py-1.5 text-xs shadow-md">
                    <div className="font-medium">Día {label}</div>
                    <div className="tabular-nums">
                      {formatMoneyArs(ars, currency, venta)}
                    </div>
                    <div className="text-muted-foreground mt-0.5">
                      {row.count} movimiento{row.count === 1 ? "" : "s"}
                    </div>
                  </div>
                );
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
              formatter={(value) => (
                <span className="text-muted-foreground">{value}</span>
              )}
            />
            <ReferenceLine
              yAxisId="money"
              y={avgDisplay}
              stroke="hsl(var(--muted-foreground))"
              strokeDasharray="5 5"
              strokeWidth={1.5}
              label={{
                value: "Promedio $/día",
                position: "right",
                fill: "hsl(var(--muted-foreground))",
                fontSize: 10,
              }}
            />
            <Line
              yAxisId="money"
              type="monotone"
              dataKey="montoDisplay"
              name="Gasto del día"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              dot={{ r: 2, fill: "hsl(var(--primary))" }}
              activeDot={{ r: 4 }}
            />
            <Line
              yAxisId="count"
              type="monotone"
              dataKey="count"
              name="Cantidad"
              stroke="hsl(var(--muted-foreground))"
              strokeWidth={1.5}
              dot={{ r: 1.5 }}
              activeDot={{ r: 3 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
