/**
 * Prueba drive.files.copy con la misma SA y env que la app.
 * Uso: npm run copy-template-test
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { google } from "googleapis";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(__dirname, "..");

dotenv.config({ path: path.join(webRoot, "..", ".env") });
dotenv.config({ path: path.join(webRoot, ".env") });
dotenv.config({ path: path.join(webRoot, ".env.local") });

function getServiceAccountCredentials() {
  const saJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (saJson) {
    try {
      const c = JSON.parse(saJson);
      if (c.client_email && c.private_key) {
        return { client_email: c.client_email, private_key: c.private_key };
      }
    } catch {
      /* ignore */
    }
  }
  const keyFile = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (keyFile && fs.existsSync(keyFile)) {
    const c = JSON.parse(fs.readFileSync(keyFile, "utf8"));
    if (c.client_email && c.private_key) {
      return { client_email: c.client_email, private_key: c.private_key };
    }
  }
  return null;
}

function driveApiMessage(e) {
  const err = e;
  const g = err?.response?.data?.error;
  const parts = [
    g?.errors?.map((x) => x.message).filter(Boolean).join("; "),
    g?.message,
    err?.message,
  ].filter(Boolean);
  return parts[0] ?? String(e);
}

const creds = getServiceAccountCredentials();
if (!creds) {
  console.error(
    "Falta GOOGLE_SERVICE_ACCOUNT_JSON o GOOGLE_APPLICATION_CREDENTIALS."
  );
  process.exit(1);
}

const templateId =
  process.env.SALDU_TEMPLATE_SPREADSHEET_ID?.trim() ||
  process.env.GOOGLE_SHEETS_TEMPLATE_ID?.trim() ||
  "";
if (!templateId) {
  console.error("Falta SALDU_TEMPLATE_SPREADSHEET_ID (o GOOGLE_SHEETS_TEMPLATE_ID).");
  process.exit(1);
}

const parentId =
  process.env.SALDU_DRIVE_COPY_PARENT_FOLDER_ID?.trim() ||
  process.env.GOOGLE_DRIVE_COPY_PARENT_FOLDER_ID?.trim() ||
  "";

const title = `Saldu shell-test ${new Date().toISOString()}`;

console.log("SA:", creds.client_email);
console.log("Template fileId:", templateId);
if (parentId) console.log("Parent folder:", parentId);
console.log("Nuevo nombre:", title);
console.log("Copiando...\n");

const auth = new google.auth.GoogleAuth({
  credentials: creds,
  scopes: ["https://www.googleapis.com/auth/drive"],
});

const drive = google.drive({ version: "v3", auth });

const requestBody = {
  name: title.slice(0, 200),
  mimeType: "application/vnd.google-apps.spreadsheet",
  ...(parentId ? { parents: [parentId] } : {}),
};

try {
  const res = await drive.files.copy({
    fileId: templateId,
    requestBody,
    supportsAllDrives: true,
  });
  const id = res.data.id;
  if (!id) {
    console.error("Drive no devolvió id.");
    process.exit(1);
  }
  console.log("OK — copia creada.");
  console.log("id:", id);
  console.log(
    "url:",
    `https://docs.google.com/spreadsheets/d/${id}/edit`
  );
} catch (e) {
  console.error("FALLÓ:", driveApiMessage(e));
  process.exit(1);
}
