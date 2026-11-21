import { defineConfig } from "prisma/config";

// Variables del `.env` de la raíz del monorepo (ignorado por git). En Vercel y en CI vienen del entorno.
try {
  process.loadEnvFile(new URL("../../.env", import.meta.url));
} catch {
  // Sin `.env`: se usan las variables del entorno.
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "node src/seed.ts",
  },
  datasource: {
    // Migraciones por la conexión directa de Neon; la app usa la del pool (DATABASE_URL).
    url: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL,
  },
});
