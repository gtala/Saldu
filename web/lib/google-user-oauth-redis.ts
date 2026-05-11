import { getRedis } from "./redis-rest";

const key = (sub: string) => `saldu:google_refresh:${sub}`;

/** Si cambiás scopes OAuth (ej. drive.file → drive), subí este número para invalidar refresh viejos en Redis. */
const scopeKey = (sub: string) => `saldu:google_refresh_scope:${sub}`;

function requiredScopeVersion(): string | null {
  const v = process.env.AUTH_GOOGLE_SCOPE_VERSION?.trim();
  return v || null;
}

export async function setUserGoogleRefreshToken(
  sub: string,
  refreshToken: string
): Promise<void> {
  const r = getRedis();
  if (!r) return;
  await r.set(key(sub), refreshToken);
  const need = requiredScopeVersion();
  if (need) await r.set(scopeKey(sub), need);
  else await r.del(scopeKey(sub));
}

export async function getUserGoogleRefreshToken(
  sub: string
): Promise<string | null> {
  const r = getRedis();
  if (!r) return null;
  const need = requiredScopeVersion();
  if (need) {
    const stored = await r.get<string>(scopeKey(sub));
    if (String(stored ?? "") !== need) {
      await r.del(key(sub));
      await r.del(scopeKey(sub));
      return null;
    }
  }
  const v = await r.get<string>(key(sub));
  if (!v || typeof v !== "string" || !v.trim()) return null;
  return v.trim();
}

export async function clearUserGoogleRefreshToken(sub: string): Promise<void> {
  const r = getRedis();
  if (!r) return;
  await r.del(key(sub));
  await r.del(scopeKey(sub));
}
