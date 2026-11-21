import { defineConfig } from "vitest/config";

// TEST_DATABASE_URL del `.env` de la raíz: una base migrada solo para tests (en Neon, una rama `test`).
try {
  process.loadEnvFile(new URL("../../.env", import.meta.url));
} catch {
  // Sin `.env`: variables del entorno (CI).
}

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts", "test/**/*.test.ts"],
    environment: "node",
    // Los tests de integración comparten base de datos: en serie.
    fileParallelism: false,
    env: testDatabaseUrl ? { DATABASE_URL: testDatabaseUrl } : {},
  },
});
