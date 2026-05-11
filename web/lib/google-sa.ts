import fs from "fs";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { getServiceAccountFromN8n } = require("../n8n-google-sa.js") as {
  getServiceAccountFromN8n: () => {
    client_email: string;
    private_key: string;
  } | null;
};

export type ServiceAccountCreds = {
  client_email: string;
  private_key: string;
};

/** Misma prioridad que `web/sheets.js` → getClient(). */
export function getServiceAccountCredentials(): ServiceAccountCreds | null {
  const saJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (saJson) {
    try {
      const c = JSON.parse(saJson) as Record<string, string>;
      if (c.client_email && c.private_key) {
        return { client_email: c.client_email, private_key: c.private_key };
      }
    } catch {
      /* ignore */
    }
  }

  const keyFile = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (keyFile && fs.existsSync(keyFile)) {
    try {
      const c = JSON.parse(fs.readFileSync(keyFile, "utf8")) as Record<
        string,
        string
      >;
      if (c.client_email && c.private_key) {
        return { client_email: c.client_email, private_key: c.private_key };
      }
    } catch {
      /* ignore */
    }
  }

  const n8n = getServiceAccountFromN8n();
  if (n8n?.client_email && n8n?.private_key) {
    return { client_email: n8n.client_email, private_key: n8n.private_key };
  }

  return null;
}
