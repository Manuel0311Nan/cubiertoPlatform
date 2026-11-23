/**
 * Datos de demo deterministas (CLAUDE.md §5 y §8): 2 locales y 1 superadmin.
 * Todo es inventado: dominios `.test`, teléfonos y direcciones de ejemplo. Se puede ejecutar
 * varias veces (upserts por id). Uso: `pnpm db:seed`.
 */
import { disconnectDb, getSystemDb } from "./client.ts";
import { getTenantDb } from "./tenant.ts";

try {
  process.loadEnvFile(new URL("../../../.env", import.meta.url));
} catch {
  // Sin `.env`: variables del entorno.
}

const SEED_REASON = "Datos de demo (seed)";

// Vacío en el .env (como en .env.example) cuenta como no puesto. En minúsculas: la entrada (PLT-02)
// busca el email normalizado.
const superadminEmail = process.env.SEED_SUPERADMIN_EMAIL?.trim().toLowerCase() || "superadmin@cubierto.test";

const tenants = [
  {
    id: "seed_tenant_casa_brezo",
    slug: "casa-brezo",
    name: "Casa Brezo",
    venue: {
      id: "seed_venue_casa_brezo",
      name: "Casa Brezo",
      addressLine: "Calle de Ejemplo 1",
      city: "Alcalá de Henares",
      postalCode: "28801",
      phone: "+34600000001",
      whatsappPhone: "+34600000001",
    },
    modules: ["SITE", "MENU", "RESERVATIONS"] as const,
    users: [
      { id: "seed_user_casa_brezo_owner", email: "duena@casa-brezo.test", name: "Dueña de Casa Brezo", role: "OWNER" },
      { id: "seed_user_casa_brezo_staff", email: "sala@casa-brezo.test", name: "Sala de Casa Brezo", role: "STAFF" },
    ] as const,
  },
  {
    id: "seed_tenant_el_arco",
    slug: "el-arco",
    name: "El Arco",
    venue: {
      id: "seed_venue_el_arco",
      name: "El Arco",
      addressLine: null,
      city: null,
      postalCode: null,
      phone: null,
      whatsappPhone: null,
    },
    modules: ["MENU"] as const,
    users: [{ id: "seed_user_el_arco_owner", email: "dueno@el-arco.test", name: "Dueño de El Arco", role: "OWNER" }] as const,
  },
];

async function main(): Promise<void> {
  const db = getSystemDb();

  await db.user.upsert({
    where: { id: "seed_user_superadmin" },
    create: { id: "seed_user_superadmin", email: superadminEmail, name: "Superadmin", isSuperadmin: true },
    update: { email: superadminEmail, isSuperadmin: true },
  });

  for (const tenant of tenants) {
    await db.tenant.upsert({
      where: { id: tenant.id },
      create: { id: tenant.id, slug: tenant.slug, name: tenant.name },
      update: { slug: tenant.slug, name: tenant.name },
    });

    for (const user of tenant.users) {
      await db.user.upsert({
        where: { id: user.id },
        create: { id: user.id, email: user.email, name: user.name },
        update: { email: user.email, name: user.name },
      });
    }

    const tenantDb = getTenantDb(tenant.id);
    const { id: venueId, ...venue } = tenant.venue;
    await tenantDb.venue.upsert({
      where: { id: venueId },
      create: { id: venueId, tenantId: tenant.id, ...venue },
      update: venue,
    });

    for (const module of tenant.modules) {
      await tenantDb.tenantModule.upsert({
        where: { tenantId_module: { tenantId: tenant.id, module } },
        create: { tenantId: tenant.id, module, status: "ACTIVE", overrideReason: SEED_REASON },
        update: { status: "ACTIVE", overrideReason: SEED_REASON },
      });
    }

    for (const user of tenant.users) {
      await tenantDb.membership.upsert({
        where: { userId_tenantId: { userId: user.id, tenantId: tenant.id } },
        create: { userId: user.id, tenantId: tenant.id, role: user.role },
        update: { role: user.role },
      });
    }
  }

  console.log(`Seed listo: ${tenants.map((t) => t.slug).join(", ")} y superadmin ${superadminEmail}`);
}

try {
  await main();
} finally {
  await disconnectDb();
}
