import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
