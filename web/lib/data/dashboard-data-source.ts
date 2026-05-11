export type DashboardDataSource = "sheets" | "neon";

/**
 * Origen de datos del dashboard.
 * - `sheets` (default): Google Sheets vía `sheets.js`.
 * - `neon`: Postgres (Neon); hoy lanza hasta que exista el repositorio SQL.
 *
 * Valores aceptados: sheets | neon | postgres | postgresql (los dos últimos → neon).
 */
export function getDashboardDataSource(): DashboardDataSource {
  const raw =
    process.env.SALDU_DASHBOARD_DATA_SOURCE?.trim().toLowerCase() ?? "";
  if (
    raw === "neon" ||
    raw === "postgres" ||
    raw === "postgresql" ||
    raw === "pg"
  ) {
    return "neon";
  }
  return "sheets";
}
