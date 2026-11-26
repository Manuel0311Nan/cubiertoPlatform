import { resolve } from "node:path";
import type { NextConfig } from "next";

// En local, las variables están en el `.env` de la raíz del monorepo (ver .env.example).
// En Vercel vienen del proyecto y este archivo no existe.
try {
  process.loadEnvFile(resolve(process.cwd(), "../../.env"));
} catch {
  // Sin `.env`: variables del entorno.
}

const nextConfig: NextConfig = {
  // packages/db y packages/ai se usan como código fuente TypeScript.
  transpilePackages: ["@cubierto/db", "@cubierto/ai"],
};

export default nextConfig;
