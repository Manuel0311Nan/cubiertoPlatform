import { randomUUID } from "node:crypto";
import { getSystemDb } from "../src/client.ts";

/** Los tests de integración necesitan una base migrada y exclusiva para tests. */
export function requireTestDatabase(): void {
  if (!process.env.TEST_DATABASE_URL) {
    throw new Error(
      "Falta TEST_DATABASE_URL: una base de datos migrada solo para tests (en Neon, la rama `test`). " +
        "Añádela al .env de la raíz y ejecuta `pnpm db:migrate:test`.",
    );
  }
}

export interface TestTenant {
  tenantId: string;
  venueId: string;
  slug: string;
}

/** Crea un tenant con su local, con ids únicos para no chocar con otros tests ni con el seed. */
export async function createTestTenant(label: string): Promise<TestTenant> {
  const suffix = randomUUID().slice(0, 8);
  const tenantId = `test_${label}_${suffix}`;
  const venueId = `test_venue_${label}_${suffix}`;
  const slug = `test-${label}-${suffix}`;
  const db = getSystemDb();
  await db.tenant.create({ data: { id: tenantId, slug, name: `Test ${label}` } });
  await db.venue.create({ data: { id: venueId, tenantId, name: `Local ${label}` } });
  return { tenantId, venueId, slug };
}

/** Borra todo lo de los tenants de prueba (systemDb: corre como dueño de las tablas, sin RLS). */
export async function deleteTestTenants(tenantIds: string[]): Promise<void> {
  const db = getSystemDb();
  const where = { tenantId: { in: tenantIds } };
  await db.table.deleteMany({ where });
  await db.floorZone.deleteMany({ where });
  await db.closedDate.deleteMany({ where });
  await db.outboxEvent.deleteMany({ where });
  await db.auditLog.deleteMany({ where });
  await db.membership.deleteMany({ where });
  await db.invitation.deleteMany({ where });
  await db.tenantModule.deleteMany({ where });
  await db.subscription.deleteMany({ where });
  await db.domain.deleteMany({ where });
  await db.venue.deleteMany({ where });
  await db.tenant.deleteMany({ where: { id: { in: tenantIds } } });
}
