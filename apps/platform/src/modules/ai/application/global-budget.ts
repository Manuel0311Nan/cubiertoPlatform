import { getSystemDb, Prisma } from "@cubierto/db";
import { AI_BUDGET_EVENT, type AiBudgetEventPayload } from "@/modules/notifications/application/handlers/ai-budget";
import { dispatchOutboxEvent } from "@/modules/notifications/application/outbox";
import { monthKey, type GlobalBudgetThreshold } from "../domain/budget";

/**
 * AI-04: aviso al superadmin por la outbox al llegar al 80 % y al 100 % del tope global del mes.
 * Uno por umbral y mes, aunque varias llamadas lo crucen a la vez.
 */
export async function recordGlobalBudgetWarnings(
  thresholds: readonly GlobalBudgetThreshold[],
  { now, spentMicros, budgetMicros }: { now: Date; spentMicros: number; budgetMicros: number },
): Promise<string[]> {
  const db = getSystemDb();
  const month = monthKey(now);
  const created: string[] = [];
  for (const threshold of thresholds) {
    const payload: AiBudgetEventPayload = { month, threshold, spentMicros, budgetMicros };
    const id = await db.$transaction(async (tx) => {
      // Bloqueo por umbral y mes: dos llamadas que cruzan a la vez no crean dos avisos.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${AI_BUDGET_EVENT}:${month}:${threshold}`}))`;
      const existing = await tx.outboxEvent.findFirst({
        where: {
          type: AI_BUDGET_EVENT,
          AND: [{ payload: { path: ["month"], equals: month } }, { payload: { path: ["threshold"], equals: threshold } }],
        },
        select: { id: true },
      });
      if (existing) return null;
      const event = await tx.outboxEvent.create({
        data: { tenantId: null, type: AI_BUDGET_EVENT, payload: payload as unknown as Prisma.InputJsonObject },
        select: { id: true },
      });
      return event.id;
    });
    if (id) created.push(id);
  }
  // Ya fuera de la transacción (CLAUDE.md §6.5). Si falla, queda para el barrido del outbox.
  for (const id of created) await dispatchOutboxEvent(id);
  return created;
}
