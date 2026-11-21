import { disconnectDb, getSystemDb } from "@cubierto/db";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { requireTestDatabase, uniqueSuffix } from "@/test/database";
import type { EmailMessage, EmailSender } from "../domain/email";
import { enqueueAndDispatch, MAGIC_LINK_EVENT, processDueOutboxEvents, type OutboxDeps } from "./outbox";

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

const createdIds: string[] = [];
let clock = new Date("2026-11-22T10:00:00.000Z");

function deps(sender: FakeSender): OutboxDeps {
  return { email: sender, now: () => clock };
}

function magicLinkPayload(to: string, minutesValid = 15) {
  return {
    to,
    url: `http://app.localhost:3000/api/auth/magic-link/verify?token=${uniqueSuffix()}`,
    expiresAt: new Date(clock.getTime() + minutesValid * 60_000).toISOString(),
  };
}

async function enqueue(sender: FakeSender, to: string, minutesValid?: number) {
  const result = await enqueueAndDispatch(
    { tenantId: null, type: MAGIC_LINK_EVENT, payload: magicLinkPayload(to, minutesValid) },
    deps(sender),
  );
  createdIds.push(result.id);
  return result;
}

const load = (id: string) => getSystemDb().outboxEvent.findUniqueOrThrow({ where: { id } });

beforeAll(() => requireTestDatabase());
afterAll(async () => {
  await getSystemDb().outboxEvent.deleteMany({ where: { id: { in: createdIds } } });
  await disconnectDb();
});

describe("PLT-08 · outbox con envío inmediato", () => {
  test("PLT-08: se guarda y se envía al momento, y el enlace no se queda guardado", async () => {
    const sender = new FakeSender();
    const { id, status } = await enqueue(sender, `ok-${uniqueSuffix()}@cubierto.test`);

    expect(status).toBe("SENT");
    expect(sender.sent).toHaveLength(1);
    expect(sender.sent[0]?.idempotencyKey).toBe(id);
    const event = await load(id);
    expect(event).toMatchObject({ status: "SENT", attempts: 1, lastError: null });
    expect(JSON.stringify(event.payload)).not.toContain("token=");
  });

  test("PLT-08: si Resend falla, queda PENDING para dentro de 1 minuto y el cron lo envía", async () => {
    const sender = new FakeSender();
    sender.failuresLeft = 1;
    const { id, status } = await enqueue(sender, `retry-${uniqueSuffix()}@cubierto.test`);
    expect(status).toBe("PENDING");
    expect(await load(id)).toMatchObject({
      status: "PENDING",
      attempts: 1,
      lastError: "Resend respondió 503",
      nextAttemptAt: new Date(clock.getTime() + 60_000),
    });

    // Antes de tiempo el cron no lo toca.
    await processDueOutboxEvents(deps(sender));
    expect(sender.sent).toHaveLength(0);

    clock = new Date(clock.getTime() + 61_000);
    await processDueOutboxEvents(deps(sender));
    expect(sender.sent).toHaveLength(1);
    expect(await load(id)).toMatchObject({ status: "SENT", attempts: 2 });
  });

  test("PLT-08: tras 5 fallos queda FAILED y sin el enlace", async () => {
    const sender = new FakeSender();
    sender.failuresLeft = 10;
    const { id } = await enqueue(sender, `fail-${uniqueSuffix()}@cubierto.test`, 24 * 60);
    for (let attempt = 0; attempt < 4; attempt += 1) {
      clock = new Date(clock.getTime() + 61 * 60_000);
      await processDueOutboxEvents(deps(sender));
    }
    const event = await load(id);
    expect(event).toMatchObject({ status: "FAILED", attempts: 5 });
    expect(JSON.stringify(event.payload)).not.toContain("token=");
  });

  test("PLT-02: un enlace caducado no se reintenta", async () => {
    const sender = new FakeSender();
    sender.failuresLeft = 1;
    const { id } = await enqueue(sender, `expired-${uniqueSuffix()}@cubierto.test`, 15);
    clock = new Date(clock.getTime() + 16 * 60_000);
    await processDueOutboxEvents(deps(sender));
    expect(sender.sent).toHaveLength(0);
    expect(await load(id)).toMatchObject({ status: "FAILED" });
  });

  test("PLT-08: dos procesos a la vez no envían el mismo evento dos veces", async () => {
    const failing = new FakeSender();
    failing.failuresLeft = 1;
    const { id } = await enqueue(failing, `race-${uniqueSuffix()}@cubierto.test`, 24 * 60);
    clock = new Date(clock.getTime() + 61_000);

    const sender = new FakeSender();
    await Promise.all([processDueOutboxEvents(deps(sender)), processDueOutboxEvents(deps(sender))]);
    expect(sender.sent.filter((s) => s.idempotencyKey === id)).toHaveLength(1);
  });
});
