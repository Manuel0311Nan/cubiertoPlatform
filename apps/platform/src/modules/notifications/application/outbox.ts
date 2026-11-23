import { getSystemDb, Prisma, type OutboxEvent } from "@cubierto/db";
import type { EmailSender } from "../domain/email";
import { CLAIM_LEASE_MS, decideAfterFailure } from "../domain/retry";
import { getEmailSender } from "../infra/email-sender";
import { NonRetryableError, payloadOf, type OutboxHandler } from "./outbox-handler";
import { OUTBOX_HANDLERS } from "./outbox-handlers";

/**
 * Outbox (CLAUDE.md §6.5, PLT-08). Los efectos externos se guardan como OutboxEvent en la misma
 * transacción que el cambio de datos y se envían fuera de ella: al momento (`dispatchOutboxEvent`,
 * justo después del commit) o en un barrido (`processDueOutboxEvents`), que también hace los
 * reintentos. Cuándo se barre sin cron cada minuto: PLT-08, "Envíos sin cron cada minuto".
 *
 * El enlace de entrada (PLT-02) no pasa por aquí: se envía directo (notifications/application/magic-link.ts).
 * Los tipos de evento y cómo se entrega cada uno: `outbox-handlers.ts`.
 *
 * Usa systemDb: el barrido recorre los eventos de todos los locales y los de plataforma (tenantId null).
 */

export { NonRetryableError, payloadOf, requireString } from "./outbox-handler";
export type { JsonObject, OutboxHandler, OutboxHandlerContext } from "./outbox-handler";

export interface OutboxDeps {
  email: EmailSender;
  now: () => Date;
  handlers: Readonly<Record<string, OutboxHandler>>;
}

export function defaultOutboxDeps(): OutboxDeps {
  return { email: getEmailSender(), now: () => new Date(), handlers: OUTBOX_HANDLERS };
}

function handlerFor(event: OutboxEvent, deps: OutboxDeps): OutboxHandler {
  const handler = deps.handlers[event.type];
  if (!handler) throw new NonRetryableError(`Tipo de evento sin canal: ${event.type}`);
  return handler;
}

function redactedPayload(event: OutboxEvent, deps: OutboxDeps): Prisma.InputJsonValue {
  const payload = payloadOf(event);
  return deps.handlers[event.type]?.redact?.(payload) ?? (payload as Prisma.InputJsonValue);
}

/** Envía un evento ya reservado por este proceso y deja su estado según el resultado. */
async function dispatchClaimed(event: OutboxEvent, deps: OutboxDeps): Promise<"SENT" | "PENDING" | "FAILED"> {
  const db = getSystemDb();
  const attempts = event.attempts + 1;
  try {
    await handlerFor(event, deps).deliver(payloadOf(event), { eventId: event.id, email: deps.email, now: deps.now });
    await db.outboxEvent.update({
      where: { id: event.id },
      data: { status: "SENT", attempts, sentAt: deps.now(), lastError: null, payload: redactedPayload(event, deps) },
    });
    return "SENT";
  } catch (error) {
    const lastError = (error instanceof Error ? error.message : String(error)).slice(0, 500);
    const decision = error instanceof NonRetryableError ? { status: "FAILED" as const } : decideAfterFailure(attempts, deps.now());
    if (decision.status === "FAILED") {
      await db.outboxEvent.update({
        where: { id: event.id },
        data: { status: "FAILED", attempts, lastError, payload: redactedPayload(event, deps) },
      });
      // PLT-08: alerta al superadmin. Hasta tener Sentry (F0), queda en los logs.
      console.error(`[outbox] Evento ${event.id} (${event.type}) FAILED tras ${attempts} intentos: ${lastError}`);
      return "FAILED";
    }
    await db.outboxEvent.update({
      where: { id: event.id },
      data: { attempts, lastError, nextAttemptAt: decision.nextAttemptAt },
    });
    return "PENDING";
  }
}

/** Reserva el evento para este proceso si sigue pendiente y le toca; null si otro lo tiene. */
async function claim(event: OutboxEvent, now: Date): Promise<OutboxEvent | null> {
  const lease = new Date(now.getTime() + CLAIM_LEASE_MS);
  const claimed = await getSystemDb().outboxEvent.updateMany({
    where: { id: event.id, status: "PENDING", nextAttemptAt: event.nextAttemptAt },
    data: { nextAttemptAt: lease },
  });
  return claimed.count === 1 ? { ...event, nextAttemptAt: lease } : null;
}

/**
 * Envía ahora un evento recién guardado (llamar después del commit, p. ej. desde `after()` de
 * Next). Si falla, queda PENDING para el siguiente barrido: no lanza.
 */
export async function dispatchOutboxEvent(id: string, deps: OutboxDeps = defaultOutboxDeps()) {
  const event = await getSystemDb().outboxEvent.findUnique({ where: { id } });
  if (!event || event.status !== "PENDING") return { id, status: event?.status ?? null, skipped: true };
  const claimed = await claim(event, deps.now());
  if (!claimed) return { id, status: event.status, skipped: true };
  return { id, status: await dispatchClaimed(claimed, deps), skipped: false };
}

/** PLT-08: barrido de lo pendiente que ya toca. Reserva cada evento antes de enviarlo para no duplicar. */
export async function processDueOutboxEvents(deps: OutboxDeps = defaultOutboxDeps(), limit = 20) {
  const db = getSystemDb();
  const now = deps.now();
  const due = await db.outboxEvent.findMany({
    where: { status: "PENDING", nextAttemptAt: { lte: now } },
    orderBy: { nextAttemptAt: "asc" },
    take: limit,
  });

  const result = { sent: 0, retrying: 0, failed: 0, skipped: 0 };
  for (const event of due) {
    const claimed = await claim(event, now);
    if (!claimed) {
      result.skipped += 1;
      continue;
    }
    const status = await dispatchClaimed(claimed, deps);
    if (status === "SENT") result.sent += 1;
    else if (status === "FAILED") result.failed += 1;
    else result.retrying += 1;
  }
  return result;
}
