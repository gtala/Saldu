import type { MonthPayload } from "./gastos-types";
import { isLikelyFixedCategory } from "./resumen-stats";

const AR_TZ = "America/Argentina/Buenos_Aires";

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

function daysInCalendarMonth(year: number, month0: number): number {
  return new Date(year, month0 + 1, 0).getDate();
}

export function parseSheetMonthTitle(
  title: string
): { year: number; month0: number } | null {
  const raw = String(title || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const m = raw.match(/^([a-z]+)\s+(\d{4})$/);
  if (!m) return null;
  const month0 = MONTH_ORDER[m[1]];
  if (month0 === undefined) return null;
  const year = parseInt(m[2], 10);
  if (!Number.isFinite(year)) return null;
  return { year, month0 };
}

function ymOrder(y: number, m0: number): number {
  return y * 12 + m0;
}

/** Gastos “variables” = total − categorías heurísticas fijas (misma regla que Resumen). */
export function variableLikeFromMonth(month: MonthPayload): number {
  const cats = month.categories ?? [];
  let fixed = 0;
  for (const c of cats) {
    if (isLikelyFixedCategory(c.name)) fixed += Number(c.total) || 0;
  }
  const total = Number(month.total) || 0;
  return Math.max(0, Math.round((total - fixed) * 100) / 100);
}

export function calendarNowInAr(now = new Date()): {
  year: number;
  month0: number;
  day: number;
} {
  const y = parseInt(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: AR_TZ,
      year: "numeric",
    }).format(now),
    10
  );
  const month0 =
    parseInt(
      new Intl.DateTimeFormat("en-CA", {
        timeZone: AR_TZ,
        month: "numeric",
      }).format(now),
      10
    ) - 1;
  const day = parseInt(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: AR_TZ,
      day: "numeric",
    }).format(now),
    10
  );
  return { year: y, month0, day };
}

function cmpYm(
  a: { year: number; month0: number },
  b: { year: number; month0: number }
): number {
  if (a.year !== b.year) return a.year - b.year;
  return a.month0 - b.month0;
}

/**
 * Día efectivo para el ritmo diario: mes pasado → último día; mes futuro → 1;
 * mes actual (AR) → día de hoy acotado al mes.
 */
export function effectiveDayForPace(
  sheetMeta: { year: number; month0: number },
  daysInMonth: number,
  nowAr = calendarNowInAr()
): number {
  const dim = Math.max(1, Math.min(31, daysInMonth));
  const c = cmpYm(sheetMeta, nowAr);
  if (c < 0) return dim;
  if (c > 0) return 1;
  return Math.max(1, Math.min(nowAr.day, dim));
}

/**
 * Pestaña “Abril AAAA” más útil como referencia: mismo año que el mes elegido,
 * o el abril más reciente anterior o igual al mes elegido, o cualquier abril.
 */
export function findAprilReferenceMonth(
  months: MonthPayload[],
  selectedMeta: { year: number; month0: number }
): MonthPayload | null {
  const valid = months.filter((m) => !m.error);
  const abriles = valid
    .map((m) => ({ m, p: parseSheetMonthTitle(m.name) }))
    .filter(
      (x): x is { m: MonthPayload; p: { year: number; month0: number } } =>
        x.p !== null && x.p.month0 === 3
    );
  if (!abriles.length) return null;

  const sameY = abriles.find((x) => x.p.year === selectedMeta.year);
  if (sameY) return sameY.m;

  const selectedOrd = ymOrder(selectedMeta.year, selectedMeta.month0);
  const beforeOrEq = abriles.filter(
    (x) => ymOrder(x.p.year, x.p.month0) <= selectedOrd
  );
  if (beforeOrEq.length) {
    return beforeOrEq.sort(
      (a, b) => ymOrder(b.p.year, b.p.month0) - ymOrder(a.p.year, a.p.month0)
    )[0].m;
  }

  return abriles.sort(
    (a, b) => ymOrder(b.p.year, b.p.month0) - ymOrder(a.p.year, a.p.month0)
  )[0].m;
}

export type SpendingPaceResult =
  | {
      kind: "ok";
      index: number;
      label: string;
      ratio: number;
      variableSoFar: number;
      refVariableTotal: number;
      refMonthName: string;
      effectiveDay: number;
      daysInMonth: number;
      refAvgDailyVariable: number;
      currentAvgDailyVariable: number;
    }
  | { kind: "no_april" }
  | { kind: "no_data" }
  | { kind: "same_as_reference" };

export function computeSpendingPaceIndex(
  month: MonthPayload,
  allMonths: MonthPayload[],
  nowAr = calendarNowInAr()
): SpendingPaceResult {
  if (month.error) return { kind: "no_data" };
  const meta = parseSheetMonthTitle(month.name);
  if (!meta) return { kind: "no_data" };

  const ref = findAprilReferenceMonth(allMonths, meta);
  if (!ref) return { kind: "no_april" };
  if (ref.name === month.name) return { kind: "same_as_reference" };

  const dim =
    month.daysInMonth ?? daysInCalendarMonth(meta.year, meta.month0);
  const effectiveDay = effectiveDayForPace(meta, dim, nowAr);
  const variableSoFar = variableLikeFromMonth(month);

  const refParsed = parseSheetMonthTitle(ref.name);
  const refDim =
    ref.daysInMonth ??
    (refParsed
      ? daysInCalendarMonth(refParsed.year, refParsed.month0)
      : 30);
  const refVariableTotal = variableLikeFromMonth(ref);

  if (refVariableTotal <= 0 || refDim <= 0) {
    return {
      kind: "ok",
      index: 50,
      label: "Sin gasto variable en abril",
      ratio: 1,
      variableSoFar,
      refVariableTotal,
      refMonthName: ref.name,
      effectiveDay,
      daysInMonth: dim,
      refAvgDailyVariable: 0,
      currentAvgDailyVariable:
        effectiveDay > 0 ? variableSoFar / effectiveDay : 0,
    };
  }

  const refAvgDailyVariable = refVariableTotal / refDim;
  const currentAvgDailyVariable = variableSoFar / effectiveDay;
  const ratio =
    refAvgDailyVariable > 0
      ? currentAvgDailyVariable / refAvgDailyVariable
      : 1;

  const index = Math.round(clamp(50 + (ratio - 1) * 55, 0, 100));

  let label: string;
  if (index <= 22) label = "Tranquilo";
  else if (index <= 40) label = "En calma";
  else if (index <= 55) label = "En ritmo";
  else if (index <= 72) label = "Atención";
  else label = "Alerta";

  return {
    kind: "ok",
    index,
    label,
    ratio: Math.round(ratio * 1000) / 1000,
    variableSoFar,
    refVariableTotal,
    refMonthName: ref.name,
    effectiveDay,
    daysInMonth: dim,
    refAvgDailyVariable: Math.round(refAvgDailyVariable * 100) / 100,
    currentAvgDailyVariable:
      Math.round(currentAvgDailyVariable * 100) / 100,
  };
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}
