"use client";

import "@/app/gastos-dashboard.css";
import { ExpensesTreemap } from "@/components/expenses-treemap";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  displayAmountFromArs,
  formatMoneyArs,
  pickDefaultMonth,
} from "@/lib/gastos-format";
import type { DashboardPayload, MonthPayload } from "@/lib/gastos-types";
import { PatrimonioPanel } from "@/components/patrimonio-panel";
import { ExpensesDailyLineChart } from "@/components/expenses-daily-line-chart";
import { LiveToastContainer, pushToast } from "@/components/live-toast";
import { useCountUp } from "@/lib/use-count-up";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

function getVentaCripto(c: Cotizacion | null): number | null {
  if (!c) return null;
  let v = c.venta;
  if (typeof v === "string") v = parseFloat(String(v).replace(",", "."));
  if (typeof v !== "number" || !Number.isFinite(v) || v <= 0) return null;
  return v;
}

type Cotizacion = { venta?: number | string; fechaActualizacion?: string };

const ANIM_MS = 3000;

function MonthBalanceCard({
  month,
  currency,
  venta,
}: {
  month: MonthPayload;
  currency: "ARS" | "USD";
  venta: number | null;
}) {
  let ing = Number(month.totalIngresos);
  let gas = Number(month.total);
  if (!Number.isFinite(ing) || ing < 0) ing = 0;
  if (!Number.isFinite(gas) || gas < 0) gas = 0;
  const netArs = ing - gas;
  const surplus = netArs > 0;
  const even = netArs === 0;
  const panelCls = even ? "is-even-panel" : surplus ? "is-surplus" : "is-deficit";
  let pill = "Equilibrio";
  if (even && ing === 0 && gas === 0) pill = "Sin movimientos";
  else if (even) pill = "Equilibrio";
  else if (surplus) pill = "Ganancia del mes";
  else pill = "Déficit del mes";
  if (ing <= 0 && gas > 0) pill = "Déficit del mes";
  if (ing > 0 && gas <= 0) pill = "Ganancia del mes";

  const fmt = (n: number) => formatMoneyArs(n, currency, venta);
  const ingAnim = useCountUp(ing, ANIM_MS, fmt);
  const gasAnim = useCountUp(gas, ANIM_MS, fmt);
  const netAnim = useCountUp(Math.abs(netArs), ANIM_MS, fmt);
  const pctIngAnim = useCountUp(ing, ANIM_MS);
  const pctGasAnim = useCountUp(gas, ANIM_MS);

  // porcentajes animados basados en los valores intermedios del counter
  const sumAnim = Number(pctIngAnim.replace(/\D/g, "")) + Number(pctGasAnim.replace(/\D/g, ""));
  const animIng = sumAnim > 0 ? (Number(pctIngAnim.replace(/\D/g, "")) / sumAnim) * 100 : 0;
  const animGas = sumAnim > 0 ? (Number(pctGasAnim.replace(/\D/g, "")) / sumAnim) * 100 : 0;

  const sign = netArs > 0 ? "+" : netArs < 0 ? "−" : "";

  return (
    <section className={`month-balance-panel ${panelCls}`} aria-label="Balance del mes">
      <div className="balance-pill">{pill}</div>
      <div className="balance-net-row">
        <span className="balance-net-label">Ingresos − gastos</span>
        <span className={`balance-net-value${even ? " is-even" : ""}`}>
          {sign}{netAnim}
        </span>
      </div>
      <div className="balance-split-wrap">
        <div className="balance-split-labels">
          <span>Ingresos</span>
          <span>Gastos</span>
        </div>
        <div className="balance-split-track">
          <span className="balance-split-ing" style={{ width: `${animIng.toFixed(2)}%`, transition: `width ${ANIM_MS}ms cubic-bezier(0.25,1,0.5,1)` }} />
          <span className="balance-split-gas" style={{ width: `${animGas.toFixed(2)}%`, transition: `width ${ANIM_MS}ms cubic-bezier(0.25,1,0.5,1)` }} />
        </div>
      </div>
      <div className="balance-bars-detail">
        <div>
          Total ingresos<br />
          <strong>{ingAnim}</strong>
        </div>
        <div className="text-right">
          Total gastos<br />
          <strong>{gasAnim}</strong>
        </div>
      </div>
    </section>
  );
}

function MonthTotalCard({
  month,
  currency,
  venta,
}: {
  month: MonthPayload;
  currency: "ARS" | "USD";
  venta: number | null;
}) {
  let totalArs = Number(month.total || 0);
  if (!Number.isFinite(totalArs) || totalArs < 0) totalArs = 0;
  const totalDisplay = displayAmountFromArs(totalArs, currency, venta);
  const stepBase = currency === "USD" ? 1000 : 1_000_000;
  let step = stepBase;
  let tickCount = Math.ceil(totalDisplay / step) || 1;
  while (tickCount > 8) {
    step *= 2;
    tickCount = Math.ceil(totalDisplay / step) || 1;
  }
  const maxDisplay = Math.max(step, Math.ceil(totalDisplay / step) * step);

  const animatedTotal = useCountUp(totalArs, ANIM_MS, (v) =>
    formatMoneyArs(v, currency, venta)
  );
  const animatedDisplay = useCountUp(totalDisplay, ANIM_MS);
  const animDisplayNum = parseFloat(animatedDisplay.replace(/\./g, "").replace(",", ".")) || 0;
  const fillPct =
    maxDisplay > 0
      ? Math.max(0, Math.min(100, (animDisplayNum / maxDisplay) * 100))
      : 0;

  const ticks: number[] = [];
  for (let v = 0; v <= maxDisplay + 0.0001; v += step) ticks.push(v);

  const fmtTick = (v: number) =>
    currency === "USD"
      ? `USD ${Math.round(v).toLocaleString("es-AR")}`
      : `$ ${Math.round(v).toLocaleString("es-AR")}`;

  const marksText =
    currency === "USD"
      ? `Marcas cada ${step.toLocaleString("es-AR")} USD`
      : `Marcas cada ${step.toLocaleString("es-AR")} ARS`;

  return (
    <section className="month-total-panel" aria-label="Total del mes">
      <div className="month-total-head">
        <span className="month-total-label">Total acumulado del mes</span>
        <strong className="month-total-value">{animatedTotal}</strong>
      </div>
      <div className="month-ruler-track">
        <span
          className="month-ruler-fill"
          style={{ width: `${fillPct.toFixed(2)}%`, transition: `width ${ANIM_MS}ms cubic-bezier(0.25,1,0.5,1)` }}
        />
      </div>
      <div className="month-ruler-ticks">
        {ticks.map((v, idx) => {
          const left = maxDisplay > 0 ? (v / maxDisplay) * 100 : 0;
          const edgeCls =
            idx === 0 ? "is-start" : idx === ticks.length - 1 ? "is-end" : "";
          return (
            <span key={v}>
              <span
                className="month-ruler-tick"
                style={{ left: `${left}%` }}
              />
              <span
                className={`month-ruler-tick-label ${edgeCls}`}
                style={{ left: `${left}%` }}
              >
                {fmtTick(v)}
              </span>
            </span>
          );
        })}
      </div>
      <div className="month-total-sub">
        Escala hasta {fmtTick(maxDisplay)} · {marksText}
      </div>
    </section>
  );
}

function CategoryDetail({
  month,
  categoryName,
  currency,
  venta,
  onClose,
}: {
  month: MonthPayload;
  categoryName: string;
  currency: "ARS" | "USD";
  venta: number | null;
  onClose: () => void;
}) {
  const all = month.categoryDetails?.[categoryName] ?? [];
  const top = all.slice(0, 80);

  if (!categoryName) return null;

  return (
    <div className="category-detail-box">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-foreground font-bold">{categoryName}</div>
          <div className="text-muted-foreground text-xs">
            {top.length} de {all.length} movimiento(s)
          </div>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={onClose}>
          Cerrar
        </Button>
      </div>
      {!top.length ? (
        <p className="text-muted-foreground text-sm">
          No encontré movimientos detallados en esta categoría.
        </p>
      ) : (
        <div className="cat-detail-list-scroll">
          {top.map((r, i) => {
            let amtTxt = formatMoneyArs(r.montoArs || 0, currency, venta);
            if (r.moneda === "USD") {
              amtTxt += ` · USD ${Number(r.montoOriginal || 0).toFixed(2)}`;
            }
            return (
              <div key={i} className="cat-detail-row-grid">
                <div className="text-muted-foreground tabular-nums">
                  {r.fecha || "-"}
                </div>
                <div className="break-words text-[#d7deea]">
                  {r.descripcion || "(sin descripción)"}
                </div>
                <div className="text-[#eaf1fb] whitespace-nowrap tabular-nums">
                  {amtTxt}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function IngresosPanel({
  month,
  currency,
  venta,
}: {
  month: MonthPayload;
  currency: "ARS" | "USD";
  venta: number | null;
}) {
  const ti = month.totalIngresos != null ? month.totalIngresos : 0;
  const ic = (month.incomeCategories ?? []).filter((c) => c.total > 0);
  if (!ti || ti <= 0 || ic.length === 0) {
    return (
      <section className="border-border bg-card rounded-xl border p-6">
        <h2 className="mb-2 text-lg font-semibold">Ingresos del mes</h2>
        <p className="text-muted-foreground text-sm">
          No hay ingresos con <strong>Tipo = Ingreso</strong> en este mes, o los
          montos están en cero.
        </p>
      </section>
    );
  }
  return (
    <section className="border-border bg-card rounded-xl border p-4">
      <h2 className="mb-3 text-lg font-semibold">Ingresos del mes</h2>
      <div className="mb-4 text-base font-semibold">
        Total: {formatMoneyArs(ti, currency, venta)}
      </div>
      <div className="flex flex-col gap-3">
        {ic.map((c) => {
          const pct = ti > 0 ? Math.round((c.total / ti) * 100) : 0;
          return (
            <div key={c.name} className="flex flex-col gap-1">
              <div className="flex justify-between text-sm">
                <span>{c.name}</span>
                <span className="tabular-nums">
                  {formatMoneyArs(c.total, currency, venta)} · {pct}%
                </span>
              </div>
              <div className="bg-muted h-2 overflow-hidden rounded-full">
                <div
                  className="bg-primary h-full rounded-full transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function DashboardShell() {
  const [tab, setTab] = useState("gastos");
  const [payload, setPayload] = useState<DashboardPayload | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [monthName, setMonthName] = useState("");
  const [currency, setCurrency] = useState<"ARS" | "USD">("ARS");
  const [cotizacion, setCotizacion] = useState<Cotizacion | null>(null);
  const [selectedCategory, setSelectedCategory] = useState("");
  const prevPayloadRef = useRef<DashboardPayload | null>(null);
  const sheetRevisionRef = useRef<number>(-1);

  const venta = useMemo(() => getVentaCripto(cotizacion), [cotizacion]);

  const loadData = useCallback(async (isPolling = false) => {
    if (!isPolling) setLoadErr(null);
    try {
      const dataUrl =
        isPolling ? `/api/data?fresh=1&r=${Date.now()}` : "/api/data";
      const r = await fetch(dataUrl, { cache: "no-store" });
      const j = (await r.json()) as DashboardPayload & {
        error?: string;
        code?: string;
      };
      if (!r.ok) {
        throw new Error(j.error || `HTTP ${r.status}`);
      }

      // detect changes and fire toasts on polling updates
      if (isPolling && prevPayloadRef.current) {
        const prev = prevPayloadRef.current;
        for (const newMonth of j.months ?? []) {
          const oldMonth = prev.months?.find((m) => m.name === newMonth.name);
          if (!oldMonth) continue;

          const gastosDiff = (newMonth.total ?? 0) - (oldMonth.total ?? 0);
          if (gastosDiff > 0) {
            pushToast({
              type: "gasto",
              label: `Nuevo gasto — ${newMonth.name}`,
              amount: formatMoneyArs(gastosDiff, "ARS", null),
            });
          }

          const ingresosDiff =
            (newMonth.totalIngresos ?? 0) - (oldMonth.totalIngresos ?? 0);
          if (ingresosDiff > 0) {
            pushToast({
              type: "ingreso",
              label: `Nuevo ingreso — ${newMonth.name}`,
              amount: formatMoneyArs(ingresosDiff, "ARS", null),
            });
          }
        }
      }

      // fingerprint basado en los datos reales (no el timestamp)
      const fingerprint = (data: typeof j) =>
        (data.months ?? [])
          .map((m) => `${m.name}:${m.total}:${m.totalIngresos}:${m.rowCount ?? 0}`)
          .join("|") +
        "|pat:" +
        (data.patrimonio?.snapshots?.length ?? 0);

      const prevFp = prevPayloadRef.current ? fingerprint(prevPayloadRef.current) : null;
      const newFp = fingerprint(j);
      const hasNewData = prevFp === null || prevFp !== newFp;
      prevPayloadRef.current = j;
      if (hasNewData || !isPolling) setPayload(j);
      const months = j.months ?? [];
      if (months.length) {
        const def = pickDefaultMonth(months);
        setMonthName((prev) => {
          if (prev && months.some((m) => m.name === prev)) return prev;
          return def;
        });
      }
    } catch (e) {
      if (!isPolling) {
        setLoadErr(e instanceof Error ? e.message : "Error");
        setPayload(null);
      }
    }
  }, []);

  // initial load
  useEffect(() => {
    loadData(false);
  }, [loadData]);

  // Con Upstash (live): n8n → POST /api/notify → incr en Redis; acá solo leemos /api/version (liviano).
  // Sin Redis: respaldo cada 60s a /api/data (edits manuales en Sheets sin n8n).
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | undefined;

    const arm = async () => {
      try {
        const r = await fetch("/api/version", { cache: "no-store" });
        const j = (await r.json()) as { version: number; live: boolean };
        if (cancelled) return;

        if (j.live) {
          sheetRevisionRef.current = j.version;
          timer = setInterval(async () => {
            if (cancelled) return;
            try {
              const r2 = await fetch("/api/version", { cache: "no-store" });
              const n = (await r2.json()) as { version: number; live: boolean };
              if (n.version !== sheetRevisionRef.current) {
                const hadPrior = sheetRevisionRef.current !== -1;
                sheetRevisionRef.current = n.version;
                if (hadPrior) await loadData(true);
              }
            } catch {
              /* ignore */
            }
          }, 3000);
        } else {
          timer = setInterval(() => {
            if (!cancelled) loadData(true);
          }, 60_000);
        }
      } catch {
        if (!cancelled) {
          timer = setInterval(() => loadData(true), 60_000);
        }
      }
    };

    void arm();
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [loadData]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const c = localStorage.getItem("dashboardCurrency");
        if (c !== "USD") return;
        const r = await fetch("/api/cotizacion-cripto");
        const j = (await r.json()) as Cotizacion;
        if (!cancelled && r.ok) {
          setCotizacion(j);
          setCurrency("USD");
        }
      } catch {
        /* stay ARS */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const applyUsd = useCallback(async () => {
    try {
      const r = await fetch("/api/cotizacion-cripto");
      const j = (await r.json()) as Cotizacion & { error?: string };
      if (!r.ok) throw new Error(j.error || "cotización");
      setCotizacion(j);
      setCurrency("USD");
      try {
        localStorage.setItem("dashboardCurrency", "USD");
      } catch {
        /* ignore */
      }
    } catch {
      setCurrency("ARS");
      try {
        localStorage.setItem("dashboardCurrency", "ARS");
      } catch {
        /* ignore */
      }
      alert(
        "No se pudo obtener la cotización dólar cripto. Seguimos en ARS."
      );
    }
  }, []);

  const setArs = useCallback(() => {
    setCurrency("ARS");
    try {
      localStorage.setItem("dashboardCurrency", "ARS");
    } catch {
      /* ignore */
    }
  }, []);

  const month = useMemo(
    () => payload?.months?.find((m) => m.name === monthName) ?? null,
    [payload, monthName]
  );

  useEffect(() => {
    setSelectedCategory("");
  }, [monthName]);

  const currencyMeta = () => {
    if (currency !== "USD") return null;
    const vn = venta;
    if (vn == null) {
      return (
        <p className="text-muted-foreground text-xs">Dólar cripto: cargando…</p>
      );
    }
    const fu = cotizacion?.fechaActualizacion || "";
    let fuTxt = "";
    if (fu) {
      try {
        const d = new Date(fu);
        fuTxt = ` · actualizado ${d.toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" })}`;
      } catch {
        fuTxt = "";
      }
    }
    return (
      <p className="text-muted-foreground text-xs">
        USD al tipo dólar cripto (venta):{" "}
        {new Intl.NumberFormat("es-AR", {
          style: "currency",
          currency: "ARS",
          maximumFractionDigits: 0,
        }).format(vn)}{" "}
        por USD{fuTxt}
      </p>
    );
  };

  if (loadErr) {
    return (
      <div className="border-destructive/50 bg-destructive/10 text-destructive rounded-xl border p-4 text-sm">
        <p className="font-medium">No se pudieron cargar los datos</p>
        <p className="mt-1">{loadErr}</p>
      </div>
    );
  }

  if (!payload) {
    return (
      <div className="bg-muted h-40 w-full animate-pulse rounded-xl" />
    );
  }

  const months = payload.months ?? [];
  const showToolbar = tab !== "patrimonio";

  return (
    <>
    <Tabs value={tab} onValueChange={setTab} className="gap-4">
      <TabsList
        className="flex h-auto min-h-10 w-full max-w-2xl flex-wrap gap-1"
        variant="line"
      >
        <TabsTrigger value="patrimonio">Patrimonio</TabsTrigger>
        <TabsTrigger value="ingresos">Ingresos</TabsTrigger>
        <TabsTrigger value="gastos">Gastos</TabsTrigger>
        <TabsTrigger value="diario">Diario</TabsTrigger>
      </TabsList>

      {showToolbar && (
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <label className="flex min-w-[10rem] flex-col gap-1 text-xs font-medium">
            Mes
            <select
              className="border-input bg-background text-foreground h-9 rounded-md border px-2 text-sm"
              value={monthName}
              disabled={months.length === 0}
              onChange={(e) => setMonthName(e.target.value)}
            >
              {months.map((m) => (
                <option key={m.name} value={m.name}>
                  {m.name}
                  {m.error ? " (error)" : ""}
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium">Moneda</span>
            <div className="flex gap-1">
              <Button
                type="button"
                size="sm"
                variant={currency === "ARS" ? "default" : "outline"}
                onClick={setArs}
              >
                ARS
              </Button>
              <Button
                type="button"
                size="sm"
                variant={currency === "USD" ? "default" : "outline"}
                onClick={() => void applyUsd()}
              >
                USD
              </Button>
            </div>
          </div>
          {tab === "gastos" && (
            <div className="flex flex-col gap-1 sm:ml-auto">
              <span className="text-muted-foreground text-[0.65rem] uppercase tracking-wide">
                Más gasto → más intenso
              </span>
              <div className="flex items-center gap-2 text-[0.65rem] text-muted-foreground">
                <span>Menos</span>
                <div className="g-legend-bar" />
                <span>Más</span>
              </div>
            </div>
          )}
        </div>
      )}
      {currencyMeta()}

      <TabsContent value="patrimonio" className="mt-2">
        {payload.patrimonio ? (
          <PatrimonioPanel data={payload.patrimonio} />
        ) : (
          <p className="text-muted-foreground text-sm">
            No hay datos de patrimonio disponibles.
          </p>
        )}
      </TabsContent>

      <TabsContent value="ingresos" className="mt-2">
        {month ? (
          <IngresosPanel month={month} currency={currency} venta={venta} />
        ) : (
          <p className="text-muted-foreground text-sm">Elegí un mes.</p>
        )}
      </TabsContent>

      <TabsContent value="gastos" className="mt-2 flex flex-col gap-3">
        {month ? (
          <>
            <MonthBalanceCard month={month} currency={currency} venta={venta} />
            <MonthTotalCard month={month} currency={currency} venta={venta} />
            <ExpensesTreemap
              month={month}
              currency={currency}
              ventaCripto={venta}
              selectedCategory={selectedCategory}
              onSelectCategory={setSelectedCategory}
            />
            {selectedCategory ? (
              <CategoryDetail
                month={month}
                categoryName={selectedCategory}
                currency={currency}
                venta={venta}
                onClose={() => setSelectedCategory("")}
              />
            ) : null}
          </>
        ) : (
          <p className="text-muted-foreground text-sm">
            No hay pestañas mensuales en el spreadsheet.
          </p>
        )}
      </TabsContent>

      <TabsContent value="diario" className="mt-2 flex flex-col gap-3">
        {month ? (
          <>
            {!month.error && (month.dailyGastos?.length ?? 0) > 0 ? (
              <ExpensesDailyLineChart
                month={month}
                currency={currency}
                venta={venta}
              />
            ) : (
              <p className="text-muted-foreground text-sm">
                No hay serie diaria para este mes (fechas vacías o pestaña sin
                datos).
              </p>
            )}
          </>
        ) : (
          <p className="text-muted-foreground text-sm">
            No hay pestañas mensuales en el spreadsheet.
          </p>
        )}
      </TabsContent>

      {payload.updatedAt ? (
        <p className="text-muted-foreground text-xs">
          {payload.spreadsheetTitle ? `Planilla: ${payload.spreadsheetTitle} · ` : ""}
          Actualizado: {payload.updatedAt}
          {payload.cached ? " (caché)" : ""}
        </p>
      ) : null}
    </Tabs>
    <LiveToastContainer />
    </>
  );
}
