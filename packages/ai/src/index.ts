/**
 * @cubierto/ai — conexión con los proveedores de IA (04-ia.md §3). Sin Prisma ni Next.
 * Es el único sitio donde se importan SDKs de proveedores (CLAUDE.md §11).
 */
export { runTask, type AiCallRecord, type AiResult, type MockCall, type RunTaskOptions, type RunTaskOutcome } from "./client.ts";
export { AI_ERROR_CODES, type AiCallStatus, type AiErrorCode } from "./errors.ts";
export { AI_TIERS, DEFAULT_MODELS, DEFAULT_TIMEOUT_MS, parseModelRef, readAiConfig, resolveMode, type AiConfig, type AiMode, type AiTier, type ModelRef } from "./models.ts";
export { EUR_PER_USD, MODEL_PRICES, estimateCostMicros, hasKnownPrice, type ModelPrice } from "./pricing.ts";
export { isModelAvailable } from "./providers/registry.ts";
export { defineTask, type AiTask } from "./task.ts";
