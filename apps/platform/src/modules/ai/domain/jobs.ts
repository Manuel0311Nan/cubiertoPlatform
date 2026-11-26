import type { AiErrorCode } from "@cubierto/ai";

/** AI-05: reintentos de un trabajo en segundo plano, como el outbox (PLT-08) pero con 3 intentos. */
export const AI_JOB_MAX_ATTEMPTS = 3;
export const AI_JOB_RETRY_MINUTES = [1, 5] as const;
/**
 * Tiempo que un proceso se reserva un trabajo. Más que el tiempo máximo de una función de Vercel:
 * si el proceso muere a medias, el barrido lo vuelve a coger al terminar la reserva.
 */
export const AI_JOB_LEASE_MS = 15 * 60_000;

/** Fallos pasajeros: se reintentan. El resto (sin IA, sin presupuesto, salida no válida) no. */
const RETRYABLE: ReadonlySet<AiErrorCode> = new Set(["AI_TIMEOUT", "AI_PROVIDER_ERROR", "AI_RATE_LIMITED"]);

export type JobDecision = { status: "PENDING"; nextAttemptAt: Date } | { status: "FAILED" };

/** Qué hacer tras el intento número `attempts` (1 = el primero) que ha fallado con `code`. */
export function decideAfterJobFailure(code: AiErrorCode, attempts: number, now: Date): JobDecision {
  if (!RETRYABLE.has(code) || attempts >= AI_JOB_MAX_ATTEMPTS) return { status: "FAILED" };
  const minutes = AI_JOB_RETRY_MINUTES[Math.min(attempts - 1, AI_JOB_RETRY_MINUTES.length - 1)]!;
  return { status: "PENDING", nextAttemptAt: new Date(now.getTime() + minutes * 60_000) };
}
