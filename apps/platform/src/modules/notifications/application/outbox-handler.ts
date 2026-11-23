import type { OutboxEvent, Prisma } from "@cubierto/db";
import type { EmailSender } from "../domain/email";

/**
 * Contrato de un tipo de evento del outbox (PLT-08). Aparte de `outbox.ts` para que los
 * handlers no importen el outbox y el outbox los importe a ellos sin ciclos.
 */

export type JsonObject = Record<string, unknown>;

export interface OutboxHandlerContext {
  eventId: string;
  email: EmailSender;
  now: () => Date;
}

/** Cómo se entrega un tipo de evento. Cada módulo registra los suyos en `outbox-handlers.ts`. */
export interface OutboxHandler {
  /** Envía el evento. Lanza `NonRetryableError` si ya no tiene sentido reintentarlo. */
  deliver(payload: JsonObject, context: OutboxHandlerContext): Promise<void>;
  /** Lo que se queda guardado del payload al enviarse o fallar del todo. Por defecto, todo. */
  redact?(payload: JsonObject): Prisma.InputJsonValue;
}

/** El contenido ya no sirve (p. ej. una invitación caducada): no se reintenta. */
export class NonRetryableError extends Error {
  override name = "NonRetryableError";
}

export function payloadOf(event: Pick<OutboxEvent, "payload">): JsonObject {
  return typeof event.payload === "object" && event.payload !== null && !Array.isArray(event.payload)
    ? (event.payload as JsonObject)
    : {};
}

export function requireString(payload: JsonObject, key: string): string {
  const value = payload[key];
  if (typeof value !== "string" || value === "") throw new NonRetryableError(`Falta "${key}" en el evento`);
  return value;
}
