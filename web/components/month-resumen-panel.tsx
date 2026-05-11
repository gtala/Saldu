"use client";

import { Button } from "@/components/ui/button";
import { formatMoneyArs } from "@/lib/gastos-format";
import type { MonthPayload } from "@/lib/gastos-types";
import { buildResumenStats } from "@/lib/resumen-stats";
import { useCallback, useMemo, useState } from "react";

type Props = {
  month: MonthPayload;
  prevMonth: MonthPayload | null;
  currency: "ARS" | "USD";
  venta: number | null;
};

export function MonthResumenPanel({
  month,
  prevMonth,
  currency,
  venta,
}: Props) {
  const stats = useMemo(
    () => buildResumenStats(month, prevMonth),
    [month, prevMonth]
  );

  const pctFijo =
    stats.totalGastosArs > 0
      ? Math.round((stats.fixedLikeArs / stats.totalGastosArs) * 1000) / 10
      : 0;
  const pctVar = Math.max(0, Math.round((100 - pctFijo) * 10) / 10);

  const [iaText, setIaText] = useState<string | null>(null);
  const [iaErr, setIaErr] = useState<string | null>(null);
  const [iaLoading, setIaLoading] = useState(false);

  const generarIa = useCallback(async () => {
    setIaErr(null);
    setIaLoading(true);
    try {
      const r = await fetch("/api/resumen/ia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ stats }),
      });
      const j = (await r.json()) as { text?: string; error?: string };
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      setIaText(j.text ?? "");
    } catch (e) {
      setIaText(null);
      setIaErr(e instanceof Error ? e.message : "Error");
    } finally {
      setIaLoading(false);
    }
  }, [stats]);

  if (month.error) {
    return (
      <p className="text-muted-foreground text-sm">
        Esta pestaña tiene error de lectura; no se puede armar el resumen.
      </p>
    );
  }

  const fmt = (n: number) => formatMoneyArs(n, currency, venta);

  return (
    <div className="flex flex-col gap-6">
      <section className="border-border bg-card rounded-xl border p-4 md:p-6">
        <h2 className="mb-1 text-lg font-semibold">Números del mes</h2>
        <p className="text-muted-foreground mb-4 text-sm">
          Fijo / variable es una{" "}
          <strong className="text-foreground">heurística por categoría</strong>{" "}
          (suscripciones, servicios e impuestos, vivienda, educación). Ajustable
          en código si querés otra regla.
        </p>
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <dt className="text-muted-foreground text-xs">Total gastos</dt>
            <dd className="text-lg font-semibold tabular-nums">
              {fmt(stats.totalGastosArs)}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs">Total ingresos</dt>
            <dd className="text-lg font-semibold tabular-nums">
              {fmt(stats.totalIngresosArs)}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs">Balance</dt>
            <dd className="text-lg font-semibold tabular-nums">
              {fmt(stats.balanceArs)}
            </dd>
          </div>
          {stats.avgDailyGastoArs != null ? (
            <div>
              <dt className="text-muted-foreground text-xs">Promedio diario (gastos)</dt>
              <dd className="text-lg font-semibold tabular-nums">
                {fmt(stats.avgDailyGastoArs)}
              </dd>
            </div>
          ) : null}
          <div>
            <dt className="text-muted-foreground text-xs">Movimientos (filas)</dt>
            <dd className="text-lg font-semibold tabular-nums">{stats.rowCount}</dd>
          </div>
        </dl>

        {stats.prevMonthName != null && stats.gastosDeltaPctVsPrev != null ? (
          <p className="text-muted-foreground mt-4 text-sm">
            vs <strong className="text-foreground">{stats.prevMonthName}</strong>: gastos{" "}
            <strong className="text-foreground">
              {stats.gastosDeltaPctVsPrev > 0 ? "+" : ""}
              {stats.gastosDeltaPctVsPrev}%
            </strong>{" "}
            ({fmt(stats.prevTotalGastosArs ?? 0)} → {fmt(stats.totalGastosArs)})
          </p>
        ) : null}

        <div className="mt-6">
          <div className="mb-1 flex justify-between text-xs">
            <span>Estimado fijo ({pctFijo}%)</span>
            <span>Resto variable ({pctVar}%)</span>
          </div>
          <div className="bg-muted flex h-3 w-full overflow-hidden rounded-full">
            <div
              className="bg-primary h-full min-w-0 transition-all"
              style={{ flex: Math.max(0.01, pctFijo) }}
            />
            <div
              className="h-full min-w-0 bg-orange-600/80 transition-all"
              style={{ flex: Math.max(0.01, pctVar) }}
            />
          </div>
          <p className="text-muted-foreground mt-2 text-xs">
            Fijo ≈ {fmt(stats.fixedLikeArs)} · Variable ≈{" "}
            {fmt(stats.variableLikeArs)}
          </p>
        </div>
      </section>

      <section className="border-border bg-card rounded-xl border p-4 md:p-6">
        <h2 className="mb-3 text-lg font-semibold">Top categorías (gastos)</h2>
        <ul className="flex flex-col gap-2">
          {stats.topCategories.map((c) => (
            <li
              key={c.name}
              className="flex items-center justify-between gap-2 border-b border-border/60 pb-2 text-sm last:border-0 last:pb-0"
            >
              <span className="min-w-0 truncate">{c.name}</span>
              <span className="text-muted-foreground shrink-0 tabular-nums">
                {fmt(c.totalArs)} · {c.pctOfGastos}%
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="border-border bg-card rounded-xl border p-4 md:p-6">
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold">Análisis con IA</h2>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={iaLoading}
            onClick={() => void generarIa()}
          >
            {iaLoading ? "Generando…" : iaText ? "Regenerar" : "Generar análisis"}
          </Button>
        </div>
        <p className="text-muted-foreground mb-3 text-xs">
          Se envían solo <strong>totales agregados</strong> del mes (sin listar cada
          compra). Requiere <code className="text-foreground">OPENAI_API_KEY</code>{" "}
          en Vercel.
        </p>
        {iaErr ? (
          <p className="text-destructive text-sm">{iaErr}</p>
        ) : null}
        {iaText ? (
          <div className="border-border bg-muted/30 rounded-lg border p-4 text-sm leading-relaxed whitespace-pre-wrap">
            {iaText}
          </div>
        ) : !iaLoading && !iaErr ? (
          <p className="text-muted-foreground text-sm">
            Tocá el botón para obtener un texto interpretando el mes.
          </p>
        ) : null}
      </section>
    </div>
  );
}
