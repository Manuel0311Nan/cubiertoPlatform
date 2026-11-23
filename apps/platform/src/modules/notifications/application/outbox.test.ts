import { disconnectDb, getSystemDb } from "@cubierto/db";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { requireTestDatabase, uniqueSuffix } from "@/test/database";
import type { EmailMessage, EmailSender } from "../domain/email";
import {
  dispatchOutboxEvent,
  NonRetryableError,
  processDueOutboxEvents,
  requireString,
  type OutboxDeps,
  type OutboxHandler,
} from "./outbox";

class FakeSender implements EmailSender {
  sent: { message: EmailMessage; idempotencyKey: string }[] = [];
  failuresLeft = 0;
  async send(message: EmailMessage, { idempotencyKey }: { idempotencyKey: string }) {
    if (this.failuresLeft > 0) {
      this.failuresLeft -= 1;
      throw new Error("Resend respondió 503");
    }
    this.sent.push({ message, idempotencyKey });
  }
}

/** Tipo de evento solo de los tests: un email con un dato que no debe quedarse guardado. */
const TEST_EVENT = "test.email";
const testHandler: OutboxHandler = {
  async deliver(payload, { eventId, email, now }) {
    const validUntil = Date.parse(requireString(payload, "validUntil"));
    if (now().getTime() >= validUntil) throw new NonRetryableError("Ya no sirve");
    const message = { to: requireString(payload, "to"), subject: "Test", text: requireString(payload, "secret"), html: "" };
    await email.send(message, { idempotencyKey: eventId });
  },
  redact: (payload) => ({ to: (payload.to as string | undefined) ?? null, redacted: true }),
};

const createdIds: string[] = [];
let clock = new Date("2026-11-22T10:00:00.000Z");

function deps(sender: FakeSender): OutboxDeps {
  return { email: sender, now: () => clock, handlers: { [TEST_EVENT]: testHandler } };
}

/** Lo que haría un caso de uso: guardar el evento (en su transacción) y, tras el commit, enviarlo. */
async function enqueueAndDispatch(sender: FakeSender, { minutesValid = 15, type = TEST_EVENT } = {}) {
  const event = await getSystemDb().outboxEvent.create({
    data: {
      tenantId: null,
      type,
      payload: {
        to: `t-${uniqueSuffix()}@cubierto.test`,
        secret: `secret-${uniqueSuffix()}`,
        validUntil: new Date(clock.getTime() + minutesValid * 60_000).toISOString(),
      },
      nextAttemptAt: clock,
    },
  });
  createdIds.push(event.id);
  return dispatchOutboxEvent(event.id, deps(sender));
}

const load = (id: string) => getSystemDb().outboxEvent.findUniqueOrThrow({ where: { id } });

beforeAll(() => requireTestDatabase());
afterAll(async () => {
  await getSystemDb().outboxEvent.deleteMany({ where: { id: { in: createdIds } } });
  await disconnectDb();
});

describe("PLT-08 · outbox con envío tras el commit y barrido", () => {
  test("PLT-08: se envía al momento y lo que no debe quedarse guardado se borra", async () => {
    const sender = new FakeSender();
    const { id, status } = await enqueueAndDispatch(sender);

    expect(status).toBe("SENT");
    expect(sender.sent).toHaveLength(1);
    expect(sender.sent[0]?.idempotencyKey).toBe(id);
    const event = await load(id);
    expect(event).toMatchObject({ status: "SENT", attempts: 1, lastError: null });
    expect(JSON.stringify(event.payload)).not.toContain("secret-");
  });

  test("PLT-08: si Resend falla, queda PENDING para dentro de 1 minuto y el barrido lo envía", async () => {
    const sender = new FakeSender();
    sender.failuresLeft = 1;
    const { id, status } = await enqueueAndDispatch(sender);
    expect(status).toBe("PENDING");
    expect(await load(id)).toMatchObject({
      status: "PENDING",
      attempts: 1,
      lastError: "Resend respondió 503",
      nextAttemptAt: new Date(clock.getTime() + 60_000),
    });

    // Antes de tiempo el barrido no lo toca.
    await processDueOutboxEvents(deps(sender));
    expect(sender.sent).toHaveLength(0);

    clock = new Date(clock.getTime() + 61_000);
    await processDueOutboxEvents(deps(sender));
    expect(sender.sent).toHaveLength(1);
    expect(await load(id)).toMatchObject({ status: "SENT", attempts: 2 });
  });

  test("PLT-08: tras 5 fallos queda FAILED y sin el dato a borrar", async () => {
    const sender = new FakeSender();
    sender.failuresLeft = 10;
    const { id } = await enqueueAndDispatch(sender, { minutesValid: 24 * 60 });
    for (let attempt = 0; attempt < 4; attempt += 1) {
      clock = new Date(clock.getTime() + 61 * 60_000);
      await processDueOutboxEvents(deps(sender));
    }
    const event = await load(id);
    expect(event).toMatchObject({ status: "FAILED", attempts: 5 });
    expect(JSON.stringify(event.payload)).not.toContain("secret-");
  });

  test("PLT-08: un evento que ya no sirve no se reintenta", async () => {
    const sender = new FakeSender();
    sender.failuresLeft = 1;
    const { id } = await enqueueAndDispatch(sender, { minutesValid: 15 });
    clock = new Date(clock.getTime() + 16 * 60_000);
    await processDueOutboxEvents(deps(sender));
    expect(sender.sent).toHaveLength(0);
    expect(await load(id)).toMatchObject({ status: "FAILED" });
  });

  test("PLT-08: un tipo de evento sin canal queda FAILED sin reintentos", async () => {
    const sender = new FakeSender();
    const { id, status } = await enqueueAndDispatch(sender, { type: "test.unknown" });
    expect(status).toBe("FAILED");
    expect(await load(id)).toMatchObject({ status: "FAILED", attempts: 1 });
  });

  test("PLT-08: un evento ya enviado no se vuelve a enviar", async () => {
    const sender = new FakeSender();
    const { id } = await enqueueAndDispatch(sender);
    expect(await dispatchOutboxEvent(id, deps(sender))).toMatchObject({ skipped: true, status: "SENT" });
    expect(sender.sent).toHaveLength(1);
  });

  test("PLT-08: dos procesos a la vez no envían el mismo evento dos veces", async () => {
    const failing = new FakeSender();
    failing.failuresLeft = 1;
    const { id } = await enqueueAndDispatch(failing, { minutesValid: 24 * 60 });
    clock = new Date(clock.getTime() + 61_000);

    const sender = new FakeSender();
    await Promise.all([processDueOutboxEvents(deps(sender)), processDueOutboxEvents(deps(sender)), dispatchOutboxEvent(id, deps(sender))]);
    expect(sender.sent.filter((s) => s.idempotencyKey === id)).toHaveLength(1);
  });
});
