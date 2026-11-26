// AI-08: `pnpm ai:eval <tarea>` (p. ej. `pnpm ai:eval menu.translate`). Ver vitest.eval.config.mts.
import { spawnSync } from "node:child_process";

const task = process.argv[2];
if (!task) {
  console.error("Uso: pnpm ai:eval <tarea>   (p. ej. pnpm ai:eval menu.translate)");
  process.exit(1);
}
const result = spawnSync("vitest", ["run", "--config", "vitest.eval.config.mts"], {
  stdio: "inherit",
  shell: process.platform === "win32",
  env: { ...process.env, AI_EVAL_TASK: task },
});
process.exit(result.status ?? 1);
