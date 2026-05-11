import { Redis } from "@upstash/redis";

/** Misma resolución de env que `sheet-revision.ts`. */
export function getRedisRestConfig(): { url: string; token: string } | null {
  const url =
    process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || "";
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || "";
  if (!url.trim() || !token.trim()) return null;
  return { url: url.trim(), token: token.trim() };
}

export function getRedis(): Redis | null {
  const cfg = getRedisRestConfig();
  if (!cfg) return null;
  try {
    return new Redis({ url: cfg.url, token: cfg.token });
  } catch {
    return null;
  }
}
