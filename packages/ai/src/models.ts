/**
 * AI-01: el modelo de cada nivel se lee del entorno, nunca del código de una tarea.
 * Formato `<proveedor>:<modelo>`, p. ej. `anthropic:claude-haiku-5-5`.
 */

export const AI_TIERS = ["fast", "standard", "advanced"] as const;
export type AiTier = (typeof AI_TIERS)[number];

export interface ModelRef {
  provider: string;
  modelId: string;
  /** `<proveedor>:<modelo>`, tal cual se guarda en `AiUsage.model`. */
  ref: string;
}

export const DEFAULT_MODELS: Readonly<Record<AiTier, string>> = {
  fast: "anthropic:claude-haiku-5-5",
  standard: "anthropic:claude-sonnet-5-5",
  advanced: "anthropic:claude-opus-5-5",
};

/** 30 s por llamada (AI-01). */
export const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * - `live`: proveedores reales, si su clave está configurada.
 * - `mock`: respuestas fijas, sin red (AI-08). Siempre en tests, CI y previews de Vercel.
 */
export type AiMode = "live" | "mock";

export interface AiConfig {
  mode: AiMode;
  models: Readonly<Record<AiTier, ModelRef>>;
  fallbacks: Readonly<Partial<Record<AiTier, ModelRef>>>;
  timeoutMs: number;
  /** Claves de API por proveedor. Sin clave, ese proveedor no está disponible (AI_DISABLED). */
  apiKeys: Readonly<Record<string, string | undefined>>;
}

export function parseModelRef(value: string): ModelRef | null {
  const match = /^([a-z0-9-]+):([A-Za-z0-9._-]+)$/.exec(value.trim());
  if (!match) return null;
  const [, provider, modelId] = match as unknown as [string, string, string];
  return { provider, modelId, ref: `${provider}:${modelId}` };
}

type Env = Readonly<Record<string, string | undefined>>;

const ENV_NAME: Readonly<Record<AiTier, string>> = { fast: "FAST", standard: "STANDARD", advanced: "ADVANCED" };

/** AI-08: fuera de producción y de local con `AI_PROVIDER=live`, siempre el proveedor simulado. */
export function resolveMode(env: Env): AiMode {
  if (env.AI_PROVIDER === "mock") return "mock";
  if (env.NODE_ENV === "test" || env.CI === "true" || env.CI === "1" || env.VERCEL_ENV === "preview") return "mock";
  return "live";
}

function modelFromEnv(value: string | undefined, fallback: string, name: string): ModelRef {
  if (!value) return parseModelRef(fallback)!;
  const parsed = parseModelRef(value);
  if (!parsed) throw new Error(`${name} no es válido: usa <proveedor>:<modelo>, p. ej. ${fallback}`);
  return parsed;
}

export function readAiConfig(env: Env = process.env): AiConfig {
  const mode = resolveMode(env);
  const models = Object.fromEntries(
    AI_TIERS.map((tier) => {
      const name = `AI_MODEL_${ENV_NAME[tier]}`;
      return [tier, modelFromEnv(env[name], DEFAULT_MODELS[tier], name)];
    }),
  ) as Record<AiTier, ModelRef>;
  const fallbacks: Partial<Record<AiTier, ModelRef>> = {};
  for (const tier of AI_TIERS) {
    const name = `AI_FALLBACK_${ENV_NAME[tier]}`;
    const value = env[name];
    if (value) fallbacks[tier] = modelFromEnv(value, DEFAULT_MODELS[tier], name);
  }
  const timeout = Number(env.AI_TIMEOUT_MS);
  return {
    mode,
    models,
    fallbacks,
    timeoutMs: Number.isFinite(timeout) && timeout > 0 ? timeout : DEFAULT_TIMEOUT_MS,
    apiKeys: { anthropic: env.ANTHROPIC_API_KEY || undefined, openai: env.OPENAI_API_KEY || undefined },
  };
}
