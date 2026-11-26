import type { AiTask } from "@cubierto/ai";
import { menuTranslateV1 } from "./menu-translate/v1";
import { systemPingV1 } from "./system-ping/v1";

/**
 * AI-02: tareas registradas. No hay prompts sueltos fuera de esta carpeta (CLAUDE.md §6.10).
 * Una tarea nueva: carpeta `<modulo>-<accion>/` con `v1.ts` y `evals.json`, y una línea aquí.
 * Los trabajos en segundo plano (AI-05) buscan aquí la tarea por su id.
 */
export const AI_TASKS = {
  [menuTranslateV1.id]: menuTranslateV1,
  [systemPingV1.id]: systemPingV1,
} as const;

export type AiTaskId = keyof typeof AI_TASKS;

/** La tarea con ese id, sin tipos concretos (la entrada se valida con su schema al ejecutarla). */
export function findAiTask(id: string): AiTask<unknown, unknown> | null {
  const task = (AI_TASKS as Readonly<Record<string, unknown>>)[id];
  return (task as AiTask<unknown, unknown> | undefined) ?? null;
}
