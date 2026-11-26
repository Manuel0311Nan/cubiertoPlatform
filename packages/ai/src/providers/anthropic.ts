import { createAnthropic } from "@ai-sdk/anthropic";
import type { LanguageModel } from "ai";

/** Proveedor por defecto (AI-01). El SDK de Anthropic solo se importa aquí (CLAUDE.md §11). */
export function anthropicModel(modelId: string, apiKey: string): LanguageModel {
  return createAnthropic({ apiKey })(modelId);
}
