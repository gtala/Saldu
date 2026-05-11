import { auth } from "@/auth";
import { isMultiUserAuthEnabled } from "@/lib/auth-mode";
import {
  DashboardLoadError,
  loadDashboardPayload,
} from "@/lib/data/load-dashboard-payload";
import { config as loadEnv } from "dotenv";
import path from "path";

export const dynamic = "force-dynamic";

loadEnv({ path: path.join(process.cwd(), ".env.local") });
loadEnv({ path: path.join(process.cwd(), ".env") });
loadEnv({ path: path.join(process.cwd(), "..", ".env") });

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const wantFresh = url.searchParams.has("fresh");
    const multi = isMultiUserAuthEnabled();
    const session = multi ? await auth() : null;

    if (multi && !session?.user?.id) {
      return Response.json(
        { error: "No autorizado", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const data = await loadDashboardPayload({
      wantFresh,
      googleSub: session?.user?.id ?? null,
      isMultiUser: multi,
    });

    return Response.json(data, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (e: unknown) {
    if (e instanceof DashboardLoadError) {
      return Response.json(
        { error: e.message, code: e.code },
        { status: e.status }
      );
    }
    const err = e as { code?: string; message?: string };
    const code = err.code;
    const status =
      code === "NO_CREDS" || code === "NO_SPREADSHEET_ID" ? 503 : 500;
    return Response.json(
      {
        error: err.message || "Error al leer el dashboard",
        code: code ?? null,
      },
      { status }
    );
  }
}
