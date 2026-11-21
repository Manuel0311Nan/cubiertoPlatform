/** PLT-08: reintentos con backoff de 1, 5, 15 y 60 minutos; tras 5 fallos, FAILED. */
export const RETRY_DELAYS_MINUTES = [1, 5, 15, 60] as const;
export const MAX_ATTEMPTS = 5;

/**
 * Tiempo que un proceso se reserva un evento antes de enviarlo. Si el proceso muere a medias,
 * el cron lo vuelve a coger al terminar la reserva.
 */
export const CLAIM_LEASE_MS = 2 * 60 * 1000;

export type RetryDecision = { status: "PENDING"; nextAttemptAt: Date } | { status: "FAILED" };

/** Qué hacer tras el intento número `attempts` (1 = el primero) que ha fallado. */
export function decideAfterFailure(attempts: number, now: Date): RetryDecision {
  if (attempts >= MAX_ATTEMPTS) return { status: "FAILED" };
  const delayMinutes = RETRY_DELAYS_MINUTES[Math.max(0, attempts - 1)] ?? RETRY_DELAYS_MINUTES.at(-1)!;
  return { status: "PENDING", nextAttemptAt: new Date(now.getTime() + delayMinutes * 60_000) };
}
