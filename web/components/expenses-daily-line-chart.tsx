"use client";

import {
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { MonthPayload } from "@/lib/gastos-types";
import { formatMoneyArs } from "@/lib/gastos-format";
import { useCallback, useMemo } from "react";

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

const MONTH_ORDER: Record<string, number> = {
  enero: 0,
  febrero: 1,
  marzo: 2,
  abril: 3,
  mayo: 4,
  junio: 5,
  julio: 6,
  agosto: 7,
  septiembre: 8,
  octubre: 9,
  noviembre: 10,
  diciembre: 11,
};

/** Misma forma que las pestañas del Sheet: "mayo 2026". */
function parseSheetMonthTitle(title: string): { year: number; month0: number } | null {
  const t = String(title || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const m = t.match(/^([a-z]+)\s+(\d{4})$/);
  if (!m) return null;
  const month0 = MONTH_ORDER[m[1]];
  if (month0 == null || !Number.isFinite(month0)) return null;
  const year = parseInt(m[2], 10);
  if (!Number.isFinite(year)) return null;
  return { year, month0 };
}

/** Mediodía UTC para no cruzar medianoche en AR al pedir el día de la semana. */
function weekdayMeta(year: number, month0: number, day: number) {
  const inst = new Date(Date.UTC(year, month0, day, 12, 0, 0));
  const weekdayShort = new Intl.DateTimeFormat("es-AR", {
    weekday: "short",
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(inst);
  const enShort = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(inst);
  const finSemana = enShort === "Sat" || enShort === "Sun";
  const weekdayLong = new Intl.DateTimeFormat("es-AR", {
    weekday: "long",
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(inst);
  return { weekdayShort, weekdayLong, finSemana };
}

function addRollingTrend(
  points: Array<{
    day: number;
    montoDisplay: number;
    count: number;
    weekdayShort: string;
    weekdayLong: string;
    finSemana: boolean;
  }>,
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

/** Colores fijos legibles sobre fondo oscuro (no dependen de --chart-* del tema). */
const COLOR_GASTO = "#38bdf8";
const COLOR_TENDENCIA = "#c084fc";
const COLOR_CANTIDAD = "#fbbf24";
const COLOR_PROMEDIO = "#94a3b8";
const COLOR_FIN_SEMANA_BG = "rgba(139, 92, 246, 0.14)";
const COLOR_FIN_SEMANA_TICK = "#c4b5fd";
const COLOR_TICK_NORMAL = "#94a3b8";

type DailyRow = {
  day: number;
  montoDisplay: number;
  count: number;
  tendenciaDisplay: number;
  weekdayShort: string;
  weekdayLong: string;
  finSemana: boolean;
};

function DailyXAxisTick({
  x: xIn,
  y: yIn,
  payload,
  rows,
}: {
  x: number | string;
  y: number | string;
  payload: { value: number };
  rows: DailyRow[];
}) {
  const x = typeof xIn === "number" ? xIn : parseFloat(String(xIn));
  const y = typeof yIn === "number" ? yIn : parseFloat(String(yIn));
  const day = payload.value;
  const row = rows.find((r) => r.day === day);
  const w = row?.weekdayShort?.replace(/\.$/, "") ?? "";
  const weekend = row?.finSemana;
  const fill = weekend ? COLOR_FIN_SEMANA_TICK : COLOR_TICK_NORMAL;
  return (
    <g transform={`translate(${x},${y})`}>
      <text
        fill={fill}
        fontSize={9}
        textAnchor="end"
        transform="rotate(-42)"
      >
        <tspan x={0} dy={0}>
          {day}
        </tspan>
        {w ? (
          <tspan x={0} dy={11} fill={fill}>
            {w}
          </tspan>
        ) : null}
      </text>
    </g>
  );
}

export function ExpensesDailyLineChart({ month, currency, venta }: Props) {
  const series = month.dailyGastos ?? [];
  const avgArs = month.avgDailyGastoArs ?? 0;
  const dim = month.daysInMonth ?? (month.dailyGastos?.length ?? 0);

  const toDisplayArs = useCallback(
    (ars: number) => {
      if (currency === "USD" && venta != null && venta > 0) return ars / venta;
      return ars;
    },
    [currency, venta]
  );

  const cal = useMemo(() => parseSheetMonthTitle(month.name), [month.name]);

  const data = useMemo((): DailyRow[] => {
    const s = month.dailyGastos ?? [];
    const d = month.daysInMonth ?? s.length;
    if (!s.length || d === 0) return [];
    const base = s.map((p) => {
      let weekdayShort = "";
      let weekdayLong = "";
      let finSemana = false;
      if (cal) {
        const w = weekdayMeta(cal.year, cal.month0, p.day);
        weekdayShort = w.weekdayShort;
        weekdayLong = w.weekdayLong;
        finSemana = w.finSemana;
      }
      return {
        day: p.day,
        montoDisplay: toDisplayArs(p.totalArs),
        count: p.count,
        weekdayShort,
        weekdayLong,
        finSemana,
      };
    });
    const winLocal = rollingWindowSize(d);
    return addRollingTrend(base, winLocal);
  }, [month, cal, toDisplayArs]);

  const win = rollingWindowSize(dim > 0 ? dim : 1);

  if (!series.length || dim === 0) return null;

  const avgDisplay = toDisplayArs(avgArs);
  const weekendDays = data.filter((p) => p.finSemana).map((p) => p.day);

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
        Picos: gasto real cada día (celeste). Tendencia: media móvil de {win} días
        (violeta). Cantidad de movimientos (ámbar, eje derecho). Promedio del mes:
        gris punteado. Fines de semana (sáb/dom): fondo violeta suave y etiquetas
        del eje X en violeta claro.
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
            margin={{ top: 12, right: 8, left: 4, bottom: 44 }}
          >
            <CartesianGrid
              stroke="var(--border)"
              strokeOpacity={0.6}
              strokeDasharray="3 3"
              vertical={false}
            />
            {weekendDays.map((d) => (
              <ReferenceArea
                key={`we-${d}`}
                yAxisId="money"
                x1={d - 0.5}
                x2={d + 0.5}
                fill={COLOR_FIN_SEMANA_BG}
                strokeOpacity={0}
              />
            ))}
            <XAxis
              type="number"
              dataKey="day"
              domain={["dataMin - 0.5", "dataMax + 0.5"]}
              ticks={data.map((p) => p.day)}
              interval={0}
              tick={(props) => (
                <DailyXAxisTick {...props} rows={data} />
              )}
              tickLine={{ stroke: "var(--border)" }}
              axisLine={{ stroke: "var(--border)" }}
              height={40}
              label={{
                value: "Día del mes (sáb/dom en violeta · Argentina)",
                position: "insideBottom",
                offset: -2,
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
                  weekdayLong?: string;
                  finSemana?: boolean;
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
                    <div className="font-medium">
                      Día {label}
                      {row.weekdayLong ? (
                        <span className="text-muted-foreground font-normal">
                          {" "}
                          · {row.weekdayLong}
                          {row.finSemana ? " · fin de semana" : ""}
                        </span>
                      ) : null}
                    </div>
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
              formatter={(value) => {
                const color =
                  value === "Gasto del día"
                    ? COLOR_GASTO
                    : String(value).startsWith("Tendencia")
                      ? COLOR_TENDENCIA
                      : value === "Cantidad"
                        ? COLOR_CANTIDAD
                        : "var(--foreground)";
                return <span style={{ color }}>{value}</span>;
              }}
            />
            <ReferenceLine
              yAxisId="money"
              y={avgDisplay}
              stroke={COLOR_PROMEDIO}
              strokeDasharray="5 5"
              strokeWidth={1.5}
              label={{
                value: "Promedio $/día",
                position: "right",
                fill: COLOR_PROMEDIO,
                fontSize: 11,
              }}
            />
            <Line
              yAxisId="money"
              type="monotone"
              dataKey="montoDisplay"
              name="Gasto del día"
              stroke={COLOR_GASTO}
              strokeWidth={2.2}
              dot={{ r: 3.5, fill: COLOR_GASTO, stroke: "#0f172a", strokeWidth: 1 }}
              activeDot={{ r: 6, fill: COLOR_GASTO, stroke: "#0f172a" }}
            />
            <Line
              yAxisId="money"
              type="monotone"
              dataKey="tendenciaDisplay"
              name={`Tendencia (${win}d)`}
              stroke={COLOR_TENDENCIA}
              strokeWidth={2.2}
              dot={false}
            />
            <Line
              yAxisId="count"
              type="monotone"
              dataKey="count"
              name="Cantidad"
              stroke={COLOR_CANTIDAD}
              strokeWidth={2}
              dot={{
                r: 3,
                fill: COLOR_CANTIDAD,
                stroke: "#0f172a",
                strokeWidth: 1,
              }}
              activeDot={{ r: 5, fill: COLOR_CANTIDAD }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
