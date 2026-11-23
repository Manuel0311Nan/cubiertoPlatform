import { describe, expect, test } from "vitest";
import { EmailDeliveryError, type EmailMessage, type EmailSender } from "./email";
import { decideAfterFailure, IMMEDIATE_RETRY_DELAYS_MS, MAX_ATTEMPTS, sendWithRetry } from "./retry";

const now = new Date("2026-11-22T10:00:00.000Z");
const minutesLater = (decision: ReturnType<typeof decideAfterFailure>) =>
  decision.status === "PENDING" ? (decision.nextAttemptAt.getTime() - now.getTime()) / 60_000 : null;

describe("PLT-08 · reintentos del outbox", () => {
  test("PLT-08: backoff de 1, 5, 15 y 60 minutos", () => {
    expect([1, 2, 3, 4].map((attempt) => minutesLater(decideAfterFailure(attempt, now)))).toEqual([1, 5, 15, 60]);
  });

  test("PLT-08: tras 5 fallos el evento queda FAILED", () => {
    expect(MAX_ATTEMPTS).toBe(5);
    expect(decideAfterFailure(5, now)).toEqual({ status: "FAILED" });
    expect(decideAfterFailure(6, now)).toEqual({ status: "FAILED" });
  });
});

/** Falla con los errores de `failures`, en orden, y después envía. */
class ScriptedSender implements EmailSender {
  keys: string[] = [];
  sent = 0;
  constructor(private readonly failures: Error[]) {}
  async send(_message: EmailMessage, { idempotencyKey }: { idempotencyKey: string }) {
    this.keys.push(idempotencyKey);
    const failure = this.failures.shift();
    if (failure) throw failure;
    this.sent += 1;
  }
}

const message: EmailMessage = { to: "ana@cubierto.test", subject: "Entra", text: "t", html: "h" };

async function run(sender: ScriptedSender) {
  const waits: number[] = [];
  const sleep = async (ms: number) => {
    waits.push(ms);
  };
  const outcome = await sendWithRetry(sender, message, { idempotencyKey: "k-1", sleep }).then(
    (result) => ({ ok: true as const, ...result }),
    (error: unknown) => ({ ok: false as const, error }),
  );
  return { outcome, waits };
}

describe("PLT-02 · envío inmediato con reintentos cortos", () => {
  test("PLT-02: si Resend falla una vez por algo pasajero, se repite y sale", async () => {
    const sender = new ScriptedSender([new EmailDeliveryError("Resend respondió 503", true)]);
    const { outcome, waits } = await run(sender);
    expect(outcome).toEqual({ ok: true, attempts: 2 });
    expect(waits).toEqual([IMMEDIATE_RETRY_DELAYS_MS[0]]);
    // Misma clave en todos los intentos: Resend no lo duplica.
    expect(sender.keys).toEqual(["k-1", "k-1"]);
  });

  test("PLT-02: tres intentos como mucho; después lanza el último error", async () => {
    const sender = new ScriptedSender([
      new EmailDeliveryError("Resend respondió 503", true),
      new Error("fetch failed"),
      new EmailDeliveryError("Resend respondió 429", true),
    ]);
    const { outcome, waits } = await run(sender);
    expect(outcome.ok).toBe(false);
    expect(!outcome.ok && (outcome.error as Error).message).toBe("Resend respondió 429");
    expect(waits).toEqual([...IMMEDIATE_RETRY_DELAYS_MS]);
    expect(sender.sent).toBe(0);
  });

  test("PLT-02: un error que no se arregla repitiendo (4xx) no se reintenta", async () => {
    const sender = new ScriptedSender([new EmailDeliveryError("Resend respondió 403", false)]);
    const { outcome, waits } = await run(sender);
    expect(outcome.ok).toBe(false);
    expect(waits).toEqual([]);
    expect(sender.keys).toHaveLength(1);
  });
});
