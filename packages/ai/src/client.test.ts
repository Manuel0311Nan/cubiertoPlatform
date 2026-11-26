import { describe, expect, test } from "vitest";
import { z } from "zod";
import { runTask } from "./client.ts";
import { readAiConfig, type AiConfig } from "./models.ts";
import { defineTask } from "./task.ts";

const echo = defineTask({
  id: "test.echo",
  version: 1,
  tier: "fast",
  input: z.object({ words: z.array(z.string()).min(1) }),
  output: z.object({ words: z.array(z.string()) }),
  personalData: "none",
  maxOutputTokens: 200,
  buildPrompt: ({ words }) => ({ system: "Repite las palabras.", prompt: words.join(" ") }),
  check: (input, output) => (output.words.length === input.words.length ? null : "número de palabras distinto"),
  mock: ({ words }) => ({ words: words.map((w) => w.toUpperCase()) }),
});

const mockConfig = (overrides: Partial<AiConfig> = {}): AiConfig => ({ ...readAiConfig({ AI_PROVIDER: "mock" }), ...overrides });
const input = { words: ["hola", "mundo"] };

describe("@cubierto/ai · runTask", () => {
  test("AI-08: en modo simulado responde con task.mock, valida la salida y registra el uso a coste 0", async () => {
    const { result, calls } = await runTask(echo, input, { config: mockConfig() });
    expect(result).toMatchObject({ ok: true, data: { words: ["HOLA", "MUNDO"] }, usage: { model: "mock:claude-haiku-5-5", costMicros: 0 } });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ provider: "mock", status: "ok", costMicros: 0 });
    expect(calls[0]!.inputTokens).toBeGreaterThan(0);
  });

  test("AI-02: una respuesta que no cumple el schema se repite una vez", async () => {
    const { result, calls } = await runTask(echo, input, {
      config: mockConfig(),
      mock: ({ call }) => (call === 1 ? '{"palabras": 3}' : '{"words": ["A", "B"]}'),
    });
    expect(result).toMatchObject({ ok: true, data: { words: ["A", "B"] } });
    expect(calls.map((c) => c.status)).toEqual(["invalid_output", "ok"]);
  });

  test("AI-02: si vuelve a fallar devuelve AI_INVALID_OUTPUT, sin más llamadas", async () => {
    const { result, calls } = await runTask(echo, input, { config: mockConfig(), mock: () => "esto no es JSON" });
    expect(result).toEqual({ ok: false, code: "AI_INVALID_OUTPUT" });
    expect(calls.map((c) => c.status)).toEqual(["invalid_output", "invalid_output"]);
  });

  test("AI-02: la comprobación propia de la tarea también cuenta como salida no válida", async () => {
    const { result, calls } = await runTask(echo, input, { config: mockConfig(), mock: () => '{"words": ["SOLO"]}' });
    expect(result).toEqual({ ok: false, code: "AI_INVALID_OUTPUT" });
    expect(calls[0]!.error).toContain("número de palabras distinto");
  });

  test("AI-01: sin clave del proveedor devuelve AI_DISABLED y no llama a nada", async () => {
    const { result, calls } = await runTask(echo, input, { config: readAiConfig({ AI_PROVIDER: "live" }) });
    expect(result).toEqual({ ok: false, code: "AI_DISABLED" });
    expect(calls).toEqual([]);
  });

  test("AI-01: un fallo del proveedor devuelve AI_PROVIDER_ERROR", async () => {
    const { result, calls } = await runTask(echo, input, {
      config: mockConfig(),
      providerRetries: 0,
      mock: () => {
        throw new Error("Overloaded");
      },
    });
    expect(result).toEqual({ ok: false, code: "AI_PROVIDER_ERROR" });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ status: "provider_error" });
  });

  test("AI-01: si el principal falla y hay respaldo, se prueba el respaldo una vez", async () => {
    const config = readAiConfig({ AI_PROVIDER: "mock", AI_FALLBACK_FAST: "openai:gpt-backup" });
    const { result, calls } = await runTask(echo, input, {
      config,
      providerRetries: 0,
      mock: ({ model }) => {
        if (model === "mock:claude-haiku-5-5") throw new Error("Overloaded");
        return '{"words": ["X", "Y"]}';
      },
    });
    expect(result).toMatchObject({ ok: true, usage: { model: "mock:gpt-backup" } });
    expect(calls.map((c) => [c.model, c.status])).toEqual([
      ["mock:claude-haiku-5-5", "provider_error"],
      ["mock:gpt-backup", "ok"],
    ]);
  });

  test("AI-01: una llamada que pasa del tiempo máximo devuelve AI_TIMEOUT", async () => {
    const { result, calls } = await runTask(echo, input, {
      config: mockConfig({ timeoutMs: 50 }),
      providerRetries: 0,
      mock: () => new Promise((resolve) => setTimeout(() => resolve('{"words": ["A", "B"]}'), 400)),
    });
    expect(result).toEqual({ ok: false, code: "AI_TIMEOUT" });
    expect(calls[0]).toMatchObject({ status: "timeout" });
  });

  test("AI-01: el nivel puede forzarse para probar la conexión", async () => {
    const { result } = await runTask(echo, input, { config: mockConfig(), tier: "advanced" });
    expect(result).toMatchObject({ ok: true, usage: { model: "mock:claude-opus-5-5" } });
  });

  test("AI-02: una entrada que no cumple su schema es un fallo de programación", async () => {
    await expect(runTask(echo, { words: [] }, { config: mockConfig() })).rejects.toThrow();
  });
});
