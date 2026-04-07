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
  categories: MonthCategory[];
  categoryDetails?: Record<string, CategoryMovement[]>;
  hasCategoryColumn?: boolean;
  incomeCategories?: MonthCategory[];
  error?: string | null;
};

export type DashboardPayload = {
  months: MonthPayload[];
  spreadsheetTitle?: string;
  updatedAt?: string;
  cached?: boolean;
  fxUsdArsCripto?: number | null;
};
