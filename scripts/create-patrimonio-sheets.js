/**
 * Crea las pestañas "Patrimonio" y "Config", y carga el primer snapshot (fila de datos).
 *
 * Uso (desde gastos-web-preview):
 *   node scripts/create-patrimonio-sheets.js
 *
 * Auth: GOOGLE_APPLICATION_CREDENTIALS o cuenta de servicio vía Docker+n8n (ver README implícito).
 */
const fs = require("fs");
const { google } = require("googleapis");
const { getServiceAccountFromN8n } = require("../n8n-google-sa");

const SPREADSHEET_ID =
  process.env.GOOGLE_SHEETS_SPREADSHEET_ID ||
  "1kAb3PXuGBbNgdMvTGLrwYojRiHXz9qSzpA8f78A-G3g";

const SCOPES_WRITE = ["https://www.googleapis.com/auth/spreadsheets"];

async function getSheetsWrite() {
  const keyFile = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (keyFile && fs.existsSync(keyFile)) {
    const auth = new google.auth.GoogleAuth({
      keyFile,
      scopes: SCOPES_WRITE,
    });
    return google.sheets({ version: "v4", auth });
  }
  const n8nSa = getServiceAccountFromN8n();
  if (n8nSa) {
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: n8nSa.client_email,
        private_key: n8nSa.private_key,
      },
      scopes: SCOPES_WRITE,
    });
    return google.sheets({ version: "v4", auth });
  }
  throw new Error(
    "Sin credenciales: definí GOOGLE_APPLICATION_CREDENTIALS o tené Docker+n8n con la credencial de Sheets."
  );
}

async function main() {
  const sheets = await getSheetsWrite();
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const existing = new Map(
    (meta.data.sheets || []).map((s) => [
      (s.properties && s.properties.title) || "",
      s.properties.sheetId,
    ])
  );

  const requests = [];
  if (!existing.has("Patrimonio")) {
    requests.push({
      addSheet: {
        properties: { title: "Patrimonio", gridProperties: { frozenRowCount: 1 } },
      },
    });
  }
  if (!existing.has("Config")) {
    requests.push({
      addSheet: {
        properties: { title: "Config", gridProperties: { frozenRowCount: 1 } },
      },
    });
  }

  if (requests.length) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: { requests },
    });
    console.log(
      "Pestañas creadas:",
      requests.map((r) => r.addSheet.properties.title).join(", ")
    );
  } else {
    console.log("Pestañas OK (Patrimonio / Config). Actualizo encabezados y primer snapshot.");
  }

  /** A–M: liquidez ARS = caja ahorro + efectivo; neto = USD líq + BTC + auto USD + NEXO − deuda */
  const headers = [
    [
      "Fecha snapshot",
      "TC ARS por 1 USD",
      "ARS líquido total",
      "USD líquido",
      "BTC (cantidad)",
      "BTC USD (precio snapshot)",
      "BTC valor USD",
      "Auto valor ARS",
      "Auto USD",
      "NEXO + stable USD",
      "Deuda USD",
      "Patrimonio neto USD",
      "Notas",
    ],
  ];

  const ARS_LIQUIDO = 1763255 + 86132 + 2000000;
  const TC = 1433;
  const BTC_QTY = 0.6318;
  const BTC_SPOT = 69234;
  const AUTO_ARS = 30000000;
  const NEXO_Y_STABLE = 13240 + 2240;
  const DEUDA_USD = 1500;

  const nota =
    "Primer snapshot. Caja+ahorro 1.763.255+86.132 + efectivo 2M ARS. BTC spot 69.234 USD/BTC. NEXO invertido 13.240 + tokens ~2.240 USDT.";

  const rowSnapshot = [
    "2026-04-05",
    TC,
    ARS_LIQUIDO,
    "=C2/B2",
    BTC_QTY,
    BTC_SPOT,
    "=E2*F2",
    AUTO_ARS,
    "=H2/B2",
    NEXO_Y_STABLE,
    DEUDA_USD,
    "=D2+G2+I2+J2-K2",
    nota,
  ];

  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: "Patrimonio!A1:M2",
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [headers[0], rowSnapshot] },
  });

  const configBlock = [
    ["Clave", "Valor"],
    ["Moneda de reporte (patrimonio)", "USD"],
    [
      "Ayuda TC",
      "TC = ARS por 1 USD. ARS líquido = caja + efectivo. Patrimonio neto = USD líquido + BTC USD + Auto USD + NEXO/stable − deuda.",
    ],
    ["Último snapshot cargado por script", "2026-04-05"],
  ];

  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: "Config!A1:B4",
    valueInputOption: "USER_ENTERED",
    requestBody: { values: configBlock },
  });

  console.log("Listo: Patrimonio fila 1 encabezados, fila 2 = snapshot 2026-04-05.");
  console.log(
    "Abrí:",
    `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/edit`
  );
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
