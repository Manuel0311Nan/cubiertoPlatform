import { disconnectDb, getSystemDb, type Role } from "@cubierto/db";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { getTenantPanelData } from "@/modules/tenancy/application/panel-data";
import { requireTestDatabase, uniqueSuffix } from "@/test/database";
import { resolveActiveTenant, selectActiveTenant } from "./active-tenant";

const tenantIds: string[] = [];
const userIds: string[] = [];

async function tenant(name: string, modules: ("SITE" | "MENU" | "RESERVATIONS")[] = []) {
  const suffix = uniqueSuffix();
  const created = await getSystemDb().tenant.create({ data: { slug: `t-${suffix}`, name: `${name} ${suffix}` } });
  tenantIds.push(created.id);
  await getSystemDb().venue.create({ data: { tenantId: created.id, name: created.name, city: "Alcalá" } });
  if (modules.length) {
    await getSystemDb().tenantModule.createMany({
      data: modules.map((module) => ({ tenantId: created.id, module, status: "ACTIVE" as const })),
    });
  }
  return created.id;
}

/** Usuario con sus membresías y una sesión abierta, como la que crea Better Auth. */
async function userWith(memberships: [string, Role][]) {
  const suffix = uniqueSuffix();
  const user = await getSystemDb().user.create({ data: { email: `u-${suffix}@cubierto.test` } });
  userIds.push(user.id);
  for (const [tenantId, role] of memberships) {
    await getSystemDb().membership.create({ data: { userId: user.id, tenantId, role } });
  }
  const session = await getSystemDb().session.create({
    data: { id: `s-${suffix}`, token: `tok-${suffix}`, userId: user.id, expiresAt: new Date(Date.now() + 86_400_000) },
  });
  return { userId: user.id, sessionId: session.id };
}

const storedActive = async (sessionId: string) =>
  (await getSystemDb().session.findUniqueOrThrow({ where: { id: sessionId } })).activeTenantId;

beforeAll(() => requireTestDatabase());
afterAll(async () => {
  const db = getSystemDb();
  await db.session.deleteMany({ where: { userId: { in: userIds } } });
  await db.membership.deleteMany({ where: { userId: { in: userIds } } });
  await db.tenantModule.deleteMany({ where: { tenantId: { in: tenantIds } } });
  await db.venue.deleteMany({ where: { tenantId: { in: tenantIds } } });
  await db.tenant.deleteMany({ where: { id: { in: tenantIds } } });
  await db.user.deleteMany({ where: { id: { in: userIds } } });
  await disconnectDb();
});

describe("PLT-02 · local activo en la sesión", () => {
  test("PLT-02: con un solo local, entra directamente en él y queda en la sesión", async () => {
    const a = await tenant("Casa");
    const { userId, sessionId } = await userWith([[a, "OWNER"]]);
    const result = await resolveActiveTenant(userId, sessionId);
    expect(result).toMatchObject({ kind: "active", membership: { tenantId: a, role: "OWNER" }, membershipCount: 1 });
    expect(await storedActive(sessionId)).toBe(a);
  });

  test("PLT-02: con varios locales, elige uno y la elección queda en la sesión", async () => {
    const a = await tenant("Alfa");
    const b = await tenant("Beta");
    const { userId, sessionId } = await userWith([[a, "OWNER"], [b, "STAFF"]]);

    const before = await resolveActiveTenant(userId, sessionId);
    expect(before.kind).toBe("choose");
    if (before.kind === "choose") expect(before.memberships.map((m) => m.tenantId).sort()).toEqual([a, b].sort());

    expect(await selectActiveTenant(userId, sessionId, b)).toEqual({ ok: true });
    expect(await resolveActiveTenant(userId, sessionId)).toMatchObject({ kind: "active", membership: { tenantId: b, role: "STAFF" } });
  });

  test("aislamiento: no puede elegir un local en el que no tiene membresía", async () => {
    const a = await tenant("Suyo");
    const other = await tenant("Ajeno");
    const { userId, sessionId } = await userWith([[a, "OWNER"]]);
    expect(await selectActiveTenant(userId, sessionId, other)).toEqual({ ok: false, code: "NOT_A_MEMBER" });
    expect(await storedActive(sessionId)).toBeNull();
  });

  test("aislamiento: un local guardado en la sesión sin membresía se ignora", async () => {
    const a = await tenant("Uno");
    const b = await tenant("Dos");
    const other = await tenant("Tercero");
    const { userId, sessionId } = await userWith([[a, "OWNER"], [b, "OWNER"]]);
    // Como si se hubiera manipulado el valor guardado.
    await getSystemDb().session.update({ where: { id: sessionId }, data: { activeTenantId: other } });

    expect((await resolveActiveTenant(userId, sessionId)).kind).toBe("choose");
    expect(await storedActive(sessionId)).toBeNull();
  });

  test("PLT-03 (avance): si le quitan el acceso al local activo, deja de verlo en la siguiente petición", async () => {
    const a = await tenant("Antes");
    const b = await tenant("Después");
    const { userId, sessionId } = await userWith([[a, "STAFF"], [b, "STAFF"]]);
    await selectActiveTenant(userId, sessionId, a);
    await getSystemDb().membership.delete({ where: { userId_tenantId: { userId, tenantId: a } } });
    expect(await resolveActiveTenant(userId, sessionId)).toMatchObject({ kind: "active", membership: { tenantId: b } });
  });

  test("un local borrado no aparece", async () => {
    const a = await tenant("Vivo");
    const gone = await tenant("Borrado");
    await getSystemDb().tenant.update({ where: { id: gone }, data: { deletedAt: new Date() } });
    const { userId, sessionId } = await userWith([[a, "OWNER"], [gone, "OWNER"]]);
    expect(await resolveActiveTenant(userId, sessionId)).toMatchObject({ kind: "active", membership: { tenantId: a }, membershipCount: 1 });
  });

  test("sin membresías: ningún local", async () => {
    const { userId, sessionId } = await userWith([]);
    expect(await resolveActiveTenant(userId, sessionId)).toEqual({ kind: "none" });
  });

  test("una sesión de otro usuario no se puede usar para elegir local", async () => {
    const a = await tenant("Propio");
    const mine = await userWith([[a, "OWNER"]]);
    const someoneElse = await userWith([[a, "STAFF"]]);
    await selectActiveTenant(mine.userId, someoneElse.sessionId, a);
    expect(await storedActive(someoneElse.sessionId)).toBeNull();
  });
});

describe("PLT-02 · datos del marco del panel", () => {
  test("aislamiento: cada local ve solo sus módulos y su local", async () => {
    const a = await tenant("ConCarta", ["MENU"]);
    const b = await tenant("ConTodo", ["SITE", "MENU", "RESERVATIONS"]);
    const dataA = await getTenantPanelData(a);
    const dataB = await getTenantPanelData(b);
    expect(dataA.modules).toEqual(["MENU"]);
    expect(dataB.modules).toEqual(["SITE", "MENU", "RESERVATIONS"]);
    expect(dataA.venue?.name).toMatch(/^ConCarta/);
  });
});
