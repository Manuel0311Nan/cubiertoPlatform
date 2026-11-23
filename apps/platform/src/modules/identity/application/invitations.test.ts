import { disconnectDb, getSystemDb, getTenantDb } from "@cubierto/db";
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import type { EmailMessage } from "@/modules/notifications/domain/email";
import { defaultOutboxDeps, dispatchOutboxEvent } from "@/modules/notifications/application/outbox";
import { createTenant } from "@/modules/tenancy/application/create-tenant";
import { createTenantSchema } from "@/modules/tenancy/domain/create-tenant";
import { requireTestDatabase, uniqueSuffix } from "@/test/database";
import { acceptInvitation, getInvitationView, reissueInvitation, requestNewInvitation } from "./invitations";
import { signInDirectly } from "./sign-in";

// Ningún enlace de entrada debe salir por email al aceptar: se usa en el momento.
const magicLinks = vi.hoisted(() => ({ sent: [] as EmailMessage[] }));
vi.mock("@/modules/notifications/infra/email-sender", () => ({
  getEmailSender: () => ({
    send: async (message: EmailMessage) => {
      magicLinks.sent.push(message);
    },
  }),
}));

const headers = new Headers({ "user-agent": "vitest" });
const tenantIds: string[] = [];
const emails: string[] = [];
let actorId = "";

/** Da de alta un local y devuelve el token del enlace del email de invitación. */
async function newTenantWithInvitation() {
  const suffix = uniqueSuffix();
  const data = createTenantSchema.parse({
    name: `Casa ${suffix}`,
    slug: `casa-${suffix}`,
    ownerEmail: `duena-${suffix}@cubierto.test`,
    modules: ["MENU"],
    reason: "Piloto",
  });
  emails.push(data.ownerEmail);
  const result = await createTenant(data, actorId);
  if (!result.ok) throw new Error("No se creó");
  tenantIds.push(result.tenantId);
  return { ...data, tenantId: result.tenantId, token: await tokenFromEvent(result.invitationEventId) };
}

async function tokenFromEvent(eventId: string): Promise<string> {
  const sent: EmailMessage[] = [];
  await dispatchOutboxEvent(eventId, {
    ...defaultOutboxDeps(),
    email: { send: async (m) => void sent.push(m) },
  });
  const url = sent[0]?.text.split("\n").find((line) => line.startsWith("http"));
  if (!url) throw new Error("El email no lleva el enlace");
  return new URL(url).pathname.split("/").at(-1)!;
}

async function expire(tenantId: string) {
  await getSystemDb().invitation.updateMany({ where: { tenantId }, data: { expiresAt: new Date(Date.now() - 1000) } });
}

beforeAll(async () => {
  requireTestDatabase();
  const actor = await getSystemDb().user.create({ data: { email: `admin-${uniqueSuffix()}@cubierto.test`, isSuperadmin: true } });
  actorId = actor.id;
});

afterAll(async () => {
  const db = getSystemDb();
  const where = { tenantId: { in: tenantIds } };
  const users = await db.user.findMany({ where: { email: { in: emails } }, select: { id: true } });
  const userIds = users.map((u) => u.id);
  await db.session.deleteMany({ where: { userId: { in: userIds } } });
  await db.verification.deleteMany({ where: { OR: emails.map((email) => ({ value: { contains: email } })) } });
  await db.membership.deleteMany({ where });
  await db.auditLog.deleteMany({ where });
  await db.outboxEvent.deleteMany({ where });
  await db.invitation.deleteMany({ where });
  await db.tenantModule.deleteMany({ where });
  await db.venue.deleteMany({ where });
  await db.tenant.deleteMany({ where: { id: { in: tenantIds } } });
  await db.user.deleteMany({ where: { id: { in: [...userIds, actorId] } } });
  await disconnectDb();
});

describe("PLT-02 · aceptar la invitación", () => {
  test("PLT-02: la pantalla muestra el local, el email y el papel", async () => {
    const t = await newTenantWithInvitation();
    expect(await getInvitationView(t.token)).toEqual({ state: "VALID", tenantName: t.name, email: t.ownerEmail, role: "OWNER" });
  });

  test("PLT-02: aceptar crea el usuario y su membresía OWNER y abre sesión sin otro email", async () => {
    const t = await newTenantWithInvitation();
    expect(await acceptInvitation(t.token)).toEqual({ ok: true, email: t.ownerEmail });

    const user = await getSystemDb().user.findUniqueOrThrow({ where: { email: t.ownerEmail } });
    expect(user.emailVerified).toBe(true);
    expect(await getTenantDb(t.tenantId).membership.findMany()).toEqual([
      expect.objectContaining({ userId: user.id, role: "OWNER" }),
    ]);

    // La sesión se abre en la misma petición, sin enviar un enlace de entrada por email.
    const response = await signInDirectly(t.ownerEmail, headers);
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("cubierto.session_token");
    expect(magicLinks.sent.filter((m) => m.to === t.ownerEmail)).toHaveLength(0);
  });

  test("PLT-02: un enlace ya usado no vale otra vez", async () => {
    const t = await newTenantWithInvitation();
    await acceptInvitation(t.token);
    expect(await getInvitationView(t.token)).toMatchObject({ state: "ACCEPTED" });
    expect(await acceptInvitation(t.token)).toEqual({ ok: false, code: "ALREADY_ACCEPTED" });
  });

  test("PLT-02: dos aceptaciones a la vez dejan una sola membresía", async () => {
    const t = await newTenantWithInvitation();
    const results = await Promise.all([acceptInvitation(t.token), acceptInvitation(t.token)]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(await getTenantDb(t.tenantId).membership.count()).toBe(1);
  });

  test("PLT-02: un enlace caducado no vale, y se puede pedir otro que sí", async () => {
    const t = await newTenantWithInvitation();
    await expire(t.tenantId);
    expect(await getInvitationView(t.token)).toMatchObject({ state: "EXPIRED" });
    expect(await acceptInvitation(t.token)).toEqual({ ok: false, code: "EXPIRED" });

    const again = await requestNewInvitation(t.token);
    if (!again.ok) throw new Error(again.code);
    expect(again.email).toBe(t.ownerEmail);
    const newToken = await tokenFromEvent(again.eventId);

    // El enlace viejo deja de existir; el nuevo vale 7 días.
    expect(await getInvitationView(t.token)).toEqual({ state: "NOT_FOUND" });
    expect(await requestNewInvitation(t.token)).toEqual({ ok: false, code: "NOT_FOUND" });
    expect(await acceptInvitation(newToken)).toMatchObject({ ok: true });
  });

  test("PLT-02: con un enlace aún válido no se pide otro", async () => {
    const t = await newTenantWithInvitation();
    expect(await requestNewInvitation(t.token)).toEqual({ ok: false, code: "NOT_EXPIRED" });
  });

  test("PLT-01: el superadmin reenvía una invitación sin aceptar; aceptada, ya no", async () => {
    const t = await newTenantWithInvitation();
    const [invitation] = await getTenantDb(t.tenantId).invitation.findMany();
    const resent = await reissueInvitation(invitation!.id);
    if (!resent.ok) throw new Error(resent.code);
    const newToken = await tokenFromEvent(resent.eventId);
    expect(await getInvitationView(t.token)).toEqual({ state: "NOT_FOUND" });

    await acceptInvitation(newToken);
    expect(await reissueInvitation(invitation!.id)).toEqual({ ok: false, code: "ALREADY_ACCEPTED" });
  });

  test("PLT-02: un token inventado o con otra forma no encuentra nada", async () => {
    expect(await getInvitationView("x".repeat(43))).toEqual({ state: "NOT_FOUND" });
    expect(await getInvitationView("../../etc")).toEqual({ state: "NOT_FOUND" });
    expect(await acceptInvitation("y".repeat(43))).toEqual({ ok: false, code: "NOT_FOUND" });
  });

  test("aislamiento: la membresía creada al aceptar es solo del local que invitó", async () => {
    const a = await newTenantWithInvitation();
    const b = await newTenantWithInvitation();
    await acceptInvitation(a.token);
    expect(await getTenantDb(a.tenantId).membership.count()).toBe(1);
    expect(await getTenantDb(b.tenantId).membership.count()).toBe(0);
  });
});
