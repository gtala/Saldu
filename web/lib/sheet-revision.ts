/**
 * Contador en Upstash Redis (Vercel → Marketplace → Redis).
 * n8n → POST /api/notify → incr; el front consulta /api/version cada pocos segundos.
 */
import { Redis } from "@upstash/redis";

export const SHEET_REVISION_KEY = "saldu:sheet_revision";

export function isRevisionStoreConfigured(): boolean {
  return !!(
    process.env.UPSTASH_REDIS_REST_URL &&
    process.env.UPSTASH_REDIS_REST_TOKEN
  );
}

function getRedis(): Redis | null {
  if (!isRevisionStoreConfigured()) return null;
  try {
    return Redis.fromEnv();
  } catch {
    return null;
  }
}

export async function bumpSheetRevision(): Promise<void> {
  const r = getRedis();
  if (!r) return;
  await r.incr(SHEET_REVISION_KEY);
}

export async function getSheetRevision(): Promise<{
  revision: number;
  live: boolean;
}> {
  if (!isRevisionStoreConfigured()) {
    return { revision: 0, live: false };
  }
  const r = getRedis();
  if (!r) return { revision: 0, live: true };
  try {
    const v = await r.get(SHEET_REVISION_KEY);
    const n =
      typeof v === "number"
        ? v
        : typeof v === "string"
          ? parseInt(v, 10) || 0
          : 0;
    return { revision: n, live: true };
  } catch {
    return { revision: 0, live: true };
  }
}
