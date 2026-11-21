import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client.ts";

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL no está definida (ver specs/00-necesidades.md §5).");
  }
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

const globalForDb = globalThis as typeof globalThis & { __cubiertoPrisma?: PrismaClient };

/**
 * Cliente sin ámbito de tenant. **Solo** para:
 * - tablas de plataforma (`Tenant`, `User`, `ProcessedWebhook`);
 * - resolver el tenant por slug antes de conocerlo (middleware);
 * - el superadmin y los procesos programados que recorren todos los tenants (outbox, RGPD);
 * - leer las membresías de un usuario al iniciar sesión.
 *
 * Corre como el dueño de las tablas, al que RLS no aplica. Para datos de un tenant, siempre
 * `getTenantDb(tenantId)` (CLAUDE.md §6.1 y §11).
 */
export function getSystemDb(): PrismaClient {
  globalForDb.__cubiertoPrisma ??= createPrismaClient();
  return globalForDb.__cubiertoPrisma;
}

export async function disconnectDb(): Promise<void> {
  await globalForDb.__cubiertoPrisma?.$disconnect();
  globalForDb.__cubiertoPrisma = undefined;
}
