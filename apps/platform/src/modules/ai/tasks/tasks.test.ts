import { readFileSync } from "node:fs";
import { runTask, readAiConfig } from "@cubierto/ai";
import { describe, expect, test } from "vitest";
import { AI_TASKS, findAiTask } from ".";

interface EvalFile {
  task: string;
  version: number;
  cases: { name: string; input: unknown }[];
}

const evals: Record<string, EvalFile> = {
  "menu.translate": JSON.parse(readFileSync(new URL("./menu-translate/evals.json", import.meta.url), "utf8")) as EvalFile,
};

/** Formas de datos personales de comensales que nunca deben ir a una tarea `personalData: none`. */
const PERSONAL_DATA = [/[\w.+-]+@[\w-]+\.[\w.]+/, /(?:\+34|0034)?[\s-]?[6789]\d{2}[\s-]?\d{3}[\s-]?\d{3}/];

describe("AI-02 y AI-08 · tareas registradas", () => {
  test("AI-02: cada tarea tiene id, versión y nivel, y se encuentra por su id", () => {
    for (const [id, task] of Object.entries(AI_TASKS)) {
      expect(task.id).toBe(id);
      expect(task.version).toBeGreaterThan(0);
      expect(["fast", "standard", "advanced"]).toContain(task.tier);
      expect(findAiTask(id)).toBe(task);
    }
    expect(findAiTask("no.existe")).toBeNull();
  });

  test("AI-08: los evals de cada tarea son de su versión y valen con el proveedor simulado", async () => {
    for (const [id, file] of Object.entries(evals)) {
      const task = findAiTask(id)!;
      expect(file.task).toBe(id);
      expect(file.version, `evals.json de ${id} es de otra versión`).toBe(task.version);
      expect(file.cases.length).toBeGreaterThanOrEqual(5);
      for (const evalCase of file.cases) {
        const { result } = await runTask(task, evalCase.input, { config: readAiConfig({ AI_PROVIDER: "mock" }) });
        expect(result.ok, `${id} · ${evalCase.name}`).toBe(true);
      }
    }
  });

  test("AI-07: las tareas personalData none no envían emails ni teléfonos al modelo", () => {
    for (const [id, file] of Object.entries(evals)) {
      const task = findAiTask(id)!;
      if (task.personalData !== "none") continue;
      for (const evalCase of file.cases) {
        const { system, prompt } = task.buildPrompt(task.input.parse(evalCase.input));
        for (const pattern of PERSONAL_DATA) expect(`${system}\n${prompt}`).not.toMatch(pattern);
      }
    }
  });
});
