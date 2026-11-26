import { defineTask } from "@cubierto/ai";
import { z } from "zod";

/**
 * AI-01 · `system.ping`: "Probar conexión" por nivel en el superadmin. Una llamada mínima que
 * se registra como uso interno (sin local). Esencial: funciona aunque se agote el tope global.
 */
export const systemPingV1 = defineTask({
  id: "system.ping",
  version: 1,
  tier: "fast",
  input: z.object({}),
  output: z.object({ ok: z.literal(true) }),
  personalData: "none",
  maxOutputTokens: 20,
  essential: true,
  buildPrompt: () => ({ system: "Comprobación de conexión.", prompt: 'Responde solo con este JSON: {"ok": true}' }),
  mock: () => ({ ok: true as const }),
});
