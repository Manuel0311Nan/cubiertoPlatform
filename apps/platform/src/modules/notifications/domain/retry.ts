import { isRetryableEmailError, type EmailMessage, type EmailSender } from "./email";

/** PLT-08: reintentos del outbox con backoff de 1, 5, 15 y 60 minutos; tras 5 fallos, FAILED. */
export const RETRY_DELAYS_MINUTES = [1, 5, 15, 60] as const;
export const MAX_ATTEMPTS = 5;

/**
 * Tiempo que un proceso se reserva un evento antes de enviarlo. Si el proceso muere a medias,
 * el siguiente barrido del outbox lo vuelve a coger al terminar la reserva.
 */
export const CLAIM_LEASE_MS = 2 * 60 * 1000;

export type RetryDecision = { status: "PENDING"; nextAttemptAt: Date } | { status: "FAILED" };

/** Qué hacer tras el intento número `attempts` (1 = el primero) que ha fallado. */
export function decideAfterFailure(attempts: number, now: Date): RetryDecision {
  if (attempts >= MAX_ATTEMPTS) return { status: "FAILED" };
  const delayMinutes = RETRY_DELAYS_MINUTES[Math.max(0, attempts - 1)] ?? RETRY_DELAYS_MINUTES.at(-1)!;
  return { status: "PENDING", nextAttemptAt: new Date(now.getTime() + delayMinutes * 60_000) };
}

/**
 * Esperas entre intentos de un envío inmediato, con la persona esperando delante de la pantalla
 * (el enlace de entrada, PLT-02): 3 intentos en total, en unos 2,5 segundos más el envío.
 */
export const IMMEDIATE_RETRY_DELAYS_MS = [500, 2000] as const;

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Envía al momento y, si falla por algo pasajero, lo repite tras cada espera de `delaysMs`.
 * Todos los intentos llevan la misma `idempotencyKey`: si uno llegó a salir, Resend no lo duplica.
 * Lanza el último error si no sale.
 */
export async function sendWithRetry(
  sender: EmailSender,
  message: EmailMessage,
  {
    idempotencyKey,
    delaysMs = IMMEDIATE_RETRY_DELAYS_MS,
    sleep = wait,
  }: { idempotencyKey: string; delaysMs?: readonly number[]; sleep?: (ms: number) => Promise<void> },
): Promise<{ attempts: number }> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      await sender.send(message, { idempotencyKey });
      return { attempts: attempt };
    } catch (error) {
      const delay = delaysMs[attempt - 1];
      if (delay === undefined || !isRetryableEmailError(error)) throw error;
      await sleep(delay);
    }
  }
}
