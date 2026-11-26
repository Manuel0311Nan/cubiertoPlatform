import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * AI-08: `pnpm ai:eval <tarea>` ejecuta los evals de una tarea contra el modelo REAL, a mano,
 * antes de subir su versión. Nunca en CI. Necesita ANTHROPIC_API_KEY en el `.env` de la raíz.
 */
try {
  process.loadEnvFile(new URL("../../.env", import.meta.url));
} catch {
  // Sin `.env`: variables del entorno.
}

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["src/**/*.eval.ts"],
    environment: "node",
    testTimeout: 120_000,
  },
});
