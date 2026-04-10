/**
 * Contador en Upstash Redis (Vercel → Marketplace → Redis).
 * n8n → POST /api/notify → incr; el front consulta /api/version cada pocos segundos.
 */
import { Redis } from "@upstash/redis";

export const SHEET_REVISION_KEY = "saldu:sheet_revision";

/** Vercel Storage suele inyectar KV_REST_*; Upstash directo usa UPSTASH_REDIS_REST_*. */
function getRedisRestConfig(): { url: string; token: string } | null {
  const url =
    process.env.UPSTASH_REDIS_REST_URL ||
    process.env.KV_REST_API_URL ||
    "";
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN ||
    process.env.KV_REST_API_TOKEN ||
    "";
  if (!url.trim() || !token.trim()) return null;
  return { url: url.trim(), token: token.trim() };
}

export function isRevisionStoreConfigured(): boolean {
  return getRedisRestConfig() !== null;
}

function getRedis(): Redis | null {
  const cfg = getRedisRestConfig();
  if (!cfg) return null;
  try {
    return new Redis({ url: cfg.url, token: cfg.token });
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
