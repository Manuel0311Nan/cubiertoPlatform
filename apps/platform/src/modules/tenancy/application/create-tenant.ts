import { getSystemDb, Prisma } from "@cubierto/db";
import { createInvitation } from "@/modules/identity/application/invitations";
import type { CreateTenantInput } from "../domain/create-tenant";

export type CreateTenantResult =
  | { ok: true; tenantId: string; slug: string; invitationEventId: string }
  | { ok: false; code: "SLUG_TAKEN" };

/**
 * PLT-01: el superadmin da de alta un local. En una sola transacción: `Tenant`, `Venue` vacío,
 * módulos iniciales (activos sin pago, con motivo), `Invitation` OWNER con su `OutboxEvent` y el
 * registro en auditoría. El email de invitación lo envía quien llama, después del commit.
 *
 * Usa systemDb (superadmin, packages/db/README.md): crea el tenant y sus primeras filas a la vez.
 */
export async function createTenant(input: CreateTenantInput, actorUserId: string, now = new Date()): Promise<CreateTenantResult> {
  try {
    return await getSystemDb().$transaction(async (tx) => {
      const tenant = await tx.tenant.create({ data: { slug: input.slug, name: input.name } });
      await tx.venue.create({ data: { tenantId: tenant.id, name: input.name } });
      if (input.modules.length > 0) {
        await tx.tenantModule.createMany({
          data: input.modules.map((module) => ({
            tenantId: tenant.id,
            module,
            status: "ACTIVE" as const,
            overrideReason: input.reason,
          })),
        });
      }
      const { eventId } = await createInvitation(tx, {
        tenantId: tenant.id,
        tenantName: tenant.name,
        email: input.ownerEmail,
        role: "OWNER",
        now,
      });
      await tx.auditLog.create({
        data: {
          tenantId: tenant.id,
          actorUserId,
          action: "tenant.created",
          data: { slug: tenant.slug, modules: input.modules, reason: input.reason, ownerEmail: input.ownerEmail },
        },
      });
      return { ok: true as const, tenantId: tenant.id, slug: tenant.slug, invitationEventId: eventId };
    });
  } catch (error) {
    // El único dato único que puede chocar es el slug (los ids y el token son aleatorios).
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { ok: false, code: "SLUG_TAKEN" };
    }
    throw error;
  }
}
