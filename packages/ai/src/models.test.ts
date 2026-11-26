import { describe, expect, test } from "vitest";
import { parseModelRef, readAiConfig, resolveMode } from "./models.ts";
import { estimateCostMicros } from "./pricing.ts";

describe("@cubierto/ai · configuración y precios", () => {
  test("AI-01: el modelo de cada nivel sale del entorno, con valores por defecto", () => {
    const config = readAiConfig({ AI_PROVIDER: "live", AI_MODEL_STANDARD: "anthropic:claude-opus-5-5", ANTHROPIC_API_KEY: "k" });
    expect(config.models.fast.ref).toBe("anthropic:claude-haiku-5-5");
    expect(config.models.standard.ref).toBe("anthropic:claude-opus-5-5");
    expect(config.fallbacks).toEqual({});
    expect(config.timeoutMs).toBe(30_000);
    expect(config.apiKeys.anthropic).toBe("k");
  });

  test("AI-01: un modelo mal escrito en el entorno es un error de configuración", () => {
    expect(() => readAiConfig({ AI_MODEL_FAST: "claude-haiku" })).toThrow(/AI_MODEL_FAST/);
    expect(parseModelRef("anthropic:claude-haiku-5-5")).toEqual({ provider: "anthropic", modelId: "claude-haiku-5-5", ref: "anthropic:claude-haiku-5-5" });
  });

  test("AI-08: tests, CI y previews de Vercel usan siempre el proveedor simulado", () => {
    expect(resolveMode({ NODE_ENV: "test" })).toBe("mock");
    expect(resolveMode({ CI: "true" })).toBe("mock");
    expect(resolveMode({ VERCEL_ENV: "preview" })).toBe("mock");
    expect(resolveMode({ AI_PROVIDER: "mock", VERCEL_ENV: "production" })).toBe("mock");
    expect(resolveMode({ VERCEL_ENV: "production" })).toBe("live");
  });

  test("AI-03: coste estimado en micro-euros con la tabla de precios", () => {
    // Haiku 5.5: 1.000 × 0,10 $ + 500 × 0,50 $ = 350 µ$ → × 0,9 = 315 µ€
    expect(estimateCostMicros("anthropic:claude-haiku-5-5", 1000, 500)).toBe(315);
    // Más de 100.000 tokens de prompt: tarifa larga (0,50 $ y 2,50 $)
    expect(estimateCostMicros("anthropic:claude-haiku-5-5", 200_000, 0)).toBe(90_000);
    expect(estimateCostMicros("anthropic:claude-sonnet-5-5", 1000, 1000)).toBe(10_800);
    expect(estimateCostMicros("mock:claude-haiku-5-5", 1000, 1000)).toBe(0);
    // Sin precio conocido: el más caro, para no quedarse corto.
    expect(estimateCostMicros("anthropic:otro", 1000, 0)).toBe(9_000);
  });
});
