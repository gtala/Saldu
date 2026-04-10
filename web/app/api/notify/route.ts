import { bumpSheetRevision } from "@/lib/sheet-revision";
import { config as loadEnv } from "dotenv";
import path from "path";

export const dynamic = "force-dynamic";

loadEnv({ path: path.join(process.cwd(), ".env.local") });
loadEnv({ path: path.join(process.cwd(), ".env") });
loadEnv({ path: path.join(process.cwd(), "..", ".env") });

const NOTIFY_SECRET = process.env.NOTIFY_SECRET ?? "";

type SheetsModule = {
  clearCache?: () => void;
  default?: { clearCache?: () => void };
  [key: string]: unknown;
};

export async function POST(req: Request) {
  // optional token check — si está configurado, lo verificamos
  if (NOTIFY_SECRET) {
    const auth = req.headers.get("authorization") ?? "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : auth;
    if (token !== NOTIFY_SECRET) {
      return Response.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  try {
    const mod = (await import("../../../sheets.js")) as unknown as SheetsModule;
    const clear = mod.clearCache ?? mod.default?.clearCache;
    if (typeof clear === "function") clear();
  } catch {
    // si no se puede importar, igual respondemos OK
  }

  try {
    await bumpSheetRevision();
  } catch {
    /* Redis opcional */
  }

  return Response.json({ ok: true, ts: Date.now() });
}
