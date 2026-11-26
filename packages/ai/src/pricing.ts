/**
 * AI-03: precio por millón de tokens de cada modelo, para estimar el coste de cada llamada.
 *
 * Los proveedores publican sus precios en dólares; se convierten con `EUR_PER_USD`.
 * **Revisar** cuando el proveedor cambie tarifas o el cambio se mueva mucho.
 * Precios de Anthropic consultados el 27/11/2026 (platform.claude.com/docs/en/about-claude/pricing).
 */

/** Euros por dólar. Algo por encima del cambio real (≈0,87 a finales de 2026): mejor sobrestimar el gasto. */
export const EUR_PER_USD = 0.9;

export interface ModelPrice {
  /** Dólares por millón de tokens de entrada y de salida. */
  inputUsd: number;
  outputUsd: number;
  /** Algunos modelos cobran más a partir de cierto tamaño de prompt (Haiku 5.5: más de 100.000 tokens). */
  longPrompt?: { aboveInputTokens: number; inputUsd: number; outputUsd: number };
}

export const MODEL_PRICES: Readonly<Record<string, ModelPrice>> = {
  "anthropic:claude-haiku-5-5": {
    inputUsd: 0.1,
    outputUsd: 0.5,
    longPrompt: { aboveInputTokens: 100_000, inputUsd: 0.5, outputUsd: 2.5 },
  },
  "anthropic:claude-sonnet-5-5": { inputUsd: 2, outputUsd: 10 },
  "anthropic:claude-opus-5-5": { inputUsd: 4, outputUsd: 20 },
};

/** Para un modelo sin precio en la tabla: el más caro, para no gastar de más sin darnos cuenta. */
const UNKNOWN_MODEL_PRICE: ModelPrice = { inputUsd: 10, outputUsd: 50 };

/**
 * Coste estimado en micro-euros (1 € = 1.000.000), redondeado hacia arriba.
 * Tokens × €/millón de tokens = micro-euros.
 */
export function estimateCostMicros(modelRef: string, inputTokens: number, outputTokens: number): number {
  if (modelRef.startsWith("mock:")) return 0;
  const base = MODEL_PRICES[modelRef] ?? UNKNOWN_MODEL_PRICE;
  const price = base.longPrompt && inputTokens > base.longPrompt.aboveInputTokens ? base.longPrompt : base;
  const usd = inputTokens * price.inputUsd + outputTokens * price.outputUsd;
  return Math.ceil(usd * EUR_PER_USD);
}

export function hasKnownPrice(modelRef: string): boolean {
  return modelRef.startsWith("mock:") || modelRef in MODEL_PRICES;
}
