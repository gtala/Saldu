import type { DashboardPayload } from "@/lib/gastos-types";
import { getTemplateSpreadsheetIdFromEnv } from "@/lib/provision-user-sheet";
import { getUserSheetRecord } from "@/lib/user-sheet-redis";
import { DashboardLoadError } from "./dashboard-load-error";

type SheetsModule = {
  fetchMonthlyTotals: (opts?: { spreadsheetId?: string }) => Promise<unknown>;
  clearCache?: (spreadsheetId?: string) => void;
  getSpreadsheetId?: (override?: string) => string;
  default?: {
    fetchMonthlyTotals: (opts?: { spreadsheetId?: string }) => Promise<unknown>;
    clearCache?: (spreadsheetId?: string) => void;
    getSpreadsheetId?: (override?: string) => string;
  };
};

async function loadSheetsModule(): Promise<SheetsModule> {
  return (await import("../../sheets.js")) as SheetsModule;
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

/** Asegura el mínimo que la UI espera; el resto viene de Sheets. */
function asDashboardPayload(raw: unknown): DashboardPayload {
  if (!isRecord(raw) || !Array.isArray(raw.months)) {
    throw new DashboardLoadError(
      "Respuesta inválida del lector de Sheets (falta months).",
      500,
      "INVALID_SHEETS_PAYLOAD"
    );
  }
  return raw as DashboardPayload;
}

export async function loadDashboardFromSheets(ctx: {
  wantFresh: boolean;
  googleSub: string | null;
  isMultiUser: boolean;
}): Promise<DashboardPayload> {
  const mod = await loadSheetsModule();
  const clear = mod.clearCache ?? mod.default?.clearCache;
  const getSpreadsheetId =
    mod.getSpreadsheetId ?? mod.default?.getSpreadsheetId;
  const fetchMonthlyTotals =
    mod.fetchMonthlyTotals ?? mod.default?.fetchMonthlyTotals;

  if (typeof fetchMonthlyTotals !== "function") {
    throw new DashboardLoadError(
      "sheets.js no exporta fetchMonthlyTotals",
      500,
      "SHEETS_MODULE_INVALID"
    );
  }

  if (ctx.wantFresh && typeof clear === "function") {
    if (ctx.isMultiUser && ctx.googleSub) {
      const rec = await getUserSheetRecord(ctx.googleSub);
      if (rec?.sheetId) clear(rec.sheetId);
      else clear();
    } else if (typeof getSpreadsheetId === "function") {
      try {
        clear(getSpreadsheetId());
      } catch {
        clear();
      }
    } else {
      clear();
    }
  }

  let raw: unknown;
  if (ctx.isMultiUser && ctx.googleSub) {
    const rec = await getUserSheetRecord(ctx.googleSub);
    if (!rec?.sheetId) {
      throw new DashboardLoadError(
        "Aún no hay planilla asignada. Esperá a que termine el aprovisionamiento.",
        409,
        "NO_USER_SHEET"
      );
    }
    const templateId = getTemplateSpreadsheetIdFromEnv();
    if (
      templateId &&
      rec.sheetId.trim() === String(templateId).trim()
    ) {
      throw new DashboardLoadError(
        "La sesión apuntaba a la plantilla compartida, no a tu copia. Recargá la página (se corrige solo).",
        409,
        "SHEET_POINTS_AT_TEMPLATE"
      );
    }
    raw = await fetchMonthlyTotals({ spreadsheetId: rec.sheetId });
  } else {
    raw = await fetchMonthlyTotals();
  }

  return asDashboardPayload(raw);
}
