/**
 * POC: verifica DATABASE_URL contra Postgres (Neon).
 * Carga env sin imprimir secretos.
 */
import { config } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

config({ path: path.join(root, ".env.local") });
config({ path: path.join(root, ".env") });
config({ path: path.join(root, "..", ".env") });

const url =
  process.env.DATABASE_URL?.trim() ||
  process.env.POSTGRES_URL?.trim() ||
  process.env.POSTGRES_PRISMA_URL?.trim() ||
  "";
if (!url) {
  console.error(
    "Falta DATABASE_URL (o POSTGRES_URL / POSTGRES_PRISMA_URL) en .env.local / .env / ../.env"
  );
  process.exit(1);
}

const masked = (() => {
  try {
    const u = new URL(url.replace(/^postgresql:/, "http:"));
    return `${u.protocol}//${u.hostname}${u.pathname} (user=${u.username || "?"})`;
  } catch {
    return "(URL no parseable)";
  }
})();

const client = new pg.Client({
  connectionString: url,
  connectionTimeoutMillis: 12_000,
});

try {
  await client.connect();
  const { rows } = await client.query(
    "select 1 as ok, current_database() as db, current_user as usr, now() as server_time"
  );
  console.log("Neon OK:", rows[0]);
  console.log("Host resumido:", masked);
} catch (e) {
  console.error("Neon FAIL:", e instanceof Error ? e.message : e);
  process.exit(1);
} finally {
  await client.end().catch(() => {});
}
