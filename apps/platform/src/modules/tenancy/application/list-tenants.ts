import { getSystemDb } from "@cubierto/db";
import { invitationState, type InvitationState } from "@/modules/identity/domain/invitation";
import type { ModuleKeyValue } from "../domain/create-tenant";

export interface TenantListItem {
  id: string;
  slug: string;
  name: string;
  createdAt: Date;
  modules: ModuleKeyValue[];
  /** Personas con papel OWNER en el local. */
  owners: number;
  /** Invitación OWNER más reciente sin aceptar, para reenviarla (null si no queda ninguna). */
  pendingOwnerInvitation: { id: string; email: string; state: Exclude<InvitationState, "ACCEPTED"> } | null;
}

/**
 * PLT-09 (D20, mínimo): lista de locales del superadmin, del más reciente al más antiguo.
 * systemDb: el superadmin ve todos los locales (packages/db/README.md).
 */
export async function listTenants(now = new Date()): Promise<TenantListItem[]> {
  const tenants = await getSystemDb().tenant.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      slug: true,
      name: true,
      createdAt: true,
      modules: { where: { status: { in: ["ACTIVE", "PAST_DUE"] } }, select: { module: true } },
      _count: { select: { memberships: { where: { role: "OWNER", deletedAt: null } } } },
      invitations: {
        where: { role: "OWNER", acceptedAt: null, revokedAt: null },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { id: true, email: true, expiresAt: true, acceptedAt: true },
      },
    },
  });

  return tenants.map((tenant) => {
    const invitation = tenant.invitations[0];
    const state = invitation ? invitationState(invitation, now) : null;
    return {
      id: tenant.id,
      slug: tenant.slug,
      name: tenant.name,
      createdAt: tenant.createdAt,
      modules: tenant.modules.map((m) => m.module),
      owners: tenant._count.memberships,
      pendingOwnerInvitation: invitation && state && state !== "ACCEPTED" ? { id: invitation.id, email: invitation.email, state } : null,
    };
  });
}
