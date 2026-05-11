/**
 * Lista planillas en el Google Drive de la SERVICE ACCOUNT (no tu Gmail).
 * Uso desde la carpeta web/:  npm run list-sa-sheets
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

const creds = getServiceAccountCredentials();
if (!creds) {
  console.error(
    "Falta credencial: GOOGLE_SERVICE_ACCOUNT_JSON o GOOGLE_APPLICATION_CREDENTIALS."
  );
  process.exit(1);
}

console.log("Service account:", creds.client_email);
console.log("(Los archivos listados son del Drive de esa cuenta, no de tu Gmail.)\n");

const auth = new google.auth.GoogleAuth({
  credentials: creds,
  scopes: ["https://www.googleapis.com/auth/drive.readonly"],
});

const drive = google.drive({ version: "v3", auth });

const q = [
  "mimeType = 'application/vnd.google-apps.spreadsheet'",
  "trashed = false",
].join(" and ");

let pageToken;
let total = 0;
do {
  const res = await drive.files.list({
    q,
    pageSize: 100,
    pageToken,
    fields: "nextPageToken, files(id, name, createdTime, webViewLink)",
    orderBy: "createdTime desc",
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  const files = res.data.files ?? [];
  for (const f of files) {
    total++;
    const mark = f.name?.includes("Saldu") ? "  ← probable Saldu" : "";
    console.log(`${f.name}`);
    console.log(`   id: ${f.id}${mark}`);
    if (f.webViewLink) console.log(`   ${f.webViewLink}`);
    console.log("");
  }
  pageToken = res.data.nextPageToken ?? undefined;
} while (pageToken);

console.log(`Total: ${total} spreadsheet(s) en el Drive de la SA.`);
