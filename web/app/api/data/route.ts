import { config as loadEnv } from "dotenv";
import path from "path";

export const dynamic = "force-dynamic";

loadEnv({ path: path.join(process.cwd(), ".env.local") });
loadEnv({ path: path.join(process.cwd(), ".env") });
loadEnv({ path: path.join(process.cwd(), "..", ".env") });

type SheetsModule = {
  fetchMonthlyTotals: () => Promise<unknown>;
  clearCache?: () => void;
  default?: { fetchMonthlyTotals: () => Promise<unknown>; clearCache?: () => void };
};

/** Ruta estática (Turbopack no acepta import(file:// dinámico)). */
async function loadSheetsModule(): Promise<SheetsModule> {
  return (await import("../../../sheets.js")) as SheetsModule;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const wantFresh = url.searchParams.has("fresh");

    const mod = await loadSheetsModule();
    if (wantFresh) {
      const clear = mod.clearCache ?? mod.default?.clearCache;
      if (typeof clear === "function") clear();
    }

    const fetchMonthlyTotals =
      mod.fetchMonthlyTotals ?? mod.default?.fetchMonthlyTotals;
    if (typeof fetchMonthlyTotals !== "function") {
      throw new Error("sheets.js no exporta fetchMonthlyTotals");
    }
    const data = await fetchMonthlyTotals();
    return Response.json(data, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (e: unknown) {
    const err = e as { code?: string; message?: string };
    const code = err.code;
    const status =
      code === "NO_CREDS" || code === "NO_SPREADSHEET_ID" ? 503 : 500;
    return Response.json(
      {
        error: err.message || "Error al leer Google Sheets",
        code: code ?? null,
      },
      { status }
    );
  }
}
