"use client";

import { useEffect, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type MonthRow = {
  name: string;
  total: number;
  totalIngresos: number;
};

type Payload = {
  months?: MonthRow[];
  updatedAt?: string;
  error?: string;
};

function shortMonthLabel(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    const m = parts[0].slice(0, 3);
    const y = parts[1];
    return `${m} ${y.slice(-2)}`;
  }
  return name;
}

export function MonthlySpendChart() {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/api/data", { cache: "no-store" });
        const j = (await r.json()) as Payload & { code?: string };
        if (!r.ok) {
          throw new Error(
            j.error || `HTTP ${r.status}${j.code ? ` (${j.code})` : ""}`
          );
        }
        if (!cancelled) {
          setData(j);
          setErr(null);
        }
      } catch (e) {
        if (!cancelled) {
          setErr(e instanceof Error ? e.message : "Error de red");
          setData(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="bg-muted h-56 w-full animate-pulse rounded-xl md:h-64" />
    );
  }

  if (err) {
    return (
      <div className="border-destructive/50 bg-destructive/10 text-destructive rounded-xl border p-4 text-sm">
        <p className="font-medium">No se pudieron cargar los datos</p>
        <p className="text-destructive/90 mt-1">{err}</p>
        <p className="text-muted-foreground mt-3 text-xs">
          Revisá <code className="bg-muted rounded px-1">../.env</code> con{" "}
          <code className="bg-muted rounded px-1">GOOGLE_SHEETS_SPREADSHEET_ID</code> y{" "}
          <code className="bg-muted rounded px-1">GOOGLE_APPLICATION_CREDENTIALS</code>
          , y que corrás <code className="bg-muted rounded px-1">npm run dev</code> desde{" "}
          <code className="bg-muted rounded px-1">web/</code>.
        </p>
      </div>
    );
  }

  const months = data?.months ?? [];
  const chartRows = months.map((m) => ({
    mes: shortMonthLabel(m.name),
    gastos: m.total,
    ingresos: m.totalIngresos,
  }));

  if (chartRows.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        No hay pestañas de mes en el spreadsheet o están vacías.
      </p>
    );
  }

  return (
    <>
      <p className="text-muted-foreground mb-2 text-xs">
        Totales por pestaña del sheet (ARS, USD convertido con dólar cripto cuando aplica).
        {data?.updatedAt ? (
          <span className="ml-1 opacity-80">
            Actualizado: {new Date(data.updatedAt).toLocaleString("es-AR")}
          </span>
        ) : null}
      </p>
      <div className="bg-card text-card-foreground w-full min-h-56 rounded-xl border p-2 md:min-h-64">
        <ResponsiveContainer width="100%" height={260} minHeight={220}>
          <LineChart data={chartRows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
            <XAxis
              dataKey="mes"
              tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
              tickFormatter={(v) =>
                v >= 1_000_000
                  ? `${(v / 1_000_000).toFixed(1)}M`
                  : v >= 1000
                    ? `${Math.round(v / 1000)}k`
                    : String(v)
              }
            />
            <Tooltip
              contentStyle={{
                background: "var(--popover)",
                border: "1px solid var(--border)",
                borderRadius: "8px",
              }}
              labelStyle={{ color: "var(--foreground)" }}
              formatter={(value) =>
                Number(value ?? 0).toLocaleString("es-AR", {
                  maximumFractionDigits: 0,
                })
              }
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line
              type="monotone"
              dataKey="gastos"
              name="Gastos"
              stroke="hsl(0 70% 55%)"
              strokeWidth={2}
              dot={{ r: 3 }}
            />
            <Line
              type="monotone"
              dataKey="ingresos"
              name="Ingresos"
              stroke="hsl(142 55% 45%)"
              strokeWidth={2}
              dot={{ r: 3 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}
