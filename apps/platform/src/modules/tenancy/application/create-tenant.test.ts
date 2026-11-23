import { disconnectDb, getSystemDb, getTenantDb } from "@cubierto/db";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { hashInvitationToken } from "@/modules/identity/domain/invitation";
import type { EmailMessage, EmailSender } from "@/modules/notifications/domain/email";
import { defaultOutboxDeps, dispatchOutboxEvent } from "@/modules/notifications/application/outbox";
import { requireTestDatabase, uniqueSuffix } from "@/test/database";
import { createTenantSchema } from "../domain/create-tenant";
import { createTenant } from "./create-tenant";

class MemorySender implements EmailSender {
  sent: EmailMessage[] = [];
  async send(message: EmailMessage) {
    this.sent.push(message);
  }
}

const tenantIds: string[] = [];
let actorId = "";

function input(overrides: Partial<Record<string, unknown>> = {}) {
  const suffix = uniqueSuffix();
  return createTenantSchema.parse({
    name: `Bar ${suffix}`,
    slug: `bar-${suffix}`,
    ownerEmail: `duena-${suffix}@cubierto.test`,
    modules: ["MENU", "RESERVATIONS"],
    reason: "Piloto",
    ...overrides,
  });
}

async function create(overrides: Partial<Record<string, unknown>> = {}) {
  const data = input(overrides);
  const result = await createTenant(data, actorId);
  if (result.ok) tenantIds.push(result.tenantId);
  return { data, result };
}

/** Envía el evento con un remitente en memoria y devuelve el email que ha salido. */
async function send(eventId: string) {
  const sender = new MemorySender();
  const outcome = await dispatchOutboxEvent(eventId, { ...defaultOutboxDeps(), email: sender });
  return { outcome, message: sender.sent[0] };
}

beforeAll(async () => {
  requireTestDatabase();
  const actor = await getSystemDb().user.create({ data: { email: `admin-${uniqueSuffix()}@cubierto.test`, isSuperadmin: true } });
  actorId = actor.id;
});

afterAll(async () => {
  const db = getSystemDb();
  const where = { tenantId: { in: tenantIds } };
  await db.auditLog.deleteMany({ where });
  await db.outboxEvent.deleteMany({ where });
  await db.invitation.deleteMany({ where });
  await db.tenantModule.deleteMany({ where });
  await db.venue.deleteMany({ where });
  await db.tenant.deleteMany({ where: { id: { in: tenantIds } } });
  await db.user.delete({ where: { id: actorId } });
  await disconnectDb();
});

describe("PLT-01 · alta de un local", () => {
  test("PLT-01: crea el tenant, el local vacío, los módulos con su motivo y la invitación OWNER", async () => {
    const { data, result } = await create();
    if (!result.ok) throw new Error("No se creó");

    const db = getTenantDb(result.tenantId);
    const tenant = await getSystemDb().tenant.findUniqueOrThrow({ where: { id: result.tenantId } });
    expect(tenant).toMatchObject({ slug: data.slug, name: data.name, status: "ACTIVE" });
    expect(await db.venue.findMany()).toEqual([expect.objectContaining({ name: data.name, addressLine: null })]);
    expect(await db.tenantModule.findMany({ orderBy: { module: "asc" } })).toEqual([
      expect.objectContaining({ module: "MENU", status: "ACTIVE", overrideReason: "Piloto" }),
      expect.objectContaining({ module: "RESERVATIONS", status: "ACTIVE", overrideReason: "Piloto" }),
    ]);

    const [invitation] = await db.invitation.findMany();
    expect(invitation).toMatchObject({ email: data.ownerEmail, role: "OWNER", acceptedAt: null });
    const days = (invitation!.expiresAt.getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(6.99);
    expect(days).toBeLessThanOrEqual(7);

    const audit = await db.auditLog.findMany();
    expect(audit).toEqual([expect.objectContaining({ action: "tenant.created", actorUserId: actorId })]);
  });

  test("PLT-01: el email de invitación sale por el outbox con un enlace cuyo token solo se guarda con hash", async () => {
    const { data, result } = await create();
    if (!result.ok) throw new Error("No se creó");

    const { outcome, message } = await send(result.invitationEventId);
    expect(outcome.status).toBe("SENT");
    expect(message?.to).toBe(data.ownerEmail);
    expect(message?.subject).toContain(data.name);

    const url = new URL(message!.text.split("\n").find((line) => line.startsWith("http"))!);
    expect(url.pathname).toMatch(/^\/invitacion\/[A-Za-z0-9_-]{43}$/);
    const token = url.pathname.split("/").at(-1)!;
    const [invitation] = await getTenantDb(result.tenantId).invitation.findMany();
    expect(invitation?.tokenHash).toBe(hashInvitationToken(token));

    // Enviado, del evento se borra el enlace.
    const event = await getSystemDb().outboxEvent.findUniqueOrThrow({ where: { id: result.invitationEventId } });
    expect(JSON.stringify(event.payload)).not.toContain(token);
  });

  test("PLT-01: sin módulos, el local se crea igual y sin motivo", async () => {
    const { result } = await create({ modules: [], reason: "" });
    if (!result.ok) throw new Error("No se creó");
    expect(await getTenantDb(result.tenantId).tenantModule.count()).toBe(0);
  });

  test("PLT-01: un slug que ya tiene otro local → SLUG_TAKEN, sin dejar nada a medias", async () => {
    const { data } = await create();
    const again = input({ slug: data.slug });
    const result = await createTenant(again, actorId);
    expect(result).toEqual({ ok: false, code: "SLUG_TAKEN" });
    expect(await getSystemDb().invitation.count({ where: { email: again.ownerEmail } })).toBe(0);
  });

  test("aislamiento: lo creado para un local no lo ve otro", async () => {
    const { result: a } = await create();
    const { result: b } = await create();
    if (!a.ok || !b.ok) throw new Error("No se crearon");
    const fromB = getTenantDb(b.tenantId);
    const rows = [...(await fromB.invitation.findMany()), ...(await fromB.venue.findMany()), ...(await fromB.tenantModule.findMany())];
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((row) => row.tenantId === b.tenantId)).toBe(true);
    expect(await fromB.invitation.count({ where: { email: (await getTenantDb(a.tenantId).invitation.findFirstOrThrow()).email } })).toBe(0);
  });
});
