export type MonthCategory = {
  name: string;
  total: number;
  rowCount: number;
};

export type CategoryMovement = {
  fecha: string;
  descripcion: string;
  montoArs: number;
  montoOriginal: number;
  moneda: string;
};

export type MonthPayload = {
  name: string;
  total: number;
  totalIngresos: number;
  /** Filas de datos (sin header) en la pestaña del mes */
  rowCount?: number;
  categories: MonthCategory[];
  categoryDetails?: Record<string, CategoryMovement[]>;
  hasCategoryColumn?: boolean;
  incomeCategories?: MonthCategory[];
  error?: string | null;
};

export type PatrimonioSnapshot = {
  fecha: string;
  fechaSort: number;
  tc: number;
  arsLiquido: number;
  usdLiquido: number;
  btcCantidad: number;
  btcSpot: number;
  btcValorUsd: number;
  autoArs: number;
  autoUsd: number;
  nexoUsd: number;
  deudaUsd: number;
  netoUsd: number;
  notas: string;
};

export type PatrimonioData = {
  snapshots: PatrimonioSnapshot[];
  error?: string | null;
};

export type DashboardPayload = {
  months: MonthPayload[];
  spreadsheetTitle?: string;
  updatedAt?: string;
  cached?: boolean;
  fxUsdArsCripto?: number | null;
  patrimonio?: PatrimonioData;
};
