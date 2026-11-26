import { getTenantDb, Prisma } from "@cubierto/db";
import { newQrToken } from "../domain/qr-token";
import { compareTables, type TableInput } from "../domain/tables";

/**
 * PLT-05: mesas del local. Todo por getTenantDb; el permiso (OWNER) lo comprueban las acciones.
 * Las mesas no se borran: se desactivan (CLAUDE.md §11). MVP: un local por tenant.
 */

export interface TableRow {
  id: string;
  label: string;
  zone: string | null;
  minSeats: number;
  maxSeats: number;
  active: boolean;
  qrToken: string;
}

const select = { id: true, label: true, zone: true, minSeats: true, maxSeats: true, active: true, qrToken: true } as const;

async function venueIdOf(tenantId: string): Promise<string> {
  const venue = await getTenantDb(tenantId).venue.findFirstOrThrow({ orderBy: { createdAt: "asc" }, select: { id: true } });
  return venue.id;
}

export async function listTables(tenantId: string): Promise<TableRow[]> {
  const tables = await getTenantDb(tenantId).table.findMany({ select });
  return tables.sort(compareTables);
}

export async function getTable(tenantId: string, id: string): Promise<TableRow | null> {
  return getTenantDb(tenantId).table.findUnique({ where: { id }, select });
}

export type TableResult = { ok: true; id: string } | { ok: false; code: "LABEL_TAKEN" | "NOT_FOUND" };

/** La etiqueta es única por local (`@@unique([venueId, label])`). */
function isLabelTaken(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export async function createTable(tenantId: string, input: TableInput): Promise<TableResult> {
  const venueId = await venueIdOf(tenantId);
  try {
    const table = await getTenantDb(tenantId).table.create({
      data: { tenantId, venueId, ...input, qrToken: newQrToken() },
      select: { id: true },
    });
    return { ok: true, id: table.id };
  } catch (error) {
    if (isLabelTaken(error)) return { ok: false, code: "LABEL_TAKEN" };
    throw error;
  }
}

export async function updateTable(tenantId: string, id: string, input: TableInput): Promise<TableResult> {
  try {
    const updated = await getTenantDb(tenantId).table.updateMany({ where: { id }, data: input });
    return updated.count === 1 ? { ok: true, id } : { ok: false, code: "NOT_FOUND" };
  } catch (error) {
    if (isLabelTaken(error)) return { ok: false, code: "LABEL_TAKEN" };
    throw error;
  }
}

/** Desactivar quita la mesa del QR y de las reservas sin borrarla; se puede volver a activar. */
export async function setTableActive(tenantId: string, id: string, active: boolean): Promise<boolean> {
  const updated = await getTenantDb(tenantId).table.updateMany({ where: { id }, data: { active } });
  return updated.count === 1;
}

/** Nuevo token: el QR impreso deja de llevar a esta mesa (abre la carta sin mesa). */
export async function regenerateQrToken(tenantId: string, id: string): Promise<boolean> {
  const updated = await getTenantDb(tenantId).table.updateMany({ where: { id }, data: { qrToken: newQrToken() } });
  return updated.count === 1;
}
