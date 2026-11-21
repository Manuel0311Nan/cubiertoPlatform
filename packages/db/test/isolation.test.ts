import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { disconnectDb, getSystemDb } from "../src/client.ts";
import { getTenantDb, TenantScopeError } from "../src/tenant.ts";
import { createTestTenant, deleteTestTenants, requireTestDatabase, type TestTenant } from "./helpers.ts";

let a: TestTenant;
let b: TestTenant;

beforeAll(async () => {
  requireTestDatabase();
  a = await createTestTenant("a");
  b = await createTestTenant("b");
});

afterAll(async () => {
  await deleteTestTenants([a?.tenantId, b?.tenantId].filter(Boolean));
  await disconnectDb();
});

describe("PLT §9 · aislamiento con getTenantDb (primera barrera)", () => {
  test("PLT §9: el tenant A no ve los locales del tenant B", async () => {
    const venues = await getTenantDb(a.tenantId).venue.findMany();
    expect(venues.map((v) => v.id)).toEqual([a.venueId]);
  });

  test("PLT §9: buscar por id una fila de B desde A devuelve null", async () => {
    const venue = await getTenantDb(a.tenantId).venue.findUnique({ where: { id: b.venueId } });
    expect(venue).toBeNull();
  });

  test("PLT §9: A no puede cambiar una fila de B", async () => {
    await expect(
      getTenantDb(a.tenantId).venue.update({ where: { id: b.venueId }, data: { name: "Robado" } }),
    ).rejects.toThrow();
    const venue = await getSystemDb().venue.findUniqueOrThrow({ where: { id: b.venueId } });
    expect(venue.name).toBe("Local b");
  });

  test("PLT §9: updateMany y deleteMany desde A no tocan a B", async () => {
    const db = getTenantDb(a.tenantId);
    const updated = await db.venue.updateMany({ where: { id: b.venueId }, data: { name: "Robado" } });
    const deleted = await db.venue.deleteMany({ where: { id: b.venueId } });
    expect(updated.count).toBe(0);
    expect(deleted.count).toBe(0);
    expect(await getSystemDb().venue.count({ where: { id: b.venueId } })).toBe(1);
  });

  test("PLT §9: count y aggregate solo cuentan filas del tenant", async () => {
    expect(await getTenantDb(a.tenantId).venue.count()).toBe(1);
  });

  test("PLT §9: crear con el tenantId de otro tenant es un error", async () => {
    await expect(
      getTenantDb(a.tenantId).venue.create({ data: { tenantId: b.tenantId, name: "Intruso" } }),
    ).rejects.toThrow(TenantScopeError);
  });

  test("PLT §9: no se puede pasar una fila de un tenant a otro", async () => {
    await expect(
      getTenantDb(a.tenantId).venue.update({ where: { id: a.venueId }, data: { tenantId: b.tenantId } }),
    ).rejects.toThrow(TenantScopeError);
  });

  test("PLT §9: una mesa de A no puede colgar del local de B", async () => {
    await expect(
      getTenantDb(a.tenantId).table.create({
        data: { tenantId: a.tenantId, venueId: b.venueId, label: "1", maxSeats: 4, qrToken: `qr_${a.tenantId}` },
      }),
    ).rejects.toThrow();
  });

  test("PLT §9: getTenantDb no da acceso a tablas de plataforma", async () => {
    await expect(getTenantDb(a.tenantId).tenant.findMany()).rejects.toThrow(TenantScopeError);
    await expect(getTenantDb(a.tenantId).user.findMany()).rejects.toThrow(TenantScopeError);
  });

  test("PLT §9: getTenantDb sin tenantId es un error", () => {
    expect(() => getTenantDb("")).toThrow(TenantScopeError);
  });
});

describe("PLT §9 · RLS (segunda barrera)", () => {
  test("PLT §9: una consulta SQL sin filtro dentro del tenant A solo ve filas de A", async () => {
    const rows = await getTenantDb(a.tenantId).$queryRaw<{ id: string }[]>`SELECT id FROM "Venue"`;
    expect(rows.map((r) => r.id)).toEqual([a.venueId]);
  });

  test("PLT §9: dentro del tenant A, la base de datos rechaza insertar una fila de B", async () => {
    await expect(
      getTenantDb(a.tenantId).$tenantTransaction(
        (tx) => tx.$executeRaw`INSERT INTO "Venue" (id, "tenantId", name, "updatedAt") VALUES (${`rls_${b.tenantId}`}, ${b.tenantId}, 'Intruso', now())`,
      ),
    ).rejects.toThrow(/row-level security/);
  });

  test("PLT §9: dentro del tenant A, un UPDATE sin filtro no toca filas de B", async () => {
    const changed = await getTenantDb(a.tenantId).$executeRaw`UPDATE "Venue" SET "city" = 'Alcalá de Henares'`;
    expect(changed).toBe(1);
    const venueB = await getSystemDb().venue.findUniqueOrThrow({ where: { id: b.venueId } });
    expect(venueB.city).toBeNull();
  });

  test("PLT §9: las consultas del tenant corren con el rol sin BYPASSRLS", async () => {
    const [row] = await getTenantDb(a.tenantId).$queryRaw<{ role: string; tenant: string }[]>`
      SELECT current_user AS role, current_setting('app.tenant_id', true) AS tenant`;
    expect(row).toEqual({ role: "cubierto_app", tenant: a.tenantId });
  });

  test("PLT §9: el contexto del tenant no se queda en la conexión al terminar", async () => {
    await getTenantDb(a.tenantId).venue.findMany();
    const [row] = await getSystemDb().$queryRaw<{ tenant: string | null }[]>`
      SELECT nullif(current_setting('app.tenant_id', true), '') AS tenant`;
    expect(row?.tenant ?? null).toBeNull();
  });
});

describe("CLAUDE.md §6.5 · transacción del tenant con outbox", () => {
  test("cambio de datos y OutboxEvent se guardan juntos", async () => {
    const db = getTenantDb(a.tenantId);
    await db.$tenantTransaction(async (tx) => {
      await tx.venue.update({ where: { id: a.venueId }, data: { phone: "+34600000009" } });
      await tx.outboxEvent.create({
        data: { tenantId: a.tenantId, type: "test.venue.updated", payload: { venueId: a.venueId } },
      });
    });
    expect(await db.outboxEvent.count({ where: { type: "test.venue.updated" } })).toBe(1);
  });

  test("si la transacción falla, no queda ni el cambio ni el evento", async () => {
    const db = getTenantDb(a.tenantId);
    await expect(
      db.$tenantTransaction(async (tx) => {
        await tx.venue.update({ where: { id: a.venueId }, data: { phone: "+34600000010" } });
        await tx.outboxEvent.create({
          data: { tenantId: a.tenantId, type: "test.rolled.back", payload: {} },
        });
        throw new Error("fallo a propósito");
      }),
    ).rejects.toThrow("fallo a propósito");
    expect(await db.outboxEvent.count({ where: { type: "test.rolled.back" } })).toBe(0);
    const venue = await db.venue.findUniqueOrThrow({ where: { id: a.venueId } });
    expect(venue.phone).not.toBe("+34600000010");
  });

  test("PLT §9: dentro de la transacción del tenant A tampoco se ven filas de B", async () => {
    const ids = await getTenantDb(a.tenantId).$tenantTransaction(async (tx) => {
      const viaModel = await tx.venue.findMany({ select: { id: true } });
      const viaSql = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "Venue"`;
      return [...viaModel, ...viaSql].map((v) => v.id);
    });
    expect(ids).toEqual([a.venueId, a.venueId]);
  });
});
