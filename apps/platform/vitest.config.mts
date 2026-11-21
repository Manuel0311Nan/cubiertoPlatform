import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// TEST_DATABASE_URL del `.env` de la raíz (rama `test` de Neon); en CI, del entorno.
try {
  process.loadEnvFile(new URL("../../.env", import.meta.url));
} catch {
  // Sin `.env`.
}

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["src/**/*.test.{ts,tsx}"],
    environment: "node",
    // Los tests de integración comparten base de datos: en serie.
    fileParallelism: false,
    env: {
      ...(testDatabaseUrl ? { DATABASE_URL: testDatabaseUrl } : {}),
      BETTER_AUTH_SECRET: "test-secret-only-for-vitest-0123456789abcdef",
      BETTER_AUTH_URL: "http://app.localhost:3000",
      RESEND_API_KEY: "",
    },
  },
});
