import { getRedis } from "./redis-rest";

const PREFIX = "saldu:user:";

export type UserSheetRecord = {
  sheetId: string;
  email: string;
  name: string;
  createdAt: string;
};

function key(googleSub: string) {
  return `${PREFIX}${googleSub}`;
}

export async function getUserSheetRecord(
  googleSub: string
): Promise<UserSheetRecord | null> {
  const r = getRedis();
  if (!r) return null;
  const data = await r.hgetall<Record<string, string>>(key(googleSub));
  if (!data || typeof data !== "object") return null;
  const sheetId = data.sheetId;
  if (!sheetId || String(sheetId).trim() === "") return null;
  return {
    sheetId: String(sheetId).trim(),
    email: String(data.email ?? ""),
    name: String(data.name ?? ""),
    createdAt: String(data.createdAt ?? ""),
  };
}

export async function setUserSheetRecord(
  googleSub: string,
  rec: UserSheetRecord
): Promise<void> {
  const r = getRedis();
  if (!r) {
    throw new Error("Redis no configurado (UPSTASH_REDIS_REST_URL / token)");
  }
  await r.hset(key(googleSub), {
    sheetId: rec.sheetId,
    email: rec.email,
    name: rec.name,
    createdAt: rec.createdAt,
  });
}

/** Quita la fila de usuario (p. ej. si sheetId quedó mal o apunta a la plantilla). */
export async function deleteUserSheetRecord(googleSub: string): Promise<void> {
  const r = getRedis();
  if (!r) return;
  await r.del(key(googleSub));
}
