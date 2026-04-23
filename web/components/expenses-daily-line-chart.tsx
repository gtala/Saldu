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

/** Ventana de media móvil en días (máx. 7; en meses cortos baja). */
function rollingWindowSize(daysInMonth: number) {
  if (daysInMonth <= 2) return 2;
  if (daysInMonth < 7) return Math.max(2, daysInMonth);
  return 7;
}

function addRollingTrend(
  points: Array<{ day: number; montoDisplay: number; count: number }>,
  windowSize: number
) {
  return points.map((p, i) => {
    const from = Math.max(0, i - windowSize + 1);
    const slice = points.slice(from, i + 1);
    const sum = slice.reduce((a, q) => a + q.montoDisplay, 0);
    return {
      ...p,
      tendenciaDisplay: sum / slice.length,
    };
  });
}

export function ExpensesDailyLineChart({ month, currency, venta }: Props) {
  const series = month.dailyGastos ?? [];
  const avgArs = month.avgDailyGastoArs ?? 0;
  const dim = month.daysInMonth ?? series.length;

  if (!series.length || dim === 0) return null;

  const toDisplayArs = (ars: number) => {
    if (currency === "USD" && venta != null && venta > 0) return ars / venta;
    return ars;
  };

  const base = series.map((p) => ({
    day: p.day,
    montoDisplay: toDisplayArs(p.totalArs),
    count: p.count,
  }));
  const win = rollingWindowSize(dim);
  const data = addRollingTrend(base, win);

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
      aria-label="Gasto diario del mes y tendencia"
    >
      <h3 className="text-foreground mb-1 text-sm font-semibold tracking-tight">
        Gasto diario del mes
      </h3>
      <p className="text-muted-foreground mb-4 text-xs">
        Picos: gasto real cada día. Tendencia: media móvil de {win} días (suaviza
        para ver si vas arriba o abajo del ritmo). Línea punteada: promedio fijo
        del mes (total ÷ {dim} días) para estimar “cuánto por día” en promedio.
        Eje derecho: cantidad de movimientos.
      </p>
      <div className="text-muted-foreground mb-2 text-xs">
        Promedio:{" "}
        <span className="text-foreground font-medium tabular-nums">
          {formatMoneyArs(avgArs, currency, venta)}
        </span>{" "}
        / día
      </div>
      <div
        className="chart-daily-gastos h-[280px] w-full min-w-0 text-foreground"
        style={{ color: "var(--foreground)" }}
      >
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={data}
            margin={{ top: 12, right: 8, left: 4, bottom: 8 }}
          >
            <CartesianGrid
              stroke="var(--border)"
              strokeOpacity={0.6}
              strokeDasharray="3 3"
              vertical={false}
            />
            <XAxis
              dataKey="day"
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              tickLine={{ stroke: "var(--border)" }}
              axisLine={{ stroke: "var(--border)" }}
              label={{
                value: "Día del mes",
                position: "insideBottom",
                offset: -4,
                fontSize: 11,
                fill: "var(--muted-foreground)",
              }}
            />
            <YAxis
              yAxisId="money"
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              tickLine={{ stroke: "var(--border)" }}
              axisLine={{ stroke: "var(--border)" }}
              tickFormatter={tickMoney}
              width={64}
            />
            <YAxis
              yAxisId="count"
              orientation="right"
              allowDecimals={false}
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              tickLine={{ stroke: "var(--border)" }}
              axisLine={{ stroke: "var(--border)" }}
              width={40}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const row = payload[0].payload as {
                  montoDisplay: number;
                  tendenciaDisplay: number;
                  count: number;
                };
                const ars =
                  currency === "USD" && venta != null && venta > 0
                    ? row.montoDisplay * venta
                    : row.montoDisplay;
                const arsT =
                  currency === "USD" && venta != null && venta > 0
                    ? row.tendenciaDisplay * venta
                    : row.tendenciaDisplay;
                return (
                  <div className="border-border bg-popover text-popover-foreground rounded-md border px-2 py-1.5 text-xs shadow-md">
                    <div className="font-medium">Día {label}</div>
                    <div className="tabular-nums">
                      Gasto: {formatMoneyArs(ars, currency, venta)}
                    </div>
                    <div className="text-muted-foreground tabular-nums">
                      Tendencia ({win}d):{" "}
                      {formatMoneyArs(arsT, currency, venta)}
                    </div>
                    <div className="text-muted-foreground mt-0.5">
                      {row.count} movimiento{row.count === 1 ? "" : "s"}
                    </div>
                  </div>
                );
              }}
            />
            <Legend
              wrapperStyle={{
                fontSize: 12,
                paddingTop: 10,
                color: "var(--foreground)",
              }}
              formatter={(value) => (
                <span style={{ color: "var(--foreground)" }}>{value}</span>
              )}
            />
            <ReferenceLine
              yAxisId="money"
              y={avgDisplay}
              stroke="var(--muted-foreground)"
              strokeDasharray="5 5"
              strokeWidth={1.5}
              label={{
                value: "Promedio $/día",
                position: "right",
                fill: "var(--foreground)",
                fontSize: 11,
              }}
            />
            <Line
              yAxisId="money"
              type="monotone"
              dataKey="montoDisplay"
              name="Gasto del día"
              stroke="var(--primary)"
              strokeWidth={2}
              dot={{ r: 3, fill: "var(--primary)", stroke: "var(--card)" }}
              activeDot={{ r: 5, fill: "var(--primary)" }}
            />
            <Line
              yAxisId="money"
              type="monotone"
              dataKey="tendenciaDisplay"
              name={`Tendencia (${win}d)`}
              stroke="var(--chart-1)"
              strokeWidth={2}
              dot={false}
            />
            <Line
              yAxisId="count"
              type="monotone"
              dataKey="count"
              name="Cantidad"
              stroke="var(--muted-foreground)"
              strokeWidth={2}
              dot={{
                r: 3,
                fill: "var(--foreground)",
                stroke: "var(--card)",
                strokeWidth: 1,
              }}
              activeDot={{ r: 5 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
