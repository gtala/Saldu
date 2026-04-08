/**
 * Obtiene la misma cuenta de servicio que usa n8n (credencial tipo googleApi,
 * ej. "Google Sheets account 2") leyendo config + SQLite del contenedor n8n.
 * Requiere: usuario en grupo docker, contenedor accesible (nombre por defecto "n8n").
 */
const { execSync, spawnSync } = require("child_process");
const CryptoJS = require("crypto-js");

const CONTAINER = process.env.N8N_DOCKER_CONTAINER || "n8n";
const CREDENTIAL_NAME =
  process.env.N8N_GOOGLE_CREDENTIAL_NAME || "Google Sheets account 2";
const TMP_DB = "/tmp/n8n-dash.sqlite";

let mem = { at: 0, ttlMs: 5 * 60 * 1000, creds: null, err: null };

/** PEM guardado en n8n a veces viene con espacios en lugar de saltos de línea. */
function pemFromSpaced(s) {
  const t = String(s || "").trim();
  if (t.includes("\n")) return t;
  const m = t.match(
    /-----BEGIN PRIVATE KEY-----\s*(.+?)\s*-----END PRIVATE KEY-----/s
  );
  if (!m) return null;
  const b64 = m[1].replace(/\s+/g, "");
  const lines = b64.match(/.{1,64}/g) || [];
  return `-----BEGIN PRIVATE KEY-----\n${lines.join("\n")}\n-----END PRIVATE KEY-----\n`;
}

function getEncryptionKey() {
  const out = execSync(`docker exec ${CONTAINER} cat /home/node/.n8n/config`, {
    encoding: "utf8",
    maxBuffer: 1024 * 1024,
    timeout: 20000,
  });
  const j = JSON.parse(out);
  if (!j.encryptionKey) throw new Error("config sin encryptionKey");
  return j.encryptionKey;
}

function copyDatabase() {
  execSync(`docker cp ${CONTAINER}:/home/node/.n8n/database.sqlite ${TMP_DB}`, {
    maxBuffer: 1024 * 1024,
    timeout: 60000,
  });
}

function fetchEncryptedCredential() {
  const safe = CREDENTIAL_NAME.replace(/'/g, "''");
  const sql = `SELECT data FROM credentials_entity WHERE type='googleApi' AND name='${safe}' LIMIT 1`;
  const r = spawnSync("sqlite3", [TMP_DB, sql], {
    encoding: "utf8",
    maxBuffer: 5 * 1024 * 1024,
    timeout: 30000,
  });
  if (r.error) throw r.error;
  if (r.status !== 0) {
    throw new Error(r.stderr || "sqlite3 falló");
  }
  return (r.stdout || "").trim();
}

/**
 * @returns {{ client_email: string, private_key: string } | null}
 */
function getServiceAccountFromN8n() {
  const now = Date.now();
  if (mem.creds && now - mem.at < mem.ttlMs) return mem.creds;
  if (mem.err && now - mem.at < mem.ttlMs) return null;

  try {
    copyDatabase();
    const encKey = getEncryptionKey();
    const cipher = fetchEncryptedCredential();
    if (!cipher) {
      mem = { at: now, ttlMs: mem.ttlMs, creds: null, err: "sin_credencial" };
      return null;
    }
    const plain = CryptoJS.AES.decrypt(cipher, encKey).toString(
      CryptoJS.enc.Utf8
    );
    if (!plain) {
      mem = { at: now, ttlMs: mem.ttlMs, creds: null, err: "decrypt" };
      return null;
    }
    const j = JSON.parse(plain);
    const email = j.email || j.client_email;
    const rawKey = j.privateKey || j.private_key;
    if (!email || !rawKey) {
      mem = { at: now, ttlMs: mem.ttlMs, creds: null, err: "campos" };
      return null;
    }
    const private_key = pemFromSpaced(rawKey) || rawKey;
    const creds = { client_email: email, private_key };
    mem = { at: now, ttlMs: mem.ttlMs, creds, err: null };
    return creds;
  } catch (e) {
    console.error("[n8n-google-sa]", e.message);
    mem = { at: now, ttlMs: 60_000, creds: null, err: String(e.message) };
    return null;
  }
}

module.exports = { getServiceAccountFromN8n, pemFromSpaced };
