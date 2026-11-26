import { getSystemDb, getTenantDb } from "@cubierto/db";
import { DEFAULT_MONTHLY_BUDGET_MICROS, monthStart, nextMonthStart, readGlobalBudgetMicros } from "../domain/budget";
import { globalSpentMicros } from "./run-ai-task";

/** AI-03: lo usado este mes frente a lo incluido. Para el panel del local cuando se decida mostrarlo (04-ia.md §8). */
export async function getTenantAiUsage(tenantId: string, now = new Date()) {
  const db = getTenantDb(tenantId);
  const [settings, spent] = await Promise.all([
    db.aiSettings.findUnique({ where: { tenantId } }),
    db.aiUsage.aggregate({ where: { createdAt: { gte: monthStart(now) } }, _sum: { costMicros: true }, _count: true }),
  ]);
  return {
    enabled: settings?.enabled ?? true,
    spentMicros: spent._sum.costMicros ?? 0,
    calls: spent._count,
    budgetMicros: settings?.monthlyBudgetMicros ?? DEFAULT_MONTHLY_BUDGET_MICROS,
    renewsAt: nextMonthStart(now),
  };
}

/** AI-01 y AI-04: gasto de la plataforma este mes y su tope, para el superadmin. */
export async function getPlatformAiUsage(now = new Date()) {
  const budgetMicros = readGlobalBudgetMicros(process.env.AI_GLOBAL_BUDGET_EUR);
  const [spentMicros, calls] = await Promise.all([
    globalSpentMicros(now),
    getSystemDb().aiUsage.count({ where: { createdAt: { gte: monthStart(now) } } }),
  ]);
  return { spentMicros, calls, budgetMicros };
}
