import { defineConfig } from "vitest/config";

// AI-08: los tests nunca llaman a un proveedor real.
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    env: { AI_PROVIDER: "mock", ANTHROPIC_API_KEY: "" },
  },
});
