/**
 * Lee todas las pestañas del spreadsheet y suma la columna Monto por mes.
 *
 * Autenticación (en este orden):
 * 1) GOOGLE_APPLICATION_CREDENTIALS si el archivo existe
 * 2) Misma cuenta de servicio que n8n (credencial "Google Sheets account 2", tipo googleApi)
 */
const fs = require("fs");
const https = require("https");
const { google } = require("googleapis");
const { getServiceAccountFromN8n } = require("./n8n-google-sa");

const DOLAR_CRIPTO_URL = "https://dolarapi.com/v1/dolares/cripto";

function fetchDolarCriptoVenta() {
  return new Promise((resolve) => {
    const req = https.get(
      DOLAR_CRIPTO_URL,
      { headers: { Accept: "application/json", "User-Agent": "gastos-web-preview/1" } },
      (res) => {
        let body = "";
        res.on("data", (c) => {
          body += c;
        });
        res.on("end", () => {
          if (res.statusCode < 200 || res.statusCode >= 300) {
            resolve(null);
            return;
          }
          try {
            const j = JSON.parse(body);
            const v = parseFloat(j.venta);
            resolve(Number.isFinite(v) && v > 0 ? v : null);
          } catch {
            resolve(null);
          }
        });
      }
    );
    req.on("error", () => resolve(null));
    req.setTimeout(12000, () => {
      req.destroy();
      resolve(null);
    });
  });
}

function normalizeMonedaCell(cell) {
  const s = normalizeHeader(cell);
  if (!s) return "ARS";
  if (
    s === "usd" ||
    s === "u$s" ||
    s === "us$" ||
    s === "dolares" ||
    s === "dolar" ||
    s.includes("usd")
  )
    return "USD";
  return "ARS";
}

function getSpreadsheetId() {
  const id = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  if (!id || !String(id).trim()) {
    const err = new Error(
      "Falta GOOGLE_SHEETS_SPREADSHEET_ID (ID del documento de Google Sheets)."
    );
    err.code = "NO_SPREADSHEET_ID";
    throw err;
  }
  return String(id).trim();
}

const MONTH_ORDER = {
  enero: 0,
  febrero: 1,
  marzo: 2,
  abril: 3,
  mayo: 4,
  junio: 5,
  julio: 6,
  agosto: 7,
  septiembre: 8,
  octubre: 9,
  noviembre: 10,
  diciembre: 11,
};

function normalizeHeader(h) {
  return String(h || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function findColIndex(headers, ...names) {
  const normalized = headers.map((x) => normalizeHeader(x));
  for (const name of names) {
    const n = normalizeHeader(name);
    const i = normalized.findIndex((x) => x === n || x.startsWith(n));
    if (i >= 0) return i;
  }
  return -1;
}

/** Acepta 1234, 1234.5, 1.234,56 (AR), etc. */
function parseAmount(cell) {
  if (cell == null || cell === "") return 0;
  let s = String(cell).trim();
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else {
    s = s.replace(",", ".");
  }
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

/** Agrupa etiquetas viejas de la hoja en Salario / Inversiones / Otros ingresos. */
function normalizeIncomeCategoryLabel(raw) {
  const t = String(raw ?? "").trim();
  if (!t || t === "Sin categoría") return "Otros ingresos";
  const n = t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const legacy = {
    salario: "Salario",
    inversiones: "Inversiones",
    "otros ingresos": "Otros ingresos",
    "ingresos por servicios": "Otros ingresos",
    ventas: "Otros ingresos",
    honorarios: "Otros ingresos",
    reembolsos: "Otros ingresos",
  };
  if (legacy[n]) return legacy[n];
  if (/sueldo|salario|nomina|aguinaldo/i.test(t)) return "Salario";
  if (
    /dividendo|inter[eé]s|cedear|fondo|bono|acci[oó]n|crypto|bitcoin|inversi[oó]n|plazo fijo|usd mep/i.test(
      t
    )
  )
    return "Inversiones";
  return "Otros ingresos";
}

function parseSheetTitle(title) {
  const t = String(title).trim().toLowerCase();
  const m = t.match(/^([a-záéíóú]+)\s+(\d{4})$/);
  if (!m) return { year: 9999, month: 99 };
  const month = MONTH_ORDER[m[1]] ?? 99;
  const year = parseInt(m[2], 10);
  return { year, month };
}

function sortByMonthTitle(a, b) {
  const pa = parseSheetTitle(a.name);
  const pb = parseSheetTitle(b.name);
  if (pa.year !== pb.year) return pa.year - pb.year;
  return pa.month - pb.month;
}

/** Pestañas que no son "mes año" de movimientos. */
function isFixedSheetTitle(title) {
  const t = String(title || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return t === "patrimonio" || t === "config";
}

/**
 * Lee la pestaña Patrimonio (snapshots mensuales en USD).
 * @returns {{ snapshots: Array<object>, error: string | null }}
 */
async function fetchPatrimonioSnapshots(sheets, spreadsheetId) {
  try {
    const { data } = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "'Patrimonio'!A:M",
      valueRenderOption: "UNFORMATTED_VALUE",
    });
    const rows = data.values || [];
    if (rows.length < 2) {
      return { snapshots: [], error: null };
    }
    const headers = rows[0];
    const col = (...names) => findColIndex(headers, ...names);

    const iFecha = col("fecha snapshot", "fecha");
    const iTc = col("tc ars por 1 usd", "tc ars", "tc");
    const iArsLiq = col("ars liquido total", "ars líquido");
    const iUsdLiq = col("usd liquido", "usd líquido");
    const iBtcQty = col("btc (cantidad)", "btc cantidad");
    const iBtcSpot = col("btc usd (precio snapshot)", "precio snapshot", "btc usd");
    const iBtcVal = col("btc valor usd", "btc valor");
    const iAutoArs = col("auto valor ars", "auto ars");
    const iAutoUsd = col("auto usd");
    const iNexo = col("nexo + stable usd", "nexo");
    const iDeuda = col("deuda usd", "deuda");
    const iNeto = col("patrimonio neto usd", "patrimonio neto");
    const iNotas = col("notas");

    /** @type {Array<{ fecha: string, fechaSort: number, tc: number, arsLiquido: number, usdLiquido: number, btcCantidad: number, btcSpot: number, btcValorUsd: number, autoArs: number, autoUsd: number, nexoUsd: number, deudaUsd: number, netoUsd: number, notas: string }>} */
    const snapshots = [];

    function parseFecha(cell) {
      if (cell == null || cell === "") return { raw: "", sort: 0 };
      if (typeof cell === "number") {
        const epoch = new Date(Date.UTC(1899, 11, 30));
        const ms = epoch.getTime() + Math.round(cell * 86400000);
        const d = new Date(ms);
        const y = d.getUTCFullYear();
        const mo = String(d.getUTCMonth() + 1).padStart(2, "0");
        const da = String(d.getUTCDate()).padStart(2, "0");
        return { raw: `${y}-${mo}-${da}`, sort: ms };
      }
      const s = String(cell).trim();
      const t = Date.parse(s);
      if (!Number.isNaN(t)) return { raw: s, sort: t };
      const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
      if (m) {
        const d = new Date(+m[3], +m[2] - 1, +m[1]);
        return { raw: s, sort: d.getTime() };
      }
      return { raw: s, sort: 0 };
    }

    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      if (!row || row.every((c) => c === "" || c == null)) continue;

      const fp = iFecha >= 0 ? parseFecha(row[iFecha]) : { raw: "", sort: 0 };
      const neto =
        iNeto >= 0 ? parseAmount(row[iNeto]) : NaN;
      if (!fp.raw && !Number.isFinite(neto)) continue;
      if (!Number.isFinite(neto) || neto === 0) {
        const anyOther =
          (iUsdLiq >= 0 && parseAmount(row[iUsdLiq])) ||
          (iBtcVal >= 0 && parseAmount(row[iBtcVal]));
        if (!anyOther) continue;
      }

      snapshots.push({
        fecha: fp.raw || `fila ${r + 1}`,
        fechaSort: fp.sort,
        tc: iTc >= 0 ? parseAmount(row[iTc]) : 0,
        arsLiquido: iArsLiq >= 0 ? parseAmount(row[iArsLiq]) : 0,
        usdLiquido: iUsdLiq >= 0 ? parseAmount(row[iUsdLiq]) : 0,
        btcCantidad: iBtcQty >= 0 ? parseAmount(row[iBtcQty]) : 0,
        btcSpot: iBtcSpot >= 0 ? parseAmount(row[iBtcSpot]) : 0,
        btcValorUsd: iBtcVal >= 0 ? parseAmount(row[iBtcVal]) : 0,
        autoArs: iAutoArs >= 0 ? parseAmount(row[iAutoArs]) : 0,
        autoUsd: iAutoUsd >= 0 ? parseAmount(row[iAutoUsd]) : 0,
        nexoUsd: iNexo >= 0 ? parseAmount(row[iNexo]) : 0,
        deudaUsd: iDeuda >= 0 ? parseAmount(row[iDeuda]) : 0,
        netoUsd: Number.isFinite(neto) ? Math.round(neto * 100) / 100 : 0,
        notas: iNotas >= 0 && row[iNotas] != null ? String(row[iNotas]) : "",
      });
    }

    snapshots.sort((a, b) => (a.fechaSort || 0) - (b.fechaSort || 0));
    return { snapshots, error: null };
  } catch (e) {
    const msg = String(e.message || e);
    if (/Unable to parse range|not found|400/i.test(msg)) {
      return { snapshots: [], error: "sin_pestana_patrimonio" };
    }
    return { snapshots: [], error: msg };
  }
}

let cache = { at: 0, ttlMs: 10_000, data: null };

async function getClient() {
  // 1. Credenciales como JSON string (Vercel y otros PaaS sin filesystem)
  const saJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (saJson) {
    try {
      const credentials = JSON.parse(saJson);
      const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
      });
      return google.sheets({ version: "v4", auth });
    } catch (e) {
      console.error("[sheets] GOOGLE_SERVICE_ACCOUNT_JSON inválido:", e.message);
    }
  }

  // 2. Ruta a archivo de Service Account (servidor con filesystem)
  const keyFile = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (keyFile && fs.existsSync(keyFile)) {
    const auth = new google.auth.GoogleAuth({
      keyFile,
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    });
    return google.sheets({ version: "v4", auth });
  }

  // 3. Service Account desde DB de n8n (Docker)
  const n8nSa = getServiceAccountFromN8n();
  if (n8nSa) {
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: n8nSa.client_email,
        private_key: n8nSa.private_key,
      },
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    });
    return google.sheets({ version: "v4", auth });
  }

  return null;
}

async function fetchMonthlyTotals() {
  const now = Date.now();
  if (cache.data && now - cache.at < cache.ttlMs) {
    return { ...cache.data, cached: true };
  }

  const sheets = await getClient();
  if (!sheets) {
    const err = new Error("NO_CREDS");
    err.code = "NO_CREDS";
    throw err;
  }

  const usdVentaArs = await fetchDolarCriptoVenta();

  const spreadsheetId = getSpreadsheetId();

  const { data: meta } = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "properties.title,sheets(properties(title))",
  });

  const titles = (meta.sheets || [])
    .map((s) => s.properties && s.properties.title)
    .filter(Boolean);

  const months = [];

  for (const title of titles) {
    if (isFixedSheetTitle(title)) continue;
    const escaped = String(title).replace(/'/g, "''");
    const range = `'${escaped}'!A:Z`;
    let rows;
    try {
      const { data: valData } = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range,
      });
      rows = valData.values || [];
    } catch (e) {
      months.push({
        name: title,
        total: 0,
        totalIngresos: 0,
        incomeCategories: [],
        rowCount: 0,
        categories: [],
        hasCategoryColumn: false,
        error: "lectura",
      });
      continue;
    }

    if (rows.length === 0) {
      months.push({
        name: title,
        total: 0,
        totalIngresos: 0,
        incomeCategories: [],
        rowCount: 0,
        categories: [],
        hasCategoryColumn: false,
        error: null,
      });
      continue;
    }

    const headers = rows[0];
    const montoIdx = findColIndex(headers, "monto", "importe");
    if (montoIdx < 0) {
      months.push({
        name: title,
        total: 0,
        totalIngresos: 0,
        incomeCategories: [],
        rowCount: Math.max(0, rows.length - 1),
        categories: [],
        hasCategoryColumn: false,
        error: "sin_columna_monto",
      });
      continue;
    }

    const catIdx = findColIndex(
      headers,
      "categoría",
      "categoria",
      "category",
      "rubro"
    );
    const tipoIdx = findColIndex(headers, "tipo");
    const fechaIdx = findColIndex(headers, "fecha");
    const descIdx = findColIndex(headers, "descripción", "descripcion", "detalle", "concepto");
    const monedaIdx = findColIndex(headers, "moneda", "currency", "divisa");

    function rowTipo(row) {
      if (tipoIdx < 0) return "gasto";
      const t = normalizeHeader(row[tipoIdx]);
      if (!t) return "gasto";
      if (t === "ingreso") return "ingreso";
      return "gasto";
    }

    let total = 0;
    let totalIngresos = 0;
    let rowCount = 0;
    /** @type {Record<string, { total: number; rowCount: number }>} */
    const byCat = {};
    /** @type {Record<string, Array<{ fecha: string, descripcion: string, montoArs: number, montoOriginal: number, moneda: string }>>} */
    const byCatDetails = {};
    /** @type {Record<string, { total: number; rowCount: number }>} */
    const byIncomeCat = {};

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.every((c) => c === "" || c == null)) continue;
      const rawAmt = parseAmount(row[montoIdx]);
      const moneda =
        monedaIdx >= 0 ? normalizeMonedaCell(row[monedaIdx]) : "ARS";
      const amt =
        moneda === "USD" && usdVentaArs != null && usdVentaArs > 0
          ? rawAmt * usdVentaArs
          : rawAmt;
      rowCount++;

      const rt = rowTipo(row);
      if (rt === "ingreso") {
        totalIngresos += amt;
        let ilabel = "Otros ingresos";
        if (catIdx >= 0 && row[catIdx] != null && String(row[catIdx]).trim() !== "") {
          ilabel = normalizeIncomeCategoryLabel(String(row[catIdx]).trim());
        }
        if (!byIncomeCat[ilabel]) byIncomeCat[ilabel] = { total: 0, rowCount: 0 };
        byIncomeCat[ilabel].total += amt;
        byIncomeCat[ilabel].rowCount += 1;
        continue;
      }

      total += amt;

      let label = "Sin categoría";
      if (catIdx >= 0 && row[catIdx] != null && String(row[catIdx]).trim() !== "") {
        label = String(row[catIdx]).trim();
      }
      if (!byCat[label]) byCat[label] = { total: 0, rowCount: 0 };
      byCat[label].total += amt;
      byCat[label].rowCount += 1;
      if (!byCatDetails[label]) byCatDetails[label] = [];
      byCatDetails[label].push({
        fecha:
          fechaIdx >= 0 && row[fechaIdx] != null
            ? String(row[fechaIdx]).trim()
            : "",
        descripcion:
          descIdx >= 0 && row[descIdx] != null ? String(row[descIdx]).trim() : "",
        montoArs: Math.round(amt * 100) / 100,
        montoOriginal: Math.round(rawAmt * 100) / 100,
        moneda,
      });
    }

    const categories = Object.keys(byCat)
      .map((name) => ({
        name,
        total: Math.round(byCat[name].total * 100) / 100,
        rowCount: byCat[name].rowCount,
      }))
      .sort((a, b) => b.total - a.total);

    const incomeCategories = Object.keys(byIncomeCat)
      .map((name) => ({
        name,
        total: Math.round(byIncomeCat[name].total * 100) / 100,
        rowCount: byIncomeCat[name].rowCount,
      }))
      .sort((a, b) => b.total - a.total);

    /** @type {Record<string, Array<{ fecha: string, descripcion: string, montoArs: number, montoOriginal: number, moneda: string }>>} */
    const categoryDetails = {};
    for (const k of Object.keys(byCatDetails)) {
      categoryDetails[k] = byCatDetails[k]
        .slice()
        .sort((a, b) => b.montoArs - a.montoArs)
        .slice(0, 120);
    }

    months.push({
      name: title,
      total: Math.round(total * 100) / 100,
      totalIngresos: Math.round(totalIngresos * 100) / 100,
      incomeCategories,
      rowCount,
      categories,
      categoryDetails,
      hasCategoryColumn: catIdx >= 0,
      error: null,
    });
  }

  months.sort(sortByMonthTitle);

  const patrimonio = await fetchPatrimonioSnapshots(sheets, spreadsheetId);

  const payload = {
    spreadsheetId,
    spreadsheetTitle: meta.properties && meta.properties.title,
    months,
    patrimonio,
    /** Cotización dólar cripto (venta) usada para pasar USD→ARS en totales; null si falló la API */
    fxUsdArsCripto: usdVentaArs,
    updatedAt: new Date().toISOString(),
    cached: false,
  };

  cache = { at: now, ttlMs: cache.ttlMs, data: payload };
  return payload;
}

module.exports = { fetchMonthlyTotals, getClient, fetchPatrimonioSnapshots };
