import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    // CLAUDE.md §11 y AI-01: los SDKs de proveedores de IA solo se importan en packages/ai.
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "ai", message: "Usa @cubierto/ai y una tarea de modules/ai/tasks (AI-01)." },
            { name: "@anthropic-ai/sdk", message: "Usa @cubierto/ai (AI-01)." },
            { name: "openai", message: "Usa @cubierto/ai (AI-01)." },
          ],
          patterns: [{ group: ["@ai-sdk/*", "ai/*"], message: "Usa @cubierto/ai (AI-01)." }],
        },
      ],
    },
  },
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
    ],
  },
];

export default eslintConfig;
