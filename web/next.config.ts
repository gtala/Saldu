import type { NextConfig } from "next";
import { config as loadEnv } from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Repo monorepo: `Saldu/.env` + overrides en `web/.env.local` (este último gana).
loadEnv({ path: path.join(__dirname, "..", ".env") });
loadEnv({ path: path.join(__dirname, ".env") });
loadEnv({ path: path.join(__dirname, ".env.local"), override: true });

const nextConfig: NextConfig = {
  // sheets.js vive en web/ — Next.js lo traza desde aquí.
  outputFileTracingRoot: __dirname,
  serverExternalPackages: [
    "googleapis",
    "google-auth-library",
    "gaxios",
    "crypto-js",
  ],
};

export default nextConfig;
