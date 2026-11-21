import { getSystemDb, Prisma, type OutboxEvent } from "@cubierto/db";
import type { EmailSender } from "../domain/email";
import { CLAIM_LEASE_MS, decideAfterFailure } from "../domain/retry";
import { magicLinkEmail } from "../domain/templates/magic-link-email";
import { getEmailSender } from "../infra/email-sender";

/**
 * Outbox (CLAUDE.md §6.5, PLT-08). Los efectos externos se guardan como OutboxEvent y se envían
 * fuera de cualquier transacción: al momento (`enqueueAndDispatch`) o desde el cron
 * (`processDueOutboxEvents`), que también hace los reintentos.
 *
 * Usa systemDb: el cron recorre los eventos de todos los locales y los de plataforma (tenantId null).
 */

export const MAGIC_LINK_EVENT = "auth.magic_link";

export interface OutboxDeps {
  email: EmailSender;
  now: () => Date;
}

export function defaultOutboxDeps(): OutboxDeps {
  return { email: getEmailSender(), now: () => new Date() };
}

type JsonObject = Record<string, unknown>;

function payloadOf(event: OutboxEvent): JsonObject {
  return typeof event.payload === "object" && event.payload !== null && !Array.isArray(event.payload)
    ? (event.payload as JsonObject)
    : {};
}

function requireString(payload: JsonObject, key: string): string {
  const value = payload[key];
  if (typeof value !== "string" || value === "") throw new Error(`Falta "${key}" en el evento`);
  return value;
}

/** Quita del payload lo que no debe quedarse guardado una vez enviado (el enlace de entrada). */
function redactedPayload(event: OutboxEvent): Prisma.InputJsonValue {
  const payload = payloadOf(event);
  if (event.type === MAGIC_LINK_EVENT) {
    return { to: payload.to ?? null, redacted: true };
  }
  return payload as Prisma.InputJsonValue;
}

async function deliver(event: OutboxEvent, deps: OutboxDeps): Promise<void> {
  const payload = payloadOf(event);
  switch (event.type) {
    case MAGIC_LINK_EVENT: {
      const expiresAt = Date.parse(requireString(payload, "expiresAt"));
      if (deps.now().getTime() >= expiresAt) throw new ExpiredEventError();
      const message = magicLinkEmail({ to: requireString(payload, "to"), url: requireString(payload, "url") });
      await deps.email.send(message, { idempotencyKey: event.id });
      return;
    }
    default:
      throw new Error(`Tipo de evento sin canal: ${event.type}`);
  }
}

/** El contenido ya no sirve (p. ej. el enlace caducó): no se reintenta. */
class ExpiredEventError extends Error {
  override name = "ExpiredEventError";
}

/** Envía un evento ya reservado por este proceso y deja su estado según el resultado. */
async function dispatchClaimed(event: OutboxEvent, deps: OutboxDeps): Promise<"SENT" | "PENDING" | "FAILED"> {
  const db = getSystemDb();
  const attempts = event.attempts + 1;
  try {
    await deliver(event, deps);
    await db.outboxEvent.update({
      where: { id: event.id },
      data: { status: "SENT", attempts, sentAt: deps.now(), lastError: null, payload: redactedPayload(event) },
    });
    return "SENT";
  } catch (error) {
    const lastError = (error instanceof Error ? error.message : String(error)).slice(0, 500);
    const decision = error instanceof ExpiredEventError ? { status: "FAILED" as const } : decideAfterFailure(attempts, deps.now());
    if (decision.status === "FAILED") {
      await db.outboxEvent.update({
        where: { id: event.id },
        data: { status: "FAILED", attempts, lastError, payload: redactedPayload(event) },
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

export interface NewOutboxEvent {
  tenantId: string | null;
  type: string;
  payload: Prisma.InputJsonValue;
}

/**
 * Guarda el evento y lo intenta enviar al momento. Si el envío falla, queda PENDING y lo
 * reintenta el cron: no lanza. Llamar siempre fuera de una transacción.
 */
export async function enqueueAndDispatch(input: NewOutboxEvent, deps: OutboxDeps = defaultOutboxDeps()) {
  const now = deps.now();
  const event = await getSystemDb().outboxEvent.create({
    data: {
      tenantId: input.tenantId,
      type: input.type,
      payload: input.payload,
      // Reservado para este proceso: el cron no lo coge mientras se envía.
      nextAttemptAt: new Date(now.getTime() + CLAIM_LEASE_MS),
    },
  });
  const status = await dispatchClaimed(event, deps);
  return { id: event.id, status };
}

/** PLT-08: lo llama el cron cada minuto. Reserva cada evento antes de enviarlo para no duplicar. */
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
    const claim = await db.outboxEvent.updateMany({
      where: { id: event.id, status: "PENDING", nextAttemptAt: event.nextAttemptAt },
      data: { nextAttemptAt: new Date(now.getTime() + CLAIM_LEASE_MS) },
    });
    if (claim.count !== 1) {
      result.skipped += 1;
      continue;
    }
    const status = await dispatchClaimed(event, deps);
    if (status === "SENT") result.sent += 1;
    else if (status === "FAILED") result.failed += 1;
    else result.retrying += 1;
  }
  return result;
}
