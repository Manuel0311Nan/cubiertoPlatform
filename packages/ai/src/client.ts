import { generateText, JSONParseError, NoObjectGeneratedError, NoOutputGeneratedError, Output, TypeValidationError, type LanguageModelUsage } from "ai";
import type { AiCallStatus, AiErrorCode } from "./errors.ts";
import { readAiConfig, type AiConfig, type AiTier, type ModelRef } from "./models.ts";
import { estimateCostMicros } from "./pricing.ts";
import { isModelAvailable, resolveModel, usageModelRef } from "./providers/registry.ts";
import type { AiTask } from "./task.ts";

/** Una llamada al proveedor, tal como se guarda en `AiUsage` (AI-03). Sin texto del prompt ni de la respuesta (AI-07). */
export interface AiCallRecord {
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costMicros: number;
  latencyMs: number;
  status: AiCallStatus;
  /** Motivo técnico si falló (nombre del error y mensaje corto). */
  error?: string;
}

export type AiResult<O> =
  | { ok: true; data: O; usage: { inputTokens: number; outputTokens: number; costMicros: number; model: string } }
  | { ok: false; code: AiErrorCode };

export interface RunTaskOutcome<O> {
  result: AiResult<O>;
  /** Todas las llamadas hechas, también las fallidas: cada una es un `AiUsage`. */
  calls: AiCallRecord[];
}

/** Contexto de cada llamada simulada, para que un test decida qué contesta el "modelo". */
export interface MockCall<I> {
  taskId: string;
  input: I;
  /** 1 = primera llamada de esta ejecución. */
  call: number;
  model: string;
}

export interface RunTaskOptions<I> {
  config?: AiConfig;
  /** AI-08: respuesta del proveedor simulado. Por defecto, `JSON.stringify(task.mock(input))`. */
  mock?: (call: MockCall<I>) => string | Promise<string>;
  /** Solo para diagnóstico ("Probar conexión" por nivel, AI-01): usa este nivel en vez del de la tarea. */
  tier?: AiTier;
  /** Reintentos del SDK ante 429 y 5xx, con espera creciente. AI-01: uno. */
  providerRetries?: number;
  signal?: AbortSignal;
  now?: () => number;
}

type Attempt<O> = { record: AiCallRecord; data?: O };

const INVALID_OUTPUT_ATTEMPTS = 2;

function tokensOf(usage: LanguageModelUsage | undefined) {
  return { inputTokens: usage?.inputTokens ?? 0, outputTokens: usage?.outputTokens ?? 0 };
}

function classify(error: unknown): Exclude<AiCallStatus, "ok"> {
  if (
    NoObjectGeneratedError.isInstance(error) ||
    NoOutputGeneratedError.isInstance(error) ||
    TypeValidationError.isInstance(error) ||
    JSONParseError.isInstance(error)
  ) {
    return "invalid_output";
  }
  const name = error instanceof Error ? error.name : "";
  const causeName = error instanceof Error && error.cause instanceof Error ? error.cause.name : "";
  if (name === "TimeoutError" || causeName === "TimeoutError") return "timeout";
  return "provider_error";
}

function describe(error: unknown): string {
  if (!(error instanceof Error)) return String(error).slice(0, 200);
  return `${error.name}: ${error.message}`.slice(0, 200);
}

const CODE_FOR: Readonly<Record<Exclude<AiCallStatus, "ok">, AiErrorCode>> = {
  invalid_output: "AI_INVALID_OUTPUT",
  timeout: "AI_TIMEOUT",
  provider_error: "AI_PROVIDER_ERROR",
};

/**
 * Punto de entrada único a un modelo (AI-01, AI-02). No sabe de tenants, presupuestos ni base de
 * datos: eso lo pone `runAiTask` en `apps/platform/src/modules/ai`, que guarda `calls` en `AiUsage`.
 *
 * - Sin proveedor disponible (sin clave) → `AI_DISABLED`, sin llamar a nada.
 * - Salida que no cumple el schema (o `task.check`) → se repite una vez; después `AI_INVALID_OUTPUT`.
 * - 429 / 5xx → el SDK reintenta una vez con espera; si sigue fallando (o se pasa del tiempo) y hay
 *   respaldo configurado para el nivel, se prueba el respaldo una vez.
 */
export async function runTask<I, O>(task: AiTask<I, O>, rawInput: I, options: RunTaskOptions<I> = {}): Promise<RunTaskOutcome<O>> {
  const input = task.input.parse(rawInput);
  const config = options.config ?? readAiConfig();
  const now = options.now ?? (() => performance.now());
  const tier = options.tier ?? task.tier;
  const candidates = [config.models[tier], config.fallbacks[tier]].filter(
    (model): model is ModelRef => model !== undefined && isModelAvailable(model, config),
  );
  const calls: AiCallRecord[] = [];
  if (candidates.length === 0) return { result: { ok: false, code: "AI_DISABLED" }, calls };

  const { system, prompt } = task.buildPrompt(input);
  let callNumber = 0;

  async function attempt(model: ModelRef): Promise<Attempt<O>> {
    callNumber += 1;
    const call = callNumber;
    const { provider, ref } = usageModelRef(model, config);
    const respond = () => (options.mock ? options.mock({ taskId: task.id, input, call, model: ref }) : JSON.stringify(task.mock(input)));
    const languageModel = resolveModel(model, config, respond)!;
    const started = now();
    const record = (status: AiCallStatus, usage: LanguageModelUsage | undefined, error?: unknown): AiCallRecord => {
      const tokens = tokensOf(usage);
      return {
        provider,
        model: ref,
        ...tokens,
        costMicros: estimateCostMicros(ref, tokens.inputTokens, tokens.outputTokens),
        latencyMs: Math.max(0, Math.round(now() - started)),
        status,
        ...(error === undefined ? {} : { error: describe(error) }),
      };
    };
    try {
      const result = await generateText({
        model: languageModel,
        system,
        prompt,
        output: Output.object({ schema: task.output }),
        maxOutputTokens: task.maxOutputTokens,
        maxRetries: options.providerRetries ?? 1,
        timeout: config.timeoutMs,
        abortSignal: options.signal,
      });
      const data = result.output as O;
      const problem = task.check?.(input, data) ?? null;
      if (problem) return { record: record("invalid_output", result.totalUsage, new Error(`check: ${problem}`)) };
      return { record: record("ok", result.totalUsage), data };
    } catch (error) {
      const usage = NoObjectGeneratedError.isInstance(error) ? error.usage : undefined;
      return { record: record(classify(error), usage, error) };
    }
  }

  let lastStatus: Exclude<AiCallStatus, "ok"> = "provider_error";
  for (const model of candidates) {
    for (let tries = 0; tries < INVALID_OUTPUT_ATTEMPTS; tries += 1) {
      const { record, data } = await attempt(model);
      calls.push(record);
      if (record.status === "ok") {
        const { inputTokens, outputTokens, costMicros, model: modelRef } = record;
        return { result: { ok: true, data: data as O, usage: { inputTokens, outputTokens, costMicros, model: modelRef } }, calls };
      }
      lastStatus = record.status;
      // Una salida mal formada se repite con el mismo modelo; un fallo del proveedor pasa al respaldo.
      if (record.status !== "invalid_output") break;
    }
    if (lastStatus === "invalid_output") break;
  }
  return { result: { ok: false, code: CODE_FOR[lastStatus] }, calls };
}
