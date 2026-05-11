"use client";

import { formatMoneyArs } from "@/lib/gastos-format";
import type { FixedBillsSnapshot, FixedBillStatus } from "@/lib/fixed-bills-status";
import { cn } from "@/lib/utils";
import { CheckCircle2, CircleAlert, Clock3 } from "lucide-react";

type Props = {
  snapshot: FixedBillsSnapshot;
  currency: "ARS" | "USD";
  venta: number | null;
};

function statusMeta(s: FixedBillStatus) {
  switch (s) {
    case "pagado":
      return {
        label: "Pagado",
        Icon: CheckCircle2,
        bar: "bg-emerald-500",
        border: "border-l-emerald-500",
        chip: "bg-emerald-500/15 text-emerald-200 ring-emerald-500/30",
      };
    case "parcial":
      return {
        label: "Parcial",
        Icon: Clock3,
        bar: "bg-amber-500",
        border: "border-l-amber-500",
        chip: "bg-amber-500/15 text-amber-100 ring-amber-500/35",
      };
    default:
      return {
        label: "Pendiente",
        Icon: CircleAlert,
        bar: "bg-rose-500",
        border: "border-l-rose-500",
        chip: "bg-rose-500/15 text-rose-100 ring-rose-500/35",
      };
  }
}

export function FixedBillsPanel({ snapshot, currency, venta }: Props) {
  const fmt = (n: number) => formatMoneyArs(n, currency, venta);

  if (snapshot.kind === "no_prev") {
    return (
      <section
        className="border-border bg-card rounded-xl border p-4 md:p-5"
        aria-label="Estado de gastos fijos"
      >
        <h2 className="text-foreground mb-1 text-lg font-semibold">
          Fijos: pagado vs pendiente
        </h2>
        <p className="text-muted-foreground text-sm">
          Para estimar qué falta pagar necesitamos un{" "}
          <strong className="text-foreground">mes anterior</strong> en la planilla.
          Elegí un mes que no sea el primero del listado.
        </p>
      </section>
    );
  }

  if (snapshot.kind === "empty") {
    return (
      <section
        className="border-border bg-card rounded-xl border p-4 md:p-5"
        aria-label="Estado de gastos fijos"
      >
        <h2 className="text-foreground mb-1 text-lg font-semibold">
          Fijos: pagado vs pendiente
        </h2>
        <p className="text-muted-foreground text-sm">
          En el mes anterior no hay montos en categorías{" "}
          <strong className="text-foreground">fijas</strong> (vivienda, servicios e
          impuestos, suscripciones, educación). Cuando figuren ahí, acá vas a ver el
          checklist.
        </p>
      </section>
    );
  }

  const { rows, totalExpectedArs, totalPaidArs, totalRemainingArs, referenceMonthName, currentMonthName } =
    snapshot;
  const pct =
    totalExpectedArs > 0
      ? Math.min(100, Math.round((totalPaidArs / totalExpectedArs) * 1000) / 10)
      : 0;

  return (
    <section
      className="border-border bg-card overflow-hidden rounded-xl border shadow-sm"
      aria-label="Estado de gastos fijos respecto al mes anterior"
    >
      <div className="border-border bg-muted/25 border-b px-4 py-4 md:px-5">
        <h2 className="text-foreground mb-1 text-lg font-semibold">
          Fijos: pagado vs pendiente
        </h2>
        <p className="text-muted-foreground mb-4 text-xs leading-relaxed">
          Referencia: totales de{" "}
          <strong className="text-foreground">{referenceMonthName}</strong> por
          categoría fija. Comparado con lo que ya cargaste en{" "}
          <strong className="text-foreground">{currentMonthName}</strong>. Es una
          estimación: si un servicio cambió de precio, el “esperado” puede no
          coincidir al céntimo.
        </p>

        <div className="mb-3 flex flex-wrap gap-4">
          <div className="min-w-[8.5rem] flex-1 rounded-lg bg-background/60 px-3 py-2 ring-1 ring-border/80">
            <div className="text-muted-foreground text-[0.65rem] font-medium uppercase tracking-wide">
              Ya registrado (fijos)
            </div>
            <div className="text-foreground text-lg font-bold tabular-nums">
              {fmt(totalPaidArs)}
            </div>
          </div>
          <div className="min-w-[8.5rem] flex-1 rounded-lg bg-background/60 px-3 py-2 ring-1 ring-border/80">
            <div className="text-muted-foreground text-[0.65rem] font-medium uppercase tracking-wide">
              Falta ~ (vs mes pasado)
            </div>
            <div
              className={cn(
                "text-lg font-bold tabular-nums",
                totalRemainingArs > 0 ? "text-amber-200" : "text-emerald-200"
              )}
            >
              {fmt(totalRemainingArs)}
            </div>
          </div>
          <div className="min-w-[8.5rem] flex-1 rounded-lg bg-background/60 px-3 py-2 ring-1 ring-border/80">
            <div className="text-muted-foreground text-[0.65rem] font-medium uppercase tracking-wide">
              Referencia total
            </div>
            <div className="text-foreground text-lg font-bold tabular-nums">
              {fmt(totalExpectedArs)}
            </div>
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="text-muted-foreground flex justify-between text-[0.7rem]">
            <span>Progreso vs mes pasado</span>
            <span className="tabular-nums text-foreground">{pct}%</span>
          </div>
          <div className="bg-muted relative h-3.5 w-full overflow-hidden rounded-full ring-1 ring-border/60">
            <div
              className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 transition-[width] duration-500 ease-out"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>

      <ul className="divide-border divide-y px-2 py-2 md:px-3">
        {rows.map((row) => {
          const meta = statusMeta(row.status);
          const Icon = meta.Icon;
          const barPct =
            row.expectedArs > 0
              ? Math.min(100, Math.round((row.paidArs / row.expectedArs) * 1000) / 10)
              : 0;
          return (
            <li
              key={row.categoryName}
              className={cn(
                "border-border/80 flex flex-col gap-2 rounded-lg border border-l-4 bg-background/40 py-3 pl-3 pr-3 md:flex-row md:items-center md:gap-4",
                meta.border
              )}
            >
              <div className="flex min-w-0 flex-1 items-start gap-2.5">
                <Icon
                  className="mt-0.5 size-5 shrink-0 opacity-90"
                  aria-hidden
                />
                <div className="min-w-0">
                  <div className="text-foreground flex flex-wrap items-center gap-2 font-medium">
                    <span className="truncate">{row.categoryName}</span>
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide ring-1 ring-inset",
                        meta.chip
                      )}
                    >
                      {meta.label}
                    </span>
                  </div>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    Mes pasado: {row.prevMovementCount} mov.
                    {" · "}
                    Referencia {fmt(row.expectedArs)}
                  </p>
                  <div className="mt-2 md:hidden">
                    <div className="bg-muted h-2 overflow-hidden rounded-full">
                      <div
                        className={cn("h-full rounded-full transition-all", meta.bar)}
                        style={{ width: `${barPct}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="hidden w-28 shrink-0 md:block">
                <div className="bg-muted h-2 overflow-hidden rounded-full">
                  <div
                    className={cn("h-full rounded-full transition-all", meta.bar)}
                    style={{ width: `${barPct}%` }}
                  />
                </div>
              </div>

              <dl className="grid shrink-0 grid-cols-3 gap-2 text-center text-[0.7rem] md:w-[min(100%,22rem)] md:gap-3 md:text-xs">
                <div className="rounded-md bg-muted/40 px-1 py-1.5">
                  <dt className="text-muted-foreground">Pagado</dt>
                  <dd className="text-foreground font-semibold tabular-nums">
                    {fmt(row.paidArs)}
                  </dd>
                </div>
                <div className="rounded-md bg-muted/40 px-1 py-1.5">
                  <dt className="text-muted-foreground">Falta</dt>
                  <dd
                    className={cn(
                      "font-semibold tabular-nums",
                      row.remainingArs > 0 ? "text-amber-200" : "text-emerald-200"
                    )}
                  >
                    {fmt(row.remainingArs)}
                  </dd>
                </div>
                <div className="rounded-md bg-muted/40 px-1 py-1.5">
                  <dt className="text-muted-foreground">%</dt>
                  <dd className="text-foreground font-semibold tabular-nums">
                    {Math.round(row.ratioPaid * 100)}%
                  </dd>
                </div>
              </dl>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
