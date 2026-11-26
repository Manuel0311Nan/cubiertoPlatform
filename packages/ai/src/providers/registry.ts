import type { LanguageModel } from "ai";
import type { AiConfig, ModelRef } from "../models.ts";
import { anthropicModel } from "./anthropic.ts";
import { mockModel, type MockRespond } from "./mock.ts";

/**
 * AI-01: de `anthropic:claude-haiku-5-5` al adaptador. Para añadir un proveedor (OpenAI,
 * Mistral…), su paquete `@ai-sdk/<proveedor>` y una línea aquí; las tareas no cambian.
 *
 * Devuelve null si el proveedor no está disponible (sin clave o desconocido): AI_DISABLED.
 */
export function resolveModel(model: ModelRef, config: AiConfig, respond: MockRespond): LanguageModel | null {
  if (config.mode === "mock") return mockModel(`mock-${model.modelId}`, respond);
  const apiKey = config.apiKeys[model.provider];
  if (!apiKey) return null;
  switch (model.provider) {
    case "anthropic":
      return anthropicModel(model.modelId, apiKey);
    default:
      return null;
  }
}

/** Lo que se guarda en `AiUsage.model`: en modo simulado, `mock:<modelo>` (coste 0). */
export function usageModelRef(model: ModelRef, config: AiConfig): { provider: string; ref: string } {
  return config.mode === "mock" ? { provider: "mock", ref: `mock:${model.modelId}` } : { provider: model.provider, ref: model.ref };
}

export function isModelAvailable(model: ModelRef, config: AiConfig): boolean {
  return config.mode === "mock" || (model.provider === "anthropic" && Boolean(config.apiKeys.anthropic));
}
