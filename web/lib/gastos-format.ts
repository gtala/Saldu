import type { MonthPayload } from "./gastos-types";

export function fmtArs(n: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(n);
}

export function fmtUsd(n: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

export function formatMoneyArs(
  ars: number,
  currency: "ARS" | "USD",
  ventaCripto: number | null | undefined
) {
  if (currency !== "USD") return fmtArs(ars);
  const v = ventaCripto;
  if (typeof v !== "number" || !Number.isFinite(v) || v <= 0) return fmtArs(ars);
  return fmtUsd(ars / v);
}

export function displayAmountFromArs(
  ars: number,
  currency: "ARS" | "USD",
  ventaCripto: number | null | undefined
): number {
  if (currency !== "USD") return Number(ars) || 0;
  const v = ventaCripto;
  if (v == null || !Number.isFinite(v) || v <= 0) return Number(ars) || 0;
  return (Number(ars) || 0) / v;
}

export function heatFill(v: number, maxV: number) {
  if (maxV <= 0) return "#1e3d32";
  const t = Math.min(1, v / maxV);
  const h = 155 - t * 118;
  const s = 38 + t * 42;
  const l = 24 + t * 18;
  return `hsl(${h} ${s}% ${l}%)`;
}

export function pickDefaultMonth(months: MonthPayload[]) {
  for (let i = months.length - 1; i >= 0; i--) {
    const m = months[i];
    if (m.error) continue;
    const hasGasto = m.categories?.some((c) => c.total > 0);
    const hasIngreso = m.totalIngresos != null && m.totalIngresos > 0;
    if (hasGasto || hasIngreso) return m.name;
  }
  if (months.length) return months[months.length - 1].name;
  return "";
}

const DICT: Record<string, string> = {
  Automóvil: "Auto",
  Vivienda: "Viv.",
  Supermercado: "Super",
  "Restaurantes y delivery": "Rest. y deliv.",
  "Servicios e impuestos": "Servicios",
  "Hogar y mantenimiento": "Hogar",
  "Ropa y calzado": "Ropa",
  "Regalos y donaciones": "Regalos",
  Suscripciones: "Suscrip.",
  Educación: "Educ.",
};

const MICRO: Record<string, string> = {
  Automóvil: "Auto",
  Vivienda: "Viv",
  Supermercado: "Sup",
  "Restaurantes y delivery": "Rest",
  "Servicios e impuestos": "Serv",
  "Hogar y mantenimiento": "Hog",
  "Ropa y calzado": "Ropa",
  "Regalos y donaciones": "Reg",
  Suscripciones: "Sus",
  Deportes: "Dep",
  Educación: "Edu",
  Transporte: "Trans",
  Salud: "Salud",
  Mascotas: "Masc",
  Otros: "Otros",
};

export function compactCategoryName(name: string, cw: number, ch: number) {
  const n = String(name || "").trim();
  const area = cw * ch;
  if (DICT[n]) return DICT[n];
  if (area < 12000 && n.length > 11) return `${n.slice(0, 9).trim()}.`;
  return n;
}

export function microCategoryName(name: string) {
  const n = String(name || "").trim();
  if (MICRO[n]) return MICRO[n];
  if (n.length <= 5) return n;
  return n.slice(0, 4);
}

export function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
