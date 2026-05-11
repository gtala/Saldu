"use client";

import { formatMoneyArs } from "@/lib/gastos-format";
import type { SpendingPaceResult } from "@/lib/spending-pace-index";
import { useId, type ReactNode } from "react";

type Props = {
  result: SpendingPaceResult;
  currency: "ARS" | "USD";
  venta: number | null;
};

function gaugeBody(
  result: SpendingPaceResult,
  fmt: (n: number) => string,
  gradId: string
): ReactNode {
  if (result.kind === "no_data") {
    return (
      <p className="text-muted-foreground text-sm">
        No hay datos para este mes.
      </p>
    );
  }
  if (result.kind === "no_april") {
    return (
      <p className="text-muted-foreground text-sm">
        No encontré una pestaña <strong className="text-foreground">Abril</strong>{" "}
        en la planilla. Cuando exista, acá comparamos el ritmo de gasto{" "}
        <strong className="text-foreground">variable</strong> (resto después de
        vivienda, servicios, suscripciones y educación) contra el promedio diario de
        ese abril.
      </p>
    );
  }
  if (result.kind === "same_as_reference") {
    return (
      <p className="text-muted-foreground text-sm">
        Estás viendo el mismo mes que usamos de referencia (Abril). Abrí otro mes
        (por ejemplo Mayo) para ver el indicador de ritmo.
      </p>
    );
  }

  const { index, label, refMonthName, effectiveDay, daysInMonth } = result;
  const angleDeg = 180 - (index / 100) * 180;
  const rad = (angleDeg * Math.PI) / 180;
  const cx = 100;
  const cy = 92;
  const r = 72;
  const tipX = cx + Math.cos(rad) * (r - 2);
  const tipY = cy - Math.sin(rad) * (r - 2);

  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
      <div className="relative mx-auto h-[118px] w-full max-w-[220px] shrink-0">
        <div className="pointer-events-none absolute left-1/2 top-[18%] z-10 -translate-x-1/2 text-center">
          <span className="text-foreground block text-3xl font-bold tabular-nums leading-none tracking-tight">
            {index}
          </span>
          <span className="text-muted-foreground mt-1 block text-xs font-medium">
            {label}
          </span>
        </div>
        <svg
          viewBox="0 0 200 108"
          className="absolute bottom-0 left-0 w-full overflow-visible"
          aria-hidden
        >
          <defs>
            <linearGradient
              id={gradId}
              x1="0%"
              y1="0%"
              x2="100%"
              y2="0%"
            >
              <stop offset="0%" stopColor="rgb(34, 197, 94)" />
              <stop offset="50%" stopColor="rgb(234, 179, 8)" />
              <stop offset="100%" stopColor="rgb(239, 68, 68)" />
            </linearGradient>
          </defs>
          <path
            d="M 28 92 A 72 72 0 0 1 172 92"
            fill="none"
            stroke={`url(#${gradId})`}
            strokeWidth="14"
            strokeLinecap="round"
          />
          <line
            x1={cx}
            y1={cy}
            x2={tipX}
            y2={tipY}
            stroke="rgb(226, 232, 240)"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
          <circle cx={cx} cy={cy} r="5.5" fill="rgb(226, 232, 240)" />
        </svg>
      </div>

      <dl className="flex min-w-0 flex-1 flex-col gap-2.5 text-sm">
        <div className="flex flex-wrap justify-between gap-x-3 gap-y-1 border-b border-border/60 pb-2">
          <dt className="text-muted-foreground">Referencia</dt>
          <dd className="text-right font-medium">{refMonthName}</dd>
        </div>
        <div className="flex flex-wrap justify-between gap-x-3 gap-y-1 border-b border-border/60 pb-2">
          <dt className="text-muted-foreground">Día para el ritmo</dt>
          <dd className="text-right tabular-nums">
            {effectiveDay} de {daysInMonth}
            <span className="text-muted-foreground ml-1 text-xs">
              (hoy en AR si es el mes actual)
            </span>
          </dd>
        </div>
        <div className="flex flex-wrap justify-between gap-x-3 gap-y-1 border-b border-border/60 pb-2">
          <dt className="text-muted-foreground">Variable / día (este mes)</dt>
          <dd className="text-right tabular-nums font-medium">
            {fmt(result.currentAvgDailyVariable)}
          </dd>
        </div>
        <div className="flex flex-wrap justify-between gap-x-3 gap-y-1">
          <dt className="text-muted-foreground">Variable / día (abril ref.)</dt>
          <dd className="text-right tabular-nums">
            {fmt(result.refAvgDailyVariable)}
          </dd>
        </div>
        <p className="text-muted-foreground pt-1 text-xs leading-relaxed">
          Solo cuenta gasto <strong className="text-foreground">variable</strong>{" "}
          (el alquiler en “Vivienda” no empuja el indicador como un gasto en
          restaurantes). El número central resume qué tan fuerte es el ritmo vs
          abril: cercano a 0 = tranquilo, cercano a 100 = conviene revisar.
        </p>
      </dl>
    </div>
  );
}

/** Semicírculo: izquierda verde (tranquilo), derecha rojo (alerta). Índice 0–100. */
export function SpendingPaceGauge({ result, currency, venta }: Props) {
  const gradId = useId().replace(/:/g, "");
  const fmt = (n: number) => formatMoneyArs(n, currency, venta);

  return (
    <section
      className="border-border bg-card rounded-xl border p-4 md:p-5"
      aria-label="Indicador de ritmo de gasto variable"
    >
      <h2 className="mb-1 text-lg font-semibold">Ritmo de gasto (vs abril)</h2>
      <p className="text-muted-foreground mb-4 text-sm">
        Compará tu ritmo diario de gastos variables con el de tu pestaña de abril.
      </p>
      {gaugeBody(result, fmt, gradId)}
    </section>
  );
}
