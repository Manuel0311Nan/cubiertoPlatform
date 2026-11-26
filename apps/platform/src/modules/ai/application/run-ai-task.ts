import { readAiConfig, runTask, type AiCallRecord, type AiConfig, type AiResult, type AiTask, type AiTier, type MockCall } from "@cubierto/ai";
import { getSystemDb, getTenantDb } from "@cubierto/db";
import {
  DEFAULT_MONTHLY_BUDGET_MICROS,
  checkBeforeRun,
  crossedGlobalThresholds,
  monthStart,
  readGlobalBudgetMicros,
  type GlobalAiState,
  type TenantAiState,
} from "../domain/budget";
import { recordGlobalBudgetWarnings } from "./global-budget";

/**
 * AI-03 y AI-04: la única forma de usar un modelo desde la plataforma (CLAUDE.md §6.10).
 *
 * Antes de llamar: IA activada para el local, tarea no desactivada, presupuesto del mes, tope
 * global y 20 llamadas por minuto. Después: un `AiUsage` por llamada, también las fallidas.
 *
 * **Nunca** dentro de una transacción ni durante el render de una página pública: llamar desde
 * una Server Action, un trabajo en segundo plano (`enqueueAiJob`) o `after()`.
 *
 * `tenantId` null = uso interno o del superadmin ("Probar conexión"): sin presupuesto de local.
 */
export interface RunAiTaskOptions<I> {
  /** Trabajo en segundo plano al que pertenece la llamada (AI-05). */
  jobId?: string;
  /** Solo para "Probar conexión" por nivel (AI-01). */
  tier?: AiTier;
  now?: () => Date;
  config?: AiConfig;
  /** Respuesta del proveedor simulado en tests (AI-08). */
  mock?: (call: MockCall<I>) => string | Promise<string>;
  /** Tope global; por defecto, `AI_GLOBAL_BUDGET_EUR`. */
  globalBudgetMicros?: number | null;
}

const MINUTE_MS = 60_000;

async function tenantState(tenantId: string, now: Date): Promise<TenantAiState> {
  const db = getTenantDb(tenantId);
  const [settings, spent, callsLastMinute] = await Promise.all([
    db.aiSettings.findUnique({ where: { tenantId } }),
    db.aiUsage.aggregate({ where: { createdAt: { gte: monthStart(now) } }, _sum: { costMicros: true } }),
    db.aiUsage.count({ where: { createdAt: { gt: new Date(now.getTime() - MINUTE_MS) } } }),
  ]);
  return {
    enabled: settings?.enabled ?? true,
    disabledTasks: settings?.disabledTasks ?? [],
    monthlyBudgetMicros: settings?.monthlyBudgetMicros ?? DEFAULT_MONTHLY_BUDGET_MICROS,
    spentMicros: spent._sum.costMicros ?? 0,
    callsLastMinute,
  };
}

/** Gasto de toda la plataforma este mes (systemDb: suma los de todos los locales y el uso interno). */
export async function globalSpentMicros(now: Date): Promise<number> {
  const spent = await getSystemDb().aiUsage.aggregate({ where: { createdAt: { gte: monthStart(now) } }, _sum: { costMicros: true } });
  return spent._sum.costMicros ?? 0;
}

async function recordCalls(tenantId: string | null, task: AiTask<unknown, unknown>, calls: AiCallRecord[], jobId: string | undefined, now: Date) {
  if (calls.length === 0) return;
  const data = calls.map((call) => ({
    taskId: task.id,
    taskVersion: task.version,
    provider: call.provider,
    model: call.model,
    inputTokens: call.inputTokens,
    outputTokens: call.outputTokens,
    costMicros: call.costMicros,
    latencyMs: call.latencyMs,
    status: call.status,
    jobId: jobId ?? null,
    createdAt: now,
  }));
  if (tenantId) await getTenantDb(tenantId).aiUsage.createMany({ data: data.map((row) => ({ ...row, tenantId })) });
  else await getSystemDb().aiUsage.createMany({ data: data.map((row) => ({ ...row, tenantId: null })) });
}

export async function runAiTask<I, O>(tenantId: string | null, task: AiTask<I, O>, input: I, options: RunAiTaskOptions<I> = {}): Promise<AiResult<O>> {
  const now = options.now?.() ?? new Date();
  const config = options.config ?? readAiConfig();
  const budgetMicros = options.globalBudgetMicros !== undefined ? options.globalBudgetMicros : readGlobalBudgetMicros(process.env.AI_GLOBAL_BUDGET_EUR);

  const [tenant, globalSpent] = await Promise.all([
    tenantId ? tenantState(tenantId, now) : Promise.resolve(null),
    budgetMicros === null ? Promise.resolve(0) : globalSpentMicros(now),
  ]);
  const global: GlobalAiState = { budgetMicros, spentMicros: globalSpent };
  const blocked = checkBeforeRun(task, tenant, global);
  if (blocked) return { ok: false, code: blocked };

  const { result, calls } = await runTask(task, input, { config, tier: options.tier, mock: options.mock });
  await recordCalls(tenantId, task as AiTask<unknown, unknown>, calls, options.jobId, now);

  const spentNow = calls.reduce((total, call) => total + call.costMicros, 0);
  const crossed = crossedGlobalThresholds(globalSpent, globalSpent + spentNow, budgetMicros);
  if (crossed.length > 0 && budgetMicros !== null) {
    await recordGlobalBudgetWarnings(crossed, { now, spentMicros: globalSpent + spentNow, budgetMicros });
  }
  return result;
}
