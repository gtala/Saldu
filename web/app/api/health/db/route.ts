import pg from "pg";

export const dynamic = "force-dynamic";

function connectionString(): string | null {
  const url =
    process.env.DATABASE_URL?.trim() ||
    process.env.POSTGRES_URL?.trim() ||
    process.env.POSTGRES_PRISMA_URL?.trim() ||
    "";
  return url || null;
}

/**
 * POC: comprueba que el proceso Next puede conectar a Postgres (Neon).
 * No requiere auth. No devuelve secretos.
 */
export async function GET() {
  const url = connectionString();
  if (!url) {
    return Response.json(
      {
        ok: false,
        code: "NO_DATABASE_URL",
        message:
          "Definí DATABASE_URL (o POSTGRES_URL) en el entorno del servidor.",
      },
      { status: 503 }
    );
  }

  const started = Date.now();
  const client = new pg.Client({
    connectionString: url,
    connectionTimeoutMillis: 10_000,
  });

  try {
    await client.connect();
    const { rows } = await client.query<{ ok: number; db: string }>(
      "select 1 as ok, current_database()::text as db"
    );
    const elapsedMs = Date.now() - started;
    return Response.json({
      ok: true,
      db: rows[0]?.db,
      elapsedMs,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json(
      { ok: false, code: "DB_CONNECT_FAILED", message: msg },
      { status: 503 }
    );
  } finally {
    await client.end().catch(() => {});
  }
}
