import type { LanguageModel } from "ai";
import { MockLanguageModelV4 } from "ai/test";

/**
 * AI-08: proveedor simulado. Pasa por el mismo `generateText` que los reales (salida
 * estructurada, validación, uso), pero sin red y con coste 0.
 *
 * `respond` devuelve el texto que "contesta" el modelo (normalmente el JSON de `task.mock`).
 * Si lanza, se comporta como un fallo del proveedor.
 */
export type MockRespond = () => string | Promise<string>;

/** Unos 4 caracteres por token: suficiente para que el uso registrado no sea 0. */
const tokens = (text: string) => Math.max(1, Math.ceil(text.length / 4));

/** Como un fetch real: si el SDK aborta la llamada (tiempo máximo), la respuesta ya no llega. */
function abortable<T>(promise: Promise<T>, signal: AbortSignal | undefined): Promise<T> {
  if (!signal) return promise;
  signal.throwIfAborted();
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(signal.reason);
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener("abort", onAbort));
  });
}

export function mockModel(modelId: string, respond: MockRespond): LanguageModel {
  return new MockLanguageModelV4({
    provider: "mock",
    modelId,
    doGenerate: async (options) => {
      const text = await abortable(Promise.resolve().then(respond), options.abortSignal);
      const input = tokens(JSON.stringify(options.prompt));
      const output = tokens(text);
      return {
        content: [{ type: "text", text }],
        finishReason: { unified: "stop", raw: undefined },
        usage: {
          inputTokens: { total: input, noCache: input, cacheRead: undefined, cacheWrite: undefined },
          outputTokens: { total: output, text: output, reasoning: undefined },
        },
        warnings: [],
      };
    },
  });
}
