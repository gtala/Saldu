import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  // Repo raíz tiene otro package-lock (app Node legacy); evita warning de tracing.
  outputFileTracingRoot: path.join(__dirname, ".."),
  serverExternalPackages: [
    "googleapis",
    "google-auth-library",
    "gaxios",
    "crypto-js",
  ],
};

export default nextConfig;
