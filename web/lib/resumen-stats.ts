import type { MonthPayload } from "./gastos-types";

/** Categorías que solemos tratar como “casi fijas” (heurística; ajustable). */
const FIXED_CATEGORY_RES = [
  /^suscripciones$/i,
  /^servicios e impuestos$/i,
  /^vivienda$/i,
  /^educacion$/i,
];

function normCat(name: string) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function isLikelyFixedCategory(name: string): boolean {
  const k = normCat(name);
  return FIXED_CATEGORY_RES.some((re) => re.test(k));
}

export type ResumenStatsForApi = {
  monthName: string;
  totalGastosArs: number;
  totalIngresosArs: number;
  balanceArs: number;
  rowCount: number;
  avgDailyGastoArs: number | null;
  topCategories: { name: string; totalArs: number; pctOfGastos: number }[];
  fixedLikeArs: number;
  variableLikeArs: number;
  fixedCategoryNames: string[];
  prevMonthName: string | null;
  prevTotalGastosArs: number | null;
  gastosDeltaPctVsPrev: number | null;
};

export function buildResumenStats(
  month: MonthPayload,
  prevMonth: MonthPayload | null
): ResumenStatsForApi {
  const totalGastos = Number(month.total) || 0;
  const totalIngresos = Number(month.totalIngresos) || 0;
  const balance = totalIngresos - totalGastos;
  const cats = [...(month.categories || [])].sort((a, b) => b.total - a.total);

  const topCategories = cats.slice(0, 12).map((c) => ({
    name: c.name,
    totalArs: Math.round(c.total * 100) / 100,
    pctOfGastos:
      totalGastos > 0
        ? Math.round((c.total / totalGastos) * 1000) / 10
        : 0,
  }));

  let fixedLikeArs = 0;
  const fixedCategoryNames: string[] = [];
  for (const c of cats) {
    if (isLikelyFixedCategory(c.name)) {
      fixedLikeArs += c.total;
      fixedCategoryNames.push(c.name);
    }
  }
  fixedLikeArs = Math.round(fixedLikeArs * 100) / 100;
  const variableLikeArs = Math.max(
    0,
    Math.round((totalGastos - fixedLikeArs) * 100) / 100
  );

  let prevMonthName: string | null = null;
  let prevTotalGastosArs: number | null = null;
  let gastosDeltaPctVsPrev: number | null = null;
  if (prevMonth && !prevMonth.error) {
    prevMonthName = prevMonth.name;
    prevTotalGastosArs = Math.round((Number(prevMonth.total) || 0) * 100) / 100;
    if (prevTotalGastosArs > 0) {
      gastosDeltaPctVsPrev =
        Math.round(
          ((totalGastos - prevTotalGastosArs) / prevTotalGastosArs) * 1000
        ) / 10;
    }
  }

  const avg =
    month.avgDailyGastoArs != null && Number.isFinite(month.avgDailyGastoArs)
      ? Math.round(month.avgDailyGastoArs * 100) / 100
      : null;

  return {
    monthName: month.name,
    totalGastosArs: Math.round(totalGastos * 100) / 100,
    totalIngresosArs: Math.round(totalIngresos * 100) / 100,
    balanceArs: Math.round(balance * 100) / 100,
    rowCount: month.rowCount ?? 0,
    avgDailyGastoArs: avg,
    topCategories,
    fixedLikeArs,
    variableLikeArs,
    fixedCategoryNames,
    prevMonthName,
    prevTotalGastosArs,
    gastosDeltaPctVsPrev,
  };
}
