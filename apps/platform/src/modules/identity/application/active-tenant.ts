import { getSystemDb, type Role } from "@cubierto/db";

/**
 * Local activo del panel (PLT-02, CLAUDE.md §6.2). Se guarda en la sesión (`Session.activeTenantId`)
 * y **en cada petición** se comprueba que el usuario sigue teniendo membresía en ese local: si se la
 * quitan, o si alguien cambiara el valor guardado, se ignora. El `tenantId` nunca sale de la URL,
 * de un parámetro ni del formulario.
 *
 * Usa systemDb: leer las membresías de un usuario y su sesión son datos de plataforma
 * (packages/db/README.md).
 */

export interface UserMembership {
  tenantId: string;
  tenantName: string;
  role: Role;
}

/** Locales en los que el usuario tiene membresía activa (sin accesos quitados ni locales borrados), por nombre. */
export async function listUserMemberships(userId: string): Promise<UserMembership[]> {
  const memberships = await getSystemDb().membership.findMany({
    where: { userId, deletedAt: null, tenant: { deletedAt: null } },
    select: { tenantId: true, role: true, tenant: { select: { name: true } } },
    orderBy: { tenant: { name: "asc" } },
  });
  return memberships.map((m) => ({ tenantId: m.tenantId, tenantName: m.tenant.name, role: m.role }));
}

export type ActiveTenant =
  | { kind: "active"; membership: UserMembership; membershipCount: number }
  /** Varios locales y ninguno elegido (o el elegido ya no vale): hay que elegir. */
  | { kind: "choose"; memberships: UserMembership[] }
  /** No tiene acceso a ningún local. */
  | { kind: "none" };

async function storeActiveTenant(userId: string, sessionId: string, tenantId: string | null): Promise<void> {
  // Por id y por usuario: una sesión solo cambia la suya.
  await getSystemDb().session.updateMany({ where: { id: sessionId, userId }, data: { activeTenantId: tenantId } });
}

/** PLT-02: qué local ve el usuario en esta sesión. Si solo tiene uno, lo elige solo. */
export async function resolveActiveTenant(userId: string, sessionId: string): Promise<ActiveTenant> {
  const [session, memberships] = await Promise.all([
    getSystemDb().session.findFirst({ where: { id: sessionId, userId }, select: { activeTenantId: true } }),
    listUserMemberships(userId),
  ]);
  const stored = session?.activeTenantId ?? null;

  const current = stored ? memberships.find((m) => m.tenantId === stored) : undefined;
  if (current) return { kind: "active", membership: current, membershipCount: memberships.length };

  if (memberships.length === 1) {
    const [only] = memberships as [UserMembership];
    await storeActiveTenant(userId, sessionId, only.tenantId);
    return { kind: "active", membership: only, membershipCount: 1 };
  }
  // Lo guardado ya no vale (le han quitado el acceso o el local se ha borrado): se olvida.
  if (stored) await storeActiveTenant(userId, sessionId, null);
  return memberships.length === 0 ? { kind: "none" } : { kind: "choose", memberships };
}

export type SelectActiveTenantResult = { ok: true } | { ok: false; code: "NOT_A_MEMBER" };

/** PLT-02: el usuario elige local. Solo uno en el que tenga membresía. */
export async function selectActiveTenant(userId: string, sessionId: string, tenantId: string): Promise<SelectActiveTenantResult> {
  const memberships = await listUserMemberships(userId);
  if (!memberships.some((m) => m.tenantId === tenantId)) return { ok: false, code: "NOT_A_MEMBER" };
  await storeActiveTenant(userId, sessionId, tenantId);
  return { ok: true };
}
