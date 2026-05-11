/** Error controlado al cargar el dashboard (la ruta API lo traduce a JSON + status). */
export class DashboardLoadError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string
  ) {
    super(message);
    this.name = "DashboardLoadError";
  }
}
