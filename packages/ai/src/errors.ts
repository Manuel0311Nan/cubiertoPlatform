/** Resultados de error de una tarea de IA (04-ia.md §3). Son resultados tipados, no excepciones. */
export const AI_ERROR_CODES = [
  "AI_DISABLED",
  "AI_BUDGET_EXCEEDED",
  "AI_RATE_LIMITED",
  "AI_TIMEOUT",
  "AI_PROVIDER_ERROR",
  "AI_INVALID_OUTPUT",
] as const;

export type AiErrorCode = (typeof AI_ERROR_CODES)[number];

/** Estado de una llamada concreta al proveedor, tal como se guarda en `AiUsage.status` (AI-03). */
export type AiCallStatus = "ok" | "invalid_output" | "timeout" | "provider_error";
