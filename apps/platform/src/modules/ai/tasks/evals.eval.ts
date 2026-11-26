import { readFileSync } from "node:fs";
import { isModelAvailable, readAiConfig, runTask } from "@cubierto/ai";
import { describe, expect, test } from "vitest";
import { findAiTask } from ".";

/**
 * AI-08: evals de una tarea contra el modelo real (`pnpm ai:eval <tarea>`). Cada caso de
 * `<carpeta>/evals.json` comprueba rutas de la salida con `equals`, `includesAny` o `excludesAll`.
 */

interface Check {
  path: string;
  equals?: string | number | boolean | null;
  includesAny?: string[];
  excludesAll?: string[];
}

interface EvalFile {
  task: string;
  version: number;
  cases: { name: string; input: unknown; checks: Check[] }[];
}

const taskId = process.env.AI_EVAL_TASK ?? "";
const task = findAiTask(taskId);
const folder = taskId.replace(".", "-");

function valueAt(data: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((value, key) => (value !== null && typeof value === "object" ? (value as Record<string, unknown>)[key] : undefined), data);
}

describe(`AI-08 · evals de ${taskId || "(sin tarea)"}`, () => {
  if (!task) {
    test("tarea registrada", () => {
      throw new Error(`No hay ninguna tarea "${taskId}" en modules/ai/tasks`);
    });
    return;
  }
  const file = JSON.parse(readFileSync(new URL(`./${folder}/evals.json`, import.meta.url), "utf8")) as EvalFile;
  // Modelo real aunque vitest ponga NODE_ENV=test; en CI sigue siendo el simulado.
  const config = readAiConfig({ ...process.env, NODE_ENV: "production", AI_PROVIDER: "live" });
  const model = config.models[task.tier];
  let spentMicros = 0;

  test("hay proveedor real configurado", () => {
    expect(config.mode, "En CI no se ejecutan evals reales").toBe("live");
    expect(isModelAvailable(model, config), `Falta la clave de ${model.provider} (p. ej. ANTHROPIC_API_KEY)`).toBe(true);
    expect(file.version, "evals.json es de otra versión de la tarea").toBe(task.version);
  });

  for (const evalCase of file.cases) {
    test(evalCase.name, async () => {
      const { result, calls } = await runTask(task, evalCase.input, { config });
      spentMicros += calls.reduce((sum, call) => sum + call.costMicros, 0);
      expect(result.ok, result.ok ? "" : result.code).toBe(true);
      if (!result.ok) return;
      for (const check of evalCase.checks) {
        const value = valueAt(result.data, check.path);
        if (check.equals !== undefined) expect(value ?? null, check.path).toEqual(check.equals);
        const text = String(value ?? "").toLowerCase();
        if (check.includesAny) expect(check.includesAny.some((word) => text.includes(word.toLowerCase())), `${check.path}: "${String(value)}" no contiene ninguna de ${check.includesAny.join(", ")}`).toBe(true);
        if (check.excludesAll) expect(check.excludesAll.filter((word) => text.includes(word.toLowerCase())), check.path).toEqual([]);
      }
    });
  }

  test("coste", () => {
    console.log(`[ai:eval] ${taskId} v${task.version} con ${model.ref}: ${(spentMicros / 1_000_000).toFixed(4)} € estimados`);
  });
});
