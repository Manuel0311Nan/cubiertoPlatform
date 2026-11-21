import { defineConfig } from "prisma/config";

// Igual que prisma.config.ts, pero contra TEST_DATABASE_URL: `pnpm db:migrate:test` antes de `pnpm test`.
try {
  process.loadEnvFile(new URL("../../.env", import.meta.url));
} catch {
  // Sin `.env`: variables del entorno (CI).
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: process.env.TEST_DATABASE_URL },
});
