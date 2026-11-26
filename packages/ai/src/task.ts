import type { z } from "zod";
import type { AiTier } from "./models.ts";

/**
 * AI-02: contrato de una tarea de IA. Cada uso de un modelo es una tarea registrada en
 * `apps/platform/src/modules/ai/tasks/`, con su versión, nivel, schemas y prompt.
 * Cambiar el prompt o un schema obliga a subir `version` y a pasar sus evals (AI-08).
 */
export interface AiTask<I, O> {
  /** "menu.translate" */
  id: string;
  version: number;
  tier: AiTier;
  input: z.ZodType<I>;
  /** La respuesta del modelo se valida siempre con este schema. */
  output: z.ZodType<O>;
  /**
   * AI-07: `none` no recibe datos de comensales (nombres, teléfonos, emails, notas);
   * `minimal` solo lo imprescindible y nunca datos de salud.
   */
  personalData: "none" | "minimal";
  maxOutputTokens: number;
  buildPrompt(input: I): { system: string; prompt: string };
  /**
   * Comprobación de la salida que el schema no puede expresar (p. ej. que traduzca las mismas
   * claves que recibió). Devuelve el motivo si no vale; cuenta como salida no válida (AI-02).
   */
  check?(input: I, output: O): string | null;
  /** AI-08: respuesta del proveedor simulado (tests, CI, previews y local sin clave de pago). */
  mock(input: I): O;
  /**
   * AI-04: al llegar al tope global de la plataforma se cortan las tareas no esenciales.
   * Por defecto, no esencial.
   */
  essential?: boolean;
}

/** Ayuda a escribir una tarea con los tipos inferidos de sus schemas. */
export function defineTask<I, O>(task: AiTask<I, O>): AiTask<I, O> {
  return task;
}
