import { getSystemDb } from "@cubierto/db";
import { aiBudgetEmail } from "../../domain/templates/ai-budget-email";
import { NonRetryableError, type JsonObject, type OutboxHandler } from "../outbox-handler";

/** AI-04: aviso al superadmin del tope global de IA de la plataforma (80 % y 100 %). */
export const AI_BUDGET_EVENT = "ai.global_budget";

export interface AiBudgetEventPayload {
  /** "2026-11" */
  month: string;
  threshold: number;
  spentMicros: number;
  budgetMicros: number;
}

function numberOf(payload: JsonObject, key: string): number {
  const value = payload[key];
  if (typeof value !== "number" || !Number.isFinite(value)) throw new NonRetryableError(`Falta "${key}" en el evento`);
  return value;
}

export const aiBudgetHandler: OutboxHandler = {
  async deliver(payload, { eventId, email }) {
    const admins = await getSystemDb().user.findMany({ where: { isSuperadmin: true }, select: { id: true, email: true } });
    if (admins.length === 0) throw new NonRetryableError("No hay superadmin al que avisar");
    const month = typeof payload.month === "string" ? payload.month : "";
    for (const admin of admins) {
      const message = aiBudgetEmail({
        to: admin.email,
        month,
        threshold: numberOf(payload, "threshold"),
        spentMicros: numberOf(payload, "spentMicros"),
        budgetMicros: numberOf(payload, "budgetMicros"),
        url: `${process.env.BETTER_AUTH_URL ?? ""}/admin/ia`,
      });
      // Una clave por destinatario: si el reintento repite a uno, Resend no lo duplica.
      await email.send(message, { idempotencyKey: `${eventId}:${admin.id}` });
    }
  },
};
