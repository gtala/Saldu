import type { DashboardPayload } from "@/lib/gastos-types";
import { getDashboardDataSource } from "./dashboard-data-source";
import { loadDashboardFromNeon } from "./load-dashboard-from-neon";
import { loadDashboardFromSheets } from "./load-dashboard-from-sheets";

export type LoadDashboardPayloadContext = {
  /** Si true, invalida caché en memoria de Sheets antes de leer. */
  wantFresh: boolean;
  /** `sub` de Google cuando modo multi-usuario; null en legacy. */
  googleSub: string | null;
  isMultiUser: boolean;
};

/**
 * Única entrada server-side para el payload del dashboard.
 * Hoy: Sheets. Mañana: misma firma, rama `neon` con queries a Postgres.
 */
export async function loadDashboardPayload(
  ctx: LoadDashboardPayloadContext
): Promise<DashboardPayload> {
  const source = getDashboardDataSource();
  if (source === "neon") {
    return loadDashboardFromNeon({
      googleSub: ctx.googleSub,
      isMultiUser: ctx.isMultiUser,
    });
  }
  return loadDashboardFromSheets(ctx);
}

export { DashboardLoadError } from "./dashboard-load-error";
export { getDashboardDataSource } from "./dashboard-data-source";
export type { DashboardDataSource } from "./dashboard-data-source";
