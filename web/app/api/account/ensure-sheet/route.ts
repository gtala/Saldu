import { auth } from "@/auth";
import { isMultiUserAuthEnabled } from "@/lib/auth-mode";
import { getServiceAccountCredentials } from "@/lib/google-sa";
import { getUserGoogleRefreshToken } from "@/lib/google-user-oauth-redis";
import { getRedisRestConfig } from "@/lib/redis-rest";
import {
  copyTemplateSpreadsheet,
  copyTemplateSpreadsheetAsUser,
  getTemplateSpreadsheetIdFromEnv,
} from "@/lib/provision-user-sheet";
import {
  deleteUserSheetRecord,
  getUserSheetRecord,
  setUserSheetRecord,
} from "@/lib/user-sheet-redis";

export const dynamic = "force-dynamic";

export async function POST() {
  if (!isMultiUserAuthEnabled()) {
    return Response.json({ ok: true, skipped: true as const });
  }

  const session = await auth();
  if (!session?.user?.id) {
    return Response.json(
      { error: "No autorizado", code: "UNAUTHORIZED" },
      { status: 401 }
    );
  }

  const sub = session.user.id;
  const templateId = getTemplateSpreadsheetIdFromEnv();
  let existing = await getUserSheetRecord(sub);
  if (
    existing?.sheetId &&
    templateId &&
    existing.sheetId.trim() === templateId.trim()
  ) {
    console.warn(
      "[ensure-sheet] Redis tenía el ID de la plantilla; se borra y se vuelve a copiar."
    );
    await deleteUserSheetRecord(sub);
    existing = null;
  }
  if (existing?.sheetId) {
    return Response.json({
      ok: true,
      sheetId: existing.sheetId,
      created: false as const,
    });
  }

  if (!templateId) {
    return Response.json(
      {
        error: "Falta SALDU_TEMPLATE_SPREADSHEET_ID (plantilla para copiar)",
        code: "NO_TEMPLATE",
      },
      { status: 503 }
    );
  }

  if (!getRedisRestConfig()) {
    return Response.json(
      {
        error:
          "Falta Redis: definí UPSTASH_REDIS_REST_URL y UPSTASH_REDIS_REST_TOKEN (o KV_REST_API_URL y KV_REST_API_TOKEN).",
        code: "NO_REDIS",
        hint:
          "En modo multi-usuario Saldu guarda el refresh_token de Google y el ID de tu planilla en Redis. Sin Redis intenta copiar con la cuenta de servicio y Google suele responder «storage quota» aunque tu Gmail tenga espacio. Creá una base gratis en https://upstash.com , pegá URL + token en web/.env.local, reiniciá el servidor, tocá «Salir» y volvé a «Entrar con Google».",
      },
      { status: 503 }
    );
  }

  const title = `Saldu — ${session.user.email || sub}`.slice(0, 200);
  try {
    const refresh = await getUserGoogleRefreshToken(sub);
    const saCreds = getServiceAccountCredentials();
    let sheetId: string;

    if (refresh && saCreds?.client_email) {
      try {
        sheetId = await copyTemplateSpreadsheetAsUser({
          refreshToken: refresh,
          templateSpreadsheetId: templateId,
          title,
          shareWithSaEmail: saCreds.client_email,
        });
      } catch (userErr) {
        const msg =
          userErr instanceof Error ? userErr.message : String(userErr);
        console.warn("[ensure-sheet] copia con OAuth de usuario falló:", msg);
        const plantillaYaExplicada = /plantilla|template|not found|404/i.test(
          msg
        );
        return Response.json(
          {
            error: msg,
            code: "USER_DRIVE_COPY_FAILED",
            hint: plantillaYaExplicada
              ? undefined
              : "La copia va a tu Google Drive. Si Google dice cuota: papelera, Google One/Fotos, o SALDU_USER_DRIVE_COPY_PARENT_FOLDER_ID. Si no es cuota: cerrá sesión y volvé a entrar para refrescar el token en Redis.",
          },
          { status: 500 }
        );
      }
    } else if (!refresh) {
      return Response.json(
        {
          error:
            "No hay token de Google Drive guardado para tu usuario (refresh_token).",
          code: "NO_REFRESH_TOKEN",
          hint:
            "En Saldu tocá «Salir», volvé a «Entrar con Google». Si Google no reenvía el refresh, en https://myaccount.google.com/permissions revocá el acceso de esta app y autorizá de nuevo. Opcional: AUTH_GOOGLE_PROMPT_CONSENT=1 en .env.local para forzar consentimiento.",
        },
        { status: 503 }
      );
    } else {
      if (!saCreds) {
        return Response.json(
          {
            error:
              "Falta cuenta de servicio (GOOGLE_SERVICE_ACCOUNT_JSON o GOOGLE_APPLICATION_CREDENTIALS): hace falta el email de la SA para compartirle la planilla tras copiarla con tu usuario.",
            code: "NO_CREDS",
            hint:
              "Completá las credenciales de la service account en .env.local (misma que lee Sheets).",
          },
          { status: 503 }
        );
      }
      try {
        sheetId = await copyTemplateSpreadsheet(templateId, title);
      } catch (saErr) {
        const msg = saErr instanceof Error ? saErr.message : String(saErr);
        console.warn("[ensure-sheet] copia con service account falló:", msg);
        return Response.json(
          {
            error: msg,
            code: "SA_DRIVE_COPY_FAILED",
            hint:
              "Definí SALDU_DRIVE_COPY_PARENT_FOLDER_ID apuntando a una carpeta en un Shared Drive donde la service account sea miembro (evita cuota del My Drive de la SA).",
          },
          { status: 500 }
        );
      }
    }

    await setUserSheetRecord(sub, {
      sheetId,
      email: session.user.email ?? "",
      name: session.user.name ?? "",
      createdAt: new Date().toISOString(),
    });
    return Response.json({ ok: true, sheetId, created: true as const });
  } catch (e: unknown) {
    const err = e as { code?: string; message?: string };
    const code = err.code ?? "COPY_FAILED";
    const status = code === "NO_CREDS" ? 503 : 500;
    return Response.json(
      {
        error: err.message || "No se pudo copiar la plantilla",
        code,
      },
      { status }
    );
  }
}
