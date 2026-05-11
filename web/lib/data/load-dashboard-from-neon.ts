import type { DashboardPayload } from "@/lib/gastos-types";
import { DashboardLoadError } from "./dashboard-load-error";

/**
 * Punto de entrada futuro: Neon / Postgres (`DATABASE_URL`).
 * Por ahora falla de forma explícita para poder cablear el flag sin romper el build.
 */
export async function loadDashboardFromNeon(_ctx: {
  googleSub: string | null;
  isMultiUser: boolean;
}): Promise<DashboardPayload> {
  if (!process.env.DATABASE_URL?.trim()) {
    throw new DashboardLoadError(
      "Con SALDU_DASHBOARD_DATA_SOURCE=neon hace falta DATABASE_URL (connection string de Neon u otro Postgres).",
      503,
      "NO_DATABASE_URL"
    );
  }
  throw new DashboardLoadError(
    "Origen Neon/Postgres aún no implementado. Dejá SALDU_DASHBOARD_DATA_SOURCE=sheets o implementá la lectura en load-dashboard-from-neon.ts.",
    501,
    "DATA_SOURCE_NEON_NOT_IMPLEMENTED"
  );
}
