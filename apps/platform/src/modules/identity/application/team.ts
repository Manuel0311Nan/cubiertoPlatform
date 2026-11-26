import { getSystemDb, getTenantDb, type Role, type TenantTransaction } from "@cubierto/db";
import { invitationState } from "../domain/invitation";
import { createInvitation, reissueInvitation } from "./invitations";

/**
 * PLT-03: el OWNER invita a su equipo, cambia papeles y quita accesos. No se puede quitar el último
 * OWNER del local. Los datos del local van por getTenantDb; nombre, email y último acceso de cada
 * persona son de plataforma (`User`, `Session`) y se leen con systemDb solo para quienes ya están
 * en el equipo de este local.
 *
 * Quitar el acceso y cancelar una invitación no borran filas (CLAUDE.md §11): `Membership.deletedAt`
 * e `Invitation.revokedAt`. Nadie puede cambiar su propio papel ni quitarse a sí mismo desde aquí,
 * para no dejarse fuera por error.
 */

export interface TeamMember {
  userId: string;
  email: string;
  name: string | null;
  role: Role;
  /** Última vez que su sesión se usó (Better Auth la renueva al usarla); null si nunca ha entrado. */
  lastAccessAt: Date | null;
  isYou: boolean;
}

export interface PendingInvitation {
  id: string;
  email: string;
  role: Role;
  sentAt: Date;
  expired: boolean;
}

export interface Team {
  members: TeamMember[];
  invitations: PendingInvitation[];
}

const ROLE_ORDER: Record<Role, number> = { OWNER: 0, STAFF: 1 };

export async function getTeam(tenantId: string, currentUserId: string, now = new Date()): Promise<Team> {
  const db = getTenantDb(tenantId);
  const [memberships, invitations] = await Promise.all([
    db.membership.findMany({ where: { deletedAt: null }, select: { userId: true, role: true } }),
    db.invitation.findMany({
      where: { acceptedAt: null, revokedAt: null },
      orderBy: { createdAt: "desc" },
      select: { id: true, email: true, role: true, createdAt: true, expiresAt: true, acceptedAt: true },
    }),
  ]);

  const userIds = memberships.map((m) => m.userId);
  const [users, sessions] = await Promise.all([
    getSystemDb().user.findMany({ where: { id: { in: userIds } }, select: { id: true, email: true, name: true } }),
    getSystemDb().session.groupBy({ by: ["userId"], where: { userId: { in: userIds } }, _max: { updatedAt: true } }),
  ]);
  const userById = new Map(users.map((u) => [u.id, u]));
  const lastAccess = new Map(sessions.map((s) => [s.userId, s._max.updatedAt]));

  const members = memberships
    .map((m) => {
      const user = userById.get(m.userId);
      return {
        userId: m.userId,
        email: user?.email ?? "",
        name: user?.name || null,
        role: m.role,
        lastAccessAt: lastAccess.get(m.userId) ?? null,
        isYou: m.userId === currentUserId,
      };
    })
    .sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role] || (a.name ?? a.email).localeCompare(b.name ?? b.email, "es"));

  return {
    members,
    invitations: invitations.map((i) => ({
      id: i.id,
      email: i.email,
      role: i.role,
      sentAt: i.createdAt,
      expired: invitationState(i, now) === "EXPIRED",
    })),
  };
}

export type InviteResult = { ok: true; eventId: string } | { ok: false; code: "ALREADY_MEMBER" | "ALREADY_INVITED" };

/** PLT-03: invitar por email con papel OWNER o STAFF. El email sale tras el commit (outbox). */
export async function inviteMember(
  tenantId: string,
  actorUserId: string,
  input: { email: string; role: Role },
  now = new Date(),
): Promise<InviteResult> {
  const db = getTenantDb(tenantId);
  const user = await getSystemDb().user.findUnique({ where: { email: input.email }, select: { id: true } });
  if (user) {
    const member = await db.membership.findFirst({ where: { userId: user.id, deletedAt: null }, select: { userId: true } });
    if (member) return { ok: false, code: "ALREADY_MEMBER" };
  }
  const pending = await db.invitation.findFirst({
    where: { email: input.email, acceptedAt: null, revokedAt: null, expiresAt: { gt: now } },
    select: { id: true },
  });
  if (pending) return { ok: false, code: "ALREADY_INVITED" };

  const tenant = await getSystemDb().tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { name: true } });
  const eventId = await db.$tenantTransaction(async (tx) => {
    const { eventId } = await createInvitation(tx, { tenantId, tenantName: tenant.name, email: input.email, role: input.role, now });
    await tx.auditLog.create({ data: { tenantId, actorUserId, action: "member.invited", data: { email: input.email, role: input.role } } });
    return eventId;
  });
  return { ok: true, eventId };
}

type TeamChangeError = "NOT_FOUND" | "LAST_OWNER" | "SELF";

/**
 * Bloquea las membresías OWNER activas del local hasta el final de la transacción: si dos personas
 * responsables se quitan el papel a la vez, la segunda espera y ve que ya solo queda una.
 */
async function lockOwners(tx: TenantTransaction): Promise<number> {
  const rows = await tx.$queryRaw<{ userId: string }[]>`
    SELECT "userId" FROM "Membership" WHERE role = 'OWNER' AND "deletedAt" IS NULL FOR UPDATE`;
  return rows.length;
}

/** PLT-03: cambiar el papel de alguien del equipo. No a uno mismo, ni dejar el local sin OWNER. */
export async function changeRole(
  tenantId: string,
  actorUserId: string,
  userId: string,
  role: Role,
): Promise<{ ok: true } | { ok: false; code: TeamChangeError }> {
  if (userId === actorUserId) return { ok: false, code: "SELF" };
  return getTenantDb(tenantId).$tenantTransaction(async (tx) => {
    const owners = await lockOwners(tx);
    const member = await tx.membership.findFirst({ where: { userId, deletedAt: null }, select: { role: true } });
    if (!member) return { ok: false, code: "NOT_FOUND" } as const;
    if (member.role === role) return { ok: true } as const;
    if (member.role === "OWNER" && owners <= 1) return { ok: false, code: "LAST_OWNER" } as const;
    await tx.membership.update({ where: { userId_tenantId: { userId, tenantId } }, data: { role } });
    await tx.auditLog.create({ data: { tenantId, actorUserId, action: "member.role_changed", data: { userId, from: member.role, to: role } } });
    return { ok: true } as const;
  });
}

/** PLT-03: quitar el acceso. Deja de entrar en su siguiente petición (el local activo se comprueba siempre). */
export async function removeMember(
  tenantId: string,
  actorUserId: string,
  userId: string,
  now = new Date(),
): Promise<{ ok: true } | { ok: false; code: TeamChangeError }> {
  if (userId === actorUserId) return { ok: false, code: "SELF" };
  return getTenantDb(tenantId).$tenantTransaction(async (tx) => {
    const owners = await lockOwners(tx);
    const member = await tx.membership.findFirst({ where: { userId, deletedAt: null }, select: { role: true } });
    if (!member) return { ok: false, code: "NOT_FOUND" } as const;
    if (member.role === "OWNER" && owners <= 1) return { ok: false, code: "LAST_OWNER" } as const;
    await tx.membership.update({ where: { userId_tenantId: { userId, tenantId } }, data: { deletedAt: now } });
    await tx.auditLog.create({ data: { tenantId, actorUserId, action: "member.removed", data: { userId, role: member.role } } });
    return { ok: true } as const;
  });
}

/** Reenviar una invitación pendiente del local: enlace nuevo y 7 días más. */
export async function resendTeamInvitation(tenantId: string, invitationId: string) {
  const invitation = await getTenantDb(tenantId).invitation.findFirst({
    where: { id: invitationId, acceptedAt: null, revokedAt: null },
    select: { id: true },
  });
  if (!invitation) return { ok: false, code: "NOT_FOUND" } as const;
  return reissueInvitation(invitation.id);
}

/** Cancelar una invitación pendiente: su enlace deja de valer y no se puede pedir otra con él. */
export async function revokeInvitation(tenantId: string, actorUserId: string, invitationId: string, now = new Date()): Promise<boolean> {
  return getTenantDb(tenantId).$tenantTransaction(async (tx) => {
    const updated = await tx.invitation.updateMany({ where: { id: invitationId, acceptedAt: null, revokedAt: null }, data: { revokedAt: now } });
    if (updated.count !== 1) return false;
    await tx.auditLog.create({ data: { tenantId, actorUserId, action: "invitation.revoked", data: { invitationId } } });
    return true;
  });
}
