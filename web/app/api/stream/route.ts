import { config as loadEnv } from "dotenv";
import path from "path";

export const dynamic = "force-dynamic";

loadEnv({ path: path.join(process.cwd(), ".env.local") });
loadEnv({ path: path.join(process.cwd(), ".env") });
loadEnv({ path: path.join(process.cwd(), "..", ".env") });

type SheetsModule = {
  fetchMonthlyTotals: () => Promise<unknown>;
  default?: { fetchMonthlyTotals: () => Promise<unknown> };
};

type Payload = {
  months?: Array<{ name: string; total?: number; totalIngresos?: number }>;
  patrimonio?: { snapshots?: unknown[] };
};

function fingerprint(data: Payload): string {
  return (
    (data.months ?? []).map((m) => `${m.name}:${m.total}:${m.totalIngresos}`).join("|") +
    "|pat:" +
    (data.patrimonio?.snapshots?.length ?? 0)
  );
}

async function loadFetch(): Promise<() => Promise<unknown>> {
  const mod = (await import("../../../sheets.js")) as SheetsModule;
  const fn = mod.fetchMonthlyTotals ?? mod.default?.fetchMonthlyTotals;
  if (typeof fn !== "function") throw new Error("no fetchMonthlyTotals");
  return fn;
}

// Vercel Hobby: max streaming duration ~30s. Cerramos a los 25s y el
// cliente (EventSource) reconecta automáticamente.
const STREAM_TTL_MS = 25_000;
const POLL_INTERVAL_MS = 3_000;
const HEARTBEAT_MS = 15_000;

export async function GET() {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      let lastFp = "";

      const enqueue = (data: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(data));
        } catch {
          closed = true;
        }
      };

      // confirmación de conexión
      enqueue("data: connected\n\n");

      // heartbeat para mantener la conexión viva
      const hbId = setInterval(() => enqueue(": heartbeat\n\n"), HEARTBEAT_MS);

      // polling de datos
      const poll = async () => {
        if (closed) return;
        try {
          const fetch = await loadFetch();
          const data = (await fetch()) as Payload;
          const fp = fingerprint(data);
          if (lastFp && fp !== lastFp) {
            enqueue("data: update\n\n");
          }
          lastFp = fp;
        } catch {
          // ignorar errores individuales de polling
        }
        if (!closed) setTimeout(poll, POLL_INTERVAL_MS);
      };

      // primer poll para inicializar fingerprint
      await poll();

      // cierre por TTL
      setTimeout(() => {
        closed = true;
        clearInterval(hbId);
        try {
          controller.enqueue(encoder.encode("data: reconnect\n\n"));
          controller.close();
        } catch { /* ignore */ }
      }, STREAM_TTL_MS);
    },
    cancel() {
      // el cliente cerró la conexión
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
