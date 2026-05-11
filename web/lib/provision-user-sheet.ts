import type { drive_v3 } from "googleapis";
import { google } from "googleapis";
import { getServiceAccountCredentials } from "./google-sa";

/**
 * Archivos compartidos solo por enlace (p. ej. permiso «cualquiera con el enlace») pueden
 * responder 404 en Drive API sin el header correcto, aunque abran en el navegador.
 * @see https://developers.google.com/workspace/drive/api/guides/resource-keys
 */
function driveResourceKeysRequestOptions(
  pairs: Array<{ id: string; resourceKey?: string }>
): { headers: { "X-Goog-Drive-Resource-Keys": string } } | undefined {
  const segments: string[] = [];
  for (const { id, resourceKey } of pairs) {
    const rk = resourceKey?.trim();
    if (rk) segments.push(`${String(id).trim()}/${rk}`);
  }
  if (segments.length === 0) return undefined;
  return {
    headers: { "X-Goog-Drive-Resource-Keys": segments.join(",") },
  };
}

function templateResourceKeyFromEnv(): string | undefined {
  const rk = process.env.SALDU_TEMPLATE_SPREADSHEET_RESOURCE_KEY?.trim();
  return rk || undefined;
}

function userParentFolderResourceKeyFromEnv(): string | undefined {
  const rk =
    process.env.SALDU_USER_DRIVE_COPY_PARENT_FOLDER_RESOURCE_KEY?.trim();
  return rk || undefined;
}

function driveApiMessage(e: unknown): string {
  const err = e as {
    message?: string;
    response?: {
      data?: {
        error?: {
          message?: string;
          errors?: Array<{ message?: string; reason?: string }>;
        };
      };
    };
  };
  const g = err.response?.data?.error;
  const parts = [
    g?.errors?.map((x) => x.message).filter(Boolean).join("; "),
    g?.message,
    err.message,
  ].filter((s): s is string => Boolean(s && String(s).trim()));
  return parts[0] ?? "Error desconocido al llamar a Drive";
}

function sheetsApiMessage(e: unknown): string {
  const err = e as {
    message?: string;
    response?: {
      data?: {
        error?: {
          message?: string;
          errors?: Array<{ message?: string }>;
        };
      };
    };
  };
  const g = err.response?.data?.error;
  const parts = [
    g?.errors?.map((x) => x.message).filter(Boolean).join("; "),
    g?.message,
    err.message,
  ].filter((s): s is string => Boolean(s && String(s).trim()));
  return parts[0] ?? "Error desconocido al llamar a Sheets";
}

function isGoogleApiNotFound(e: unknown): boolean {
  const err = e as {
    code?: number;
    response?: { status?: number };
  };
  if (err.code === 404) return true;
  if (err.response?.status === 404) return true;
  const msg = `${driveApiMessage(e)} ${sheetsApiMessage(e)}`;
  return /not found|404|NOT_FOUND/i.test(msg);
}

/**
 * Drive.files.get a veces devuelve 404 con supportsAllDrives=true en archivos de «Mi unidad»;
 * reintentar sin el flag puede alinear el comportamiento con la UI web.
 */
async function driveFilesGetWithFallback(
  drive: ReturnType<typeof google.drive>,
  params: { fileId: string; fields: string },
  rkOpts: ReturnType<typeof driveResourceKeysRequestOptions>
): Promise<{ data: drive_v3.Schema$File }> {
  const variants: Array<{ supportsAllDrives?: boolean }> = [
    { supportsAllDrives: true },
    {},
  ];
  let last: unknown;
  for (const extra of variants) {
    try {
      return await drive.files.get({ ...params, ...extra }, rkOpts);
    } catch (e) {
      last = e;
      if (!isGoogleApiNotFound(e)) throw e;
    }
  }
  throw last;
}

/** Comprueba acceso a la plantilla; distingue «solo Drive» (p. ej. resource key) vs sin acceso real. */
async function assertUserTemplateReadable(
  drive: ReturnType<typeof google.drive>,
  sheets: ReturnType<typeof google.sheets>,
  tpl: string,
  rkOpts: ReturnType<typeof driveResourceKeysRequestOptions>
): Promise<void> {
  let driveLast: unknown;
  try {
    await driveFilesGetWithFallback(
      drive,
      { fileId: tpl, fields: "id,name,mimeType" },
      rkOpts
    );
    return;
  } catch (e) {
    driveLast = e;
    if (!isGoogleApiNotFound(e)) {
      const msg = driveApiMessage(e);
      const wrapped = new Error(
        `Drive no puede leer la plantilla ${tpl} con tu usuario (${msg}). Compartila como Editor con el Gmail con el que entrás a Saldu, desactivá «Restringir descargas, impresiones y copias para lectores», o si la plantilla solo está compartida «con el enlace» definí SALDU_TEMPLATE_SPREADSHEET_RESOURCE_KEY (valor resourcekey= de la URL).`,
        { cause: e }
      );
      (wrapped as Error & { code?: string }).code = "DRIVE_TEMPLATE_INACCESSIBLE";
      throw wrapped;
    }
  }

  let sheetsOk = false;
  let sheetsLast: unknown;
  try {
    await sheets.spreadsheets.get({
      spreadsheetId: tpl,
      fields: "spreadsheetId",
    });
    sheetsOk = true;
  } catch (e) {
    sheetsLast = e;
    sheetsOk = false;
  }

  const driveMsg = driveApiMessage(driveLast);
  if (sheetsOk) {
    const hasRk = Boolean(templateResourceKeyFromEnv());
    const wrapped = new Error(
      hasRk
        ? `Sheets API sí ve la plantilla ${tpl}, pero Drive sigue sin poder usarla (${driveMsg}). Revisá que SALDU_TEMPLATE_SPREADSHEET_RESOURCE_KEY sea exactamente el de la URL (sin espacios). Si la URL no tiene resourcekey=, compartí la planilla como Editor con tu Gmail (no solo enlace anónimo).`
        : `Sheets API sí ve la plantilla ${tpl}, pero Drive responde «${driveMsg}» (suele pasar con enlace «cualquiera» sin clave de recurso). Definí SALDU_TEMPLATE_SPREADSHEET_RESOURCE_KEY con el valor tras resourcekey= en la barra de direcciones al abrir la planilla, o compartila como Editor con el Gmail con el que entrás a Saldu.`,
      { cause: driveLast }
    );
    (wrapped as Error & { code?: string }).code = "DRIVE_TEMPLATE_INACCESSIBLE";
    throw wrapped;
  }

  const sheetsMsg = sheetsLast
    ? sheetsApiMessage(sheetsLast)
    : "(sin respuesta de Sheets)";
  const wrapped = new Error(
    `Ni Drive ni Sheets pueden abrir la plantilla ${tpl} con tu sesión (Drive: ${driveMsg}; Sheets: ${sheetsMsg}). Revisá el ID, que la planilla esté compartida con el mismo Gmail con el que te logueás en Saldu (ideal: Editor), y que en Google Cloud del cliente OAuth (AUTH_GOOGLE_ID) estén habilitadas las APIs «Google Drive» y «Google Sheets».`,
    { cause: driveLast }
  );
  (wrapped as Error & { code?: string }).code = "DRIVE_TEMPLATE_INACCESSIBLE";
  throw wrapped;
}

async function driveFilesCopyWithFallback(
  drive: ReturnType<typeof google.drive>,
  params: {
    fileId: string;
    requestBody: {
      name: string;
      mimeType: string;
      parents?: string[];
    };
  },
  rkOpts: ReturnType<typeof driveResourceKeysRequestOptions>
): Promise<{ data: drive_v3.Schema$File }> {
  const variants: Array<{ supportsAllDrives?: boolean }> = [
    { supportsAllDrives: true },
    {},
  ];
  let last: unknown;
  for (const extra of variants) {
    try {
      return await drive.files.copy({ ...params, ...extra }, rkOpts);
    } catch (e) {
      last = e;
      if (!isGoogleApiNotFound(e)) throw e;
    }
  }
  throw last;
}

/**
 * Copia una planilla plantilla en el Drive de la service account.
 * La plantilla debe existir y estar accesible para esa SA (mismo proyecto o compartida).
 *
 * Opcional: `SALDU_DRIVE_COPY_PARENT_FOLDER_ID` — ID de carpeta (p. ej. en un Shared Drive
 * de Google Workspace donde la SA es miembro). Suele evitar el error de cuota del “My Drive”
 * de la service account en proyectos personales.
 */
export async function copyTemplateSpreadsheet(
  templateSpreadsheetId: string,
  title: string
): Promise<string> {
  const creds = getServiceAccountCredentials();
  if (!creds) {
    const err = new Error("Falta service account (JSON o archivo)");
    (err as Error & { code?: string }).code = "NO_CREDS";
    throw err;
  }

  const auth = new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ["https://www.googleapis.com/auth/drive"],
  });

  const drive = google.drive({ version: "v3", auth });
  const tpl = String(templateSpreadsheetId).trim();
  const tplRk = templateResourceKeyFromEnv();
  const rkOpts = driveResourceKeysRequestOptions([
    { id: tpl, resourceKey: tplRk },
  ]);
  const parentId =
    process.env.SALDU_DRIVE_COPY_PARENT_FOLDER_ID?.trim() ||
    process.env.GOOGLE_DRIVE_COPY_PARENT_FOLDER_ID?.trim() ||
    "";

  const requestBody: {
    name: string;
    mimeType: string;
    parents?: string[];
  } = {
    name: title.slice(0, 200),
    mimeType: "application/vnd.google-apps.spreadsheet",
  };
  if (parentId) {
    requestBody.parents = [parentId];
  }

  let res;
  try {
    res = await driveFilesCopyWithFallback(
      drive,
      { fileId: tpl, requestBody },
      rkOpts
    );
  } catch (e) {
    const msg = driveApiMessage(e);
    const wrapped = new Error(msg, { cause: e });
    (wrapped as Error & { code?: string }).code = "DRIVE_COPY_FAILED";
    throw wrapped;
  }

  const id = res.data.id;
  if (!id) {
    throw new Error("Drive no devolvió id al copiar la plantilla");
  }
  return id;
}

export function getTemplateSpreadsheetIdFromEnv(): string | null {
  const id =
    process.env.SALDU_TEMPLATE_SPREADSHEET_ID?.trim() ||
    process.env.GOOGLE_SHEETS_TEMPLATE_ID?.trim() ||
    "";
  return id || null;
}

function googleWebOAuthRedirectUri(): string {
  const base =
    process.env.AUTH_URL?.trim() ||
    process.env.NEXTAUTH_URL?.trim() ||
    "http://localhost:3000";
  return `${base.replace(/\/$/, "")}/api/auth/callback/google`;
}

/**
 * Copia la plantilla en el **Drive del usuario** (OAuth) y comparte el archivo con la
 * service account para que la lectura con SA siga funcionando.
 * Requiere `refresh_token` de Google (p. ej. guardado en Redis al login) y que la plantilla
 * sea visible para la cuenta del usuario (compartida con su Gmail o enlace).
 */
export async function copyTemplateSpreadsheetAsUser(opts: {
  refreshToken: string;
  templateSpreadsheetId: string;
  title: string;
  shareWithSaEmail: string;
}): Promise<string> {
  const clientId = process.env.AUTH_GOOGLE_ID?.trim();
  const clientSecret = process.env.AUTH_GOOGLE_SECRET?.trim();
  if (!clientId || !clientSecret) {
    const err = new Error("Falta AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET");
    (err as Error & { code?: string }).code = "NO_WEB_OAUTH";
    throw err;
  }

  const oauth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    googleWebOAuthRedirectUri()
  );
  oauth2Client.setCredentials({ refresh_token: opts.refreshToken });

  const drive = google.drive({ version: "v3", auth: oauth2Client });
  const sheets = google.sheets({ version: "v4", auth: oauth2Client });
  const tpl = String(opts.templateSpreadsheetId).trim();
  const tplRk = templateResourceKeyFromEnv();
  // Solo carpeta en el Drive del USUARIO OAuth. NO reutilizar SALDU_DRIVE_COPY_PARENT_FOLDER_ID:
  // esa suele ser un Shared Drive / carpeta de la service account → files.copy devuelve 404.
  const parentId =
    process.env.SALDU_USER_DRIVE_COPY_PARENT_FOLDER_ID?.trim() || "";
  const parentRk = userParentFolderResourceKeyFromEnv();

  const rkPairs: Array<{ id: string; resourceKey?: string }> = [
    { id: tpl, resourceKey: tplRk },
  ];
  if (parentId) {
    rkPairs.push({ id: parentId, resourceKey: parentRk });
  }
  const rkOpts = driveResourceKeysRequestOptions(rkPairs);

  const requestBody: {
    name: string;
    mimeType: string;
    parents?: string[];
  } = {
    name: opts.title.slice(0, 200),
    mimeType: "application/vnd.google-apps.spreadsheet",
  };
  if (parentId) {
    requestBody.parents = [parentId];
  }

  await assertUserTemplateReadable(drive, sheets, tpl, rkOpts);

  if (parentId) {
    try {
      const pf = await driveFilesGetWithFallback(
        drive,
        { fileId: parentId, fields: "id,mimeType,name" },
        rkOpts
      );
      const mime = String(pf.data.mimeType || "");
      if (!mime.includes("folder")) {
        throw new Error(
          `SALDU_USER_DRIVE_COPY_PARENT_FOLDER_ID debe ser una carpeta (mime: ${mime}).`
        );
      }
    } catch (e) {
      const msg = driveApiMessage(e);
      const wrapped = new Error(
        `Carpeta destino (${parentId}): ${msg}. Usá solo una carpeta de TU «Mi unidad»; no reutilices SALDU_DRIVE_COPY_PARENT_FOLDER_ID (suele ser de la service account). Si no necesitás subcarpeta, borrá SALDU_USER_DRIVE_COPY_PARENT_FOLDER_ID del .env.`,
        { cause: e }
      );
      (wrapped as Error & { code?: string }).code = "DRIVE_PARENT_INACCESSIBLE";
      throw wrapped;
    }
  }

  let newId: string;
  try {
    const res = await driveFilesCopyWithFallback(
      drive,
      { fileId: tpl, requestBody },
      rkOpts
    );
    const id = res.data.id;
    if (!id) {
      throw new Error("Drive no devolvió id al copiar la plantilla");
    }
    newId = id;
  } catch (e) {
    const msg = driveApiMessage(e);
    const notFound =
      /not found|404|file not found/i.test(msg) ||
      (e as { code?: number }).code === 404;
    const hint =
      notFound &&
      (parentId
        ? `files.copy devolvió 404: la carpeta destino (${parentId}) suele ser inaccesible para tu usuario. Quitá SALDU_USER_DRIVE_COPY_PARENT_FOLDER_ID o usá un ID de carpeta en tu «Mi unidad». `
        : `Copiar devolvió 404 aunque la plantilla se pudo leer: compartí la plantilla como Editor o desactivá restricción de copia para lectores. `);
    const wrapped = new Error(
      hint ? `${hint}${msg}` : msg,
      { cause: e }
    );
    (wrapped as Error & { code?: string }).code = "DRIVE_COPY_FAILED";
    throw wrapped;
  }

  try {
    await drive.permissions.create({
      fileId: newId,
      requestBody: {
        type: "user",
        role: "writer",
        emailAddress: opts.shareWithSaEmail,
      },
      sendNotificationEmail: false,
    });
  } catch (e) {
    try {
      await drive.files.delete({ fileId: newId, supportsAllDrives: true });
    } catch {
      /* ignore cleanup */
    }
    const msg = driveApiMessage(e);
    const wrapped = new Error(
      `Planilla creada en tu Drive pero no se pudo compartir con la app (${msg}).`,
      { cause: e }
    );
    (wrapped as Error & { code?: string }).code = "DRIVE_SHARE_FAILED";
    throw wrapped;
  }

  return newId;
}
