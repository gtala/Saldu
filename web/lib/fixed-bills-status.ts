import type { MonthPayload } from "./gastos-types";
import { isLikelyFixedCategory } from "./resumen-stats";

export type FixedBillStatus = "pagado" | "parcial" | "pendiente";

export type FixedBillRow = {
  categoryName: string;
  /** Referencia: total de esa categoría el mes pasado (ARS). */
  expectedArs: number;
  /** Acumulado en el mes actual en la misma categoría (ARS). */
  paidArs: number;
  /** max(0, expected − paid). */
  remainingArs: number;
  ratioPaid: number;
  status: FixedBillStatus;
  prevMovementCount: number;
};

export type FixedBillsSnapshot =
  | {
      kind: "ok";
      referenceMonthName: string;
      currentMonthName: string;
      rows: FixedBillRow[];
      totalExpectedArs: number;
      totalPaidArs: number;
      totalRemainingArs: number;
    }
  | { kind: "no_prev" }
  | { kind: "empty" };

function categoryTotal(month: MonthPayload, name: string): number {
  const c = month.categories?.find((x) => x.name === name);
  return Math.round((Number(c?.total) || 0) * 100) / 100;
}

/**
 * Heurística: ≥92 % del mes pasado o casi el monto completo → pagado;
 * casi nada → pendiente; resto parcial.
 */
export function inferFixedBillStatus(
  expectedArs: number,
  paidArs: number
): FixedBillStatus {
  if (expectedArs <= 0) return "pagado";
  const r = paidArs / expectedArs;
  if (r >= 0.92 || paidArs >= expectedArs - 100) return "pagado";
  if (paidArs <= 0 || r < 0.06) return "pendiente";
  return "parcial";
}

export function buildFixedBillsSnapshot(
  current: MonthPayload,
  prev: MonthPayload | null
): FixedBillsSnapshot {
  if (!prev || prev.error || current.error) return { kind: "no_prev" };

  const rows: FixedBillRow[] = [];
  for (const cat of prev.categories ?? []) {
    if (!isLikelyFixedCategory(cat.name)) continue;
    const expectedArs = Math.round((Number(cat.total) || 0) * 100) / 100;
    if (expectedArs <= 0) continue;

    const paidArs = categoryTotal(current, cat.name);
    const remainingArs = Math.max(0, expectedArs - paidArs);
    const ratioPaid = expectedArs > 0 ? paidArs / expectedArs : 0;
    const details = prev.categoryDetails?.[cat.name];
    const prevMovementCount =
      typeof details?.length === "number"
        ? details.length
        : Number(cat.rowCount) || 0;

    rows.push({
      categoryName: cat.name,
      expectedArs,
      paidArs,
      remainingArs,
      ratioPaid,
      status: inferFixedBillStatus(expectedArs, paidArs),
      prevMovementCount,
    });
  }

  rows.sort((a, b) => {
    const order: Record<FixedBillStatus, number> = {
      pendiente: 0,
      parcial: 1,
      pagado: 2,
    };
    if (order[a.status] !== order[b.status])
      return order[a.status] - order[b.status];
    return b.remainingArs - a.remainingArs;
  });

  if (!rows.length) return { kind: "empty" };

  const totalExpectedArs = Math.round(
    rows.reduce((s, x) => s + x.expectedArs, 0) * 100
  ) / 100;
  const totalPaidArs =
    Math.round(rows.reduce((s, x) => s + x.paidArs, 0) * 100) / 100;
  const totalRemainingArs =
    Math.round(rows.reduce((s, x) => s + x.remainingArs, 0) * 100) / 100;

  return {
    kind: "ok",
    referenceMonthName: prev.name,
    currentMonthName: current.name,
    rows,
    totalExpectedArs,
    totalPaidArs,
    totalRemainingArs,
  };
}
