import { disconnectDb, getSystemDb } from "@cubierto/db";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { requireTestDatabase, uniqueSuffix } from "@/test/database";
import { createTable, getTable, listTables, regenerateQrToken, setTableActive, updateTable } from "./tables";

const tenantIds: string[] = [];

async function tenant() {
  const suffix = uniqueSuffix();
  const created = await getSystemDb().tenant.create({ data: { slug: `m-${suffix}`, name: `Mesas ${suffix}` } });
  tenantIds.push(created.id);
  await getSystemDb().venue.create({ data: { tenantId: created.id, name: created.name } });
  return created.id;
}

const four = { zone: "Sala", minSeats: 2, maxSeats: 4 };

beforeAll(() => requireTestDatabase());
afterAll(async () => {
  const where = { tenantId: { in: tenantIds } };
  await getSystemDb().table.deleteMany({ where });
  await getSystemDb().venue.deleteMany({ where });
  await getSystemDb().tenant.deleteMany({ where: { id: { in: tenantIds } } });
  await disconnectDb();
});

describe("PLT-05 · mesas y QR", () => {
  test("PLT-05: crea mesas con su token de QR y las lista en orden natural", async () => {
    const id = await tenant();
    for (const label of ["10", "2", "Terraza 1"]) expect((await createTable(id, { label, ...four })).ok).toBe(true);
    const tables = await listTables(id);
    expect(tables.map((t) => t.label)).toEqual(["2", "10", "Terraza 1"]);
    expect(new Set(tables.map((t) => t.qrToken)).size).toBe(3);
  });

  test("PLT-05: no puede haber dos mesas con la misma etiqueta en el local", async () => {
    const id = await tenant();
    const first = await createTable(id, { label: "5", ...four });
    expect(await createTable(id, { label: "5", ...four })).toEqual({ ok: false, code: "LABEL_TAKEN" });
    const other = await createTable(id, { label: "6", ...four });
    if (!first.ok || !other.ok) throw new Error("No se crearon");
    expect(await updateTable(id, other.id, { label: "5", ...four })).toEqual({ ok: false, code: "LABEL_TAKEN" });
  });

  test("PLT-05: editar y desactivar no cambian el QR; desactivar no borra la mesa", async () => {
    const id = await tenant();
    const created = await createTable(id, { label: "3", ...four });
    if (!created.ok) throw new Error("No se creó");
    const before = await getTable(id, created.id);
    await updateTable(id, created.id, { label: "3B", zone: null, minSeats: 1, maxSeats: 6 });
    await setTableActive(id, created.id, false);
    const after = await getTable(id, created.id);
    expect(after).toMatchObject({ label: "3B", zone: null, minSeats: 1, maxSeats: 6, active: false, qrToken: before!.qrToken });
    await setTableActive(id, created.id, true);
    expect((await getTable(id, created.id))?.active).toBe(true);
  });

  test("PLT-05: regenerar el QR cambia el token y el anterior deja de existir", async () => {
    const id = await tenant();
    const created = await createTable(id, { label: "7", ...four });
    if (!created.ok) throw new Error("No se creó");
    const old = (await getTable(id, created.id))!.qrToken;
    expect(await regenerateQrToken(id, created.id)).toBe(true);
    const fresh = (await getTable(id, created.id))!.qrToken;
    expect(fresh).not.toBe(old);
    expect(await getSystemDb().table.count({ where: { qrToken: old } })).toBe(0);
  });

  test("aislamiento: un local no ve ni toca las mesas de otro", async () => {
    const a = await tenant();
    const b = await tenant();
    const created = await createTable(a, { label: "1", ...four });
    if (!created.ok) throw new Error("No se creó");
    expect(await listTables(b)).toEqual([]);
    expect(await getTable(b, created.id)).toBeNull();
    expect(await updateTable(b, created.id, { label: "X", ...four })).toEqual({ ok: false, code: "NOT_FOUND" });
    expect(await setTableActive(b, created.id, false)).toBe(false);
    expect(await regenerateQrToken(b, created.id)).toBe(false);
    expect((await getTable(a, created.id))?.label).toBe("1");
    // La misma etiqueta en otro local sí vale.
    expect((await createTable(b, { label: "1", ...four })).ok).toBe(true);
  });
});
