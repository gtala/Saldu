import { config as loadEnv } from "dotenv";
import path from "path";

export const dynamic = "force-dynamic";

loadEnv({ path: path.join(process.cwd(), ".env.local") });
loadEnv({ path: path.join(process.cwd(), ".env") });
loadEnv({ path: path.join(process.cwd(), "..", ".env") });

type SheetsModule = {
  fetchMonthlyTotals: () => Promise<unknown>;
  default?: { fetchMonthlyTotals: () => Promise<unknown> };
};

/** Ruta estática (Turbopack no acepta import(file:// dinámico)). */
async function loadFetchMonthlyTotals(): Promise<() => Promise<unknown>> {
  const mod = (await import(
    "../../../sheets.js"
  )) as SheetsModule;
  const fn = mod.fetchMonthlyTotals ?? mod.default?.fetchMonthlyTotals;
  if (typeof fn !== "function") {
    throw new Error("sheets.js no exporta fetchMonthlyTotals");
  }
  return fn;
}

export async function GET() {
  try {
    const fetchMonthlyTotals = await loadFetchMonthlyTotals();
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
