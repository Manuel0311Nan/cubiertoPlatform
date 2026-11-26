import { disconnectDb, getSystemDb, getTenantDb } from "@cubierto/db";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { requireTestDatabase, uniqueSuffix } from "@/test/database";
import { emptyOpeningHours } from "../domain/opening-hours";
import { addClosure, getVenueSettings, removeClosure, updateOpeningHours, updateVenueDetails } from "./venue-settings";

const tenantIds: string[] = [];
// 20 de diciembre de 2026 a mediodía en Madrid.
const now = new Date("2026-12-20T11:00:00Z");

async function tenant() {
  const suffix = uniqueSuffix();
  const created = await getSystemDb().tenant.create({ data: { slug: `v-${suffix}`, name: `Local ${suffix}` } });
  tenantIds.push(created.id);
  await getSystemDb().venue.create({ data: { tenantId: created.id, name: `Local ${suffix}` } });
  return created.id;
}

const details = {
  name: "Casa Brezo",
  addressLine: "Calle Mayor 12",
  city: "Alcalá de Henares",
  postalCode: "28801",
  phone: "+34600123456",
  whatsappPhone: null,
  email: "hola@casabrezo.test",
};

beforeAll(() => requireTestDatabase());
afterAll(async () => {
  const db = getSystemDb();
  const where = { tenantId: { in: tenantIds } };
  await db.closedDate.deleteMany({ where });
  await db.venue.deleteMany({ where });
  await db.tenant.deleteMany({ where: { id: { in: tenantIds } } });
  await disconnectDb();
});

describe("PLT-04 · datos del local", () => {
  test("PLT-04: guarda los datos y el horario y los devuelve", async () => {
    const id = await tenant();
    await updateVenueDetails(id, details);
    const hours = { ...emptyOpeningHours(), 2: [{ open: "13:00", close: "16:00" }, { open: "20:00", close: "23:30" }] };
    await updateOpeningHours(id, hours);

    const settings = await getVenueSettings(id, now);
    expect(settings.details).toEqual(details);
    expect(settings.openingHours).toEqual(hours);
    expect(settings.today).toBe("2026-12-20");
  });

  test("aislamiento: cambiar los datos de un local no toca los de otro", async () => {
    const a = await tenant();
    const b = await tenant();
    await updateVenueDetails(a, details);
    const venueB = await getTenantDb(b).venue.findFirstOrThrow();
    expect(venueB.name).not.toBe("Casa Brezo");
    expect(venueB.phone).toBeNull();
  });
});

describe("PLT-04 · cierres puntuales", () => {
  test("PLT-04: un periodo se guarda por días y se muestra junto; los días repetidos no se duplican", async () => {
    const id = await tenant();
    expect(await addClosure(id, { from: "2027-01-12", to: "2027-01-14", reason: "Vacaciones" }, now)).toEqual({ ok: true, added: 3 });
    expect(await addClosure(id, { from: "2027-01-14", to: "2027-01-15", reason: "Vacaciones" }, now)).toEqual({ ok: true, added: 1 });
    expect(await addClosure(id, { from: "2026-12-25", to: null, reason: null }, now)).toEqual({ ok: true, added: 1 });

    const { closures } = await getVenueSettings(id, now);
    expect(closures.map(({ from, to, reason }) => ({ from, to, reason }))).toEqual([
      { from: "2026-12-25", to: "2026-12-25", reason: null },
      { from: "2027-01-12", to: "2027-01-15", reason: "Vacaciones" },
    ]);
  });

  test("PLT-04: no se puede cerrar un día pasado", async () => {
    const id = await tenant();
    expect(await addClosure(id, { from: "2026-12-19", to: null, reason: null }, now)).toEqual({ ok: false, code: "IN_THE_PAST" });
  });

  test("PLT-04: quitar un cierre es un borrado lógico y deja de verse", async () => {
    const id = await tenant();
    await addClosure(id, { from: "2026-12-31", to: "2027-01-01", reason: "Fiestas" }, now);
    const [period] = (await getVenueSettings(id, now)).closures;
    expect(await removeClosure(id, period!.ids, now)).toBe(2);
    expect((await getVenueSettings(id, now)).closures).toEqual([]);
    expect(await getSystemDb().closedDate.count({ where: { tenantId: id, deletedAt: { not: null } } })).toBe(2);
  });

  test("los cierres pasados no se muestran", async () => {
    const id = await tenant();
    await addClosure(id, { from: "2026-12-21", to: null, reason: null }, now);
    const later = new Date("2026-12-22T11:00:00Z");
    expect((await getVenueSettings(id, later)).closures).toEqual([]);
  });

  test("aislamiento: un local no ve ni puede quitar los cierres de otro", async () => {
    const a = await tenant();
    const b = await tenant();
    await addClosure(a, { from: "2026-12-25", to: null, reason: null }, now);
    const idsA = (await getVenueSettings(a, now)).closures.flatMap((p) => p.ids);

    expect((await getVenueSettings(b, now)).closures).toEqual([]);
    expect(await removeClosure(b, idsA, now)).toBe(0);
    expect((await getVenueSettings(a, now)).closures).toHaveLength(1);
  });
});
