import { getTenantDb, type Prisma } from "@cubierto/db";
import { expandClosure, groupClosures, todayIn, type ClosureErrorCode, type ClosurePeriod } from "../domain/closed-dates";
import { parseStoredOpeningHours, toStoredOpeningHours, type OpeningHours } from "../domain/opening-hours";
import type { VenueDetails } from "../domain/venue-details";

/**
 * PLT-04: datos, horario y cierres del local. Todo por getTenantDb (CLAUDE.md §6.1); el `tenantId`
 * llega de la sesión (requirePanel) y el permiso (solo OWNER) lo comprueban las acciones.
 * MVP: un local por tenant, el primero que se creó.
 */

async function venueOf(tenantId: string) {
  return getTenantDb(tenantId).venue.findFirstOrThrow({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      addressLine: true,
      city: true,
      postalCode: true,
      phone: true,
      whatsappPhone: true,
      email: true,
      timezone: true,
      openingHours: true,
    },
  });
}

export interface VenueSettings {
  details: VenueDetails;
  openingHours: OpeningHours;
  /** Cierres de hoy en adelante, agrupados por periodos. */
  closures: ClosurePeriod[];
  today: string;
}

export async function getVenueSettings(tenantId: string, now = new Date()): Promise<VenueSettings> {
  const venue = await venueOf(tenantId);
  const today = todayIn(venue.timezone, now);
  const closures = await getTenantDb(tenantId).closedDate.findMany({
    where: { venueId: venue.id, deletedAt: null, date: { gte: today } },
    select: { id: true, date: true, reason: true },
  });
  return {
    details: {
      name: venue.name,
      addressLine: venue.addressLine,
      city: venue.city,
      postalCode: venue.postalCode,
      phone: venue.phone,
      whatsappPhone: venue.whatsappPhone,
      email: venue.email,
    },
    openingHours: parseStoredOpeningHours(venue.openingHours),
    closures: groupClosures(closures),
    today,
  };
}

export async function updateVenueDetails(tenantId: string, details: VenueDetails): Promise<void> {
  const venue = await venueOf(tenantId);
  await getTenantDb(tenantId).venue.update({ where: { id: venue.id }, data: details });
}

/** `hours` ya validado con validateOpeningHours. */
export async function updateOpeningHours(tenantId: string, hours: OpeningHours): Promise<void> {
  const venue = await venueOf(tenantId);
  await getTenantDb(tenantId).venue.update({ where: { id: venue.id }, data: { openingHours: toStoredOpeningHours(hours) as Prisma.InputJsonObject } });
}

export type AddClosureResult = { ok: true; added: number } | { ok: false; code: ClosureErrorCode };

/** Cierra el local del `from` al `to` (o solo `from`). Los días que ya estaban cerrados no se repiten. */
export async function addClosure(
  tenantId: string,
  input: { from: string; to: string | null; reason: string | null },
  now = new Date(),
): Promise<AddClosureResult> {
  const venue = await venueOf(tenantId);
  const expanded = expandClosure(input.from, input.to, todayIn(venue.timezone, now));
  if (!expanded.ok) return expanded;

  const added = await getTenantDb(tenantId).$tenantTransaction(async (tx) => {
    const existing = await tx.closedDate.findMany({
      where: { venueId: venue.id, deletedAt: null, date: { in: expanded.dates } },
      select: { date: true },
    });
    const taken = new Set(existing.map((row) => row.date));
    const dates = expanded.dates.filter((date) => !taken.has(date));
    if (dates.length) {
      await tx.closedDate.createMany({
        data: dates.map((date) => ({ tenantId, venueId: venue.id, date, reason: input.reason })),
      });
    }
    return dates.length;
  });
  return { ok: true, added };
}

/** Quita un cierre (borrado lógico, CLAUDE.md §11). Ids de otro local no hacen nada. */
export async function removeClosure(tenantId: string, ids: string[], now = new Date()): Promise<number> {
  if (ids.length === 0) return 0;
  const result = await getTenantDb(tenantId).closedDate.updateMany({
    where: { id: { in: ids }, deletedAt: null },
    data: { deletedAt: now },
  });
  return result.count;
}
