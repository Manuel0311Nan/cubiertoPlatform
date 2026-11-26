import { getSystemDb, getTenantDb, Prisma, type Role } from "@cubierto/db";
import {
  INVITATION_EVENT,
  type InvitationEventPayload,
} from "@/modules/notifications/application/handlers/invitation";
import {
  hashInvitationToken,
  INVITATION_PATH,
  invitationExpiresAt,
  invitationState,
  invitationTokenSchema,
  newInvitationToken,
  type InvitationState,
} from "../domain/invitation";
import { appUrl } from "../infra/auth";

/**
 * Invitaciones al panel de un local (PLT-01, PLT-02; después PLT-03).
 *
 * El enlace lleva un token aleatorio del que solo se guarda el hash. El email sale por el outbox
 * (`invitation.created`): el evento se guarda en la misma transacción que la invitación y quien
 * llama lo envía después del commit con `dispatchOutboxEvent`.
 *
 * Buscar por token usa systemDb: es la única forma de saber de qué local es la invitación antes de
 * tener sesión, como resolver un slug (packages/db/README.md). Lo que cambia datos del local
 * (aceptar) va por getTenantDb.
 */

/**
 * Transacción en la que se guarda la invitación: de systemDb (alta de un local por el superadmin,
 * reenvíos) o del tenant (el OWNER invita a su equipo, PLT-03). Solo hacen falta estas dos tablas.
 */
export interface InvitationTransaction {
  invitation: { create(args: { data: Prisma.InvitationUncheckedCreateInput }): PromiseLike<{ id: string }> };
  outboxEvent: { create(args: { data: Prisma.OutboxEventUncheckedCreateInput }): PromiseLike<{ id: string }> };
}

interface NewInvitation {
  tenantId: string;
  tenantName: string;
  email: string;
  role: Role;
  now: Date;
}

/** Guarda la invitación y su evento de email. Devuelve el id del evento para enviarlo tras el commit. */
export async function createInvitation(tx: InvitationTransaction, input: NewInvitation) {
  const token = newInvitationToken();
  const expiresAt = invitationExpiresAt(input.now);
  const invitation = await tx.invitation.create({
    data: {
      tenantId: input.tenantId,
      email: input.email,
      role: input.role,
      tokenHash: hashInvitationToken(token),
      expiresAt,
    },
  });
  const eventId = await enqueueInvitationEmail(tx, { ...input, invitationId: invitation.id, token, expiresAt });
  return { invitationId: invitation.id, eventId };
}

async function enqueueInvitationEmail(
  tx: InvitationTransaction,
  input: NewInvitation & { invitationId: string; token: string; expiresAt: Date },
): Promise<string> {
  const payload: InvitationEventPayload = {
    invitationId: input.invitationId,
    to: input.email,
    tenantName: input.tenantName,
    role: input.role,
    url: appUrl(`${INVITATION_PATH}/${input.token}`),
    expiresAt: input.expiresAt.toISOString(),
  };
  const event = await tx.outboxEvent.create({
    data: { tenantId: input.tenantId, type: INVITATION_EVENT, payload: { ...payload } },
  });
  return event.id;
}

async function findByToken(token: string) {
  if (!invitationTokenSchema.safeParse(token).success) return null;
  const invitation = await getSystemDb().invitation.findUnique({
    where: { tokenHash: hashInvitationToken(token) },
    select: {
      id: true,
      tenantId: true,
      email: true,
      role: true,
      expiresAt: true,
      acceptedAt: true,
      revokedAt: true,
      tenant: { select: { name: true, deletedAt: true } },
    },
  });
  // Una invitación cancelada (PLT-03) o de un local borrado se trata como un enlace que no existe.
  if (!invitation || invitation.revokedAt || invitation.tenant.deletedAt) return null;
  return invitation;
}

export type InvitationView =
  | { state: "NOT_FOUND" }
  | { state: InvitationState; tenantName: string; email: string; role: Role };

/** PLT-02: qué enseña la pantalla de la invitación. */
export async function getInvitationView(token: string, now = new Date()): Promise<InvitationView> {
  const invitation = await findByToken(token);
  if (!invitation) return { state: "NOT_FOUND" };
  return {
    state: invitationState(invitation, now),
    tenantName: invitation.tenant.name,
    email: invitation.email,
    role: invitation.role,
  };
}

/**
 * Usuario por email, creándolo si no existe. `upsert` no es atómico en Prisma: si dos peticiones
 * lo crean a la vez, la segunda choca con el email único (P2002) y basta con leer el que ya hay.
 */
async function findOrCreateUser(email: string) {
  const db = getSystemDb();
  try {
    return await db.user.upsert({ where: { email }, create: { email, emailVerified: true }, update: {} });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return db.user.findUniqueOrThrow({ where: { email } });
    }
    throw error;
  }
}

export type AcceptInvitationResult =
  | { ok: true; email: string }
  | { ok: false; code: "NOT_FOUND" | "EXPIRED" | "ALREADY_ACCEPTED" };

/**
 * PLT-02: acepta la invitación: crea el usuario si no existe y su membresía en el local. Quien
 * llama abre después la sesión (`signInDirectly`). Se acepta al pulsar "Aceptar" (POST), nunca al
 * abrir el enlace: los antivirus del correo abren los enlaces.
 */
export async function acceptInvitation(token: string, now = new Date()): Promise<AcceptInvitationResult> {
  const invitation = await findByToken(token);
  if (!invitation) return { ok: false, code: "NOT_FOUND" };
  const state = invitationState(invitation, now);
  if (state === "ACCEPTED") return { ok: false, code: "ALREADY_ACCEPTED" };
  if (state === "EXPIRED") return { ok: false, code: "EXPIRED" };

  // User es tabla de plataforma. Haber recibido el enlace en ese buzón comprueba el email.
  const user = await findOrCreateUser(invitation.email);

  const accepted = await getTenantDb(invitation.tenantId).$tenantTransaction(async (tx) => {
    // Solo una petición la acepta aunque lleguen dos a la vez.
    const claimed = await tx.invitation.updateMany({
      where: { id: invitation.id, acceptedAt: null, expiresAt: { gt: now } },
      data: { acceptedAt: now },
    });
    if (claimed.count !== 1) return false;
    // Si ya era del equipo, conserva su papel: una invitación no le quita permisos. Si le habían
    // quitado el acceso (PLT-03), lo recupera con el papel de la invitación.
    const existing = await tx.membership.findUnique({
      where: { userId_tenantId: { userId: user.id, tenantId: invitation.tenantId } },
      select: { deletedAt: true },
    });
    if (!existing) {
      await tx.membership.create({ data: { userId: user.id, tenantId: invitation.tenantId, role: invitation.role } });
    } else if (existing.deletedAt) {
      await tx.membership.update({
        where: { userId_tenantId: { userId: user.id, tenantId: invitation.tenantId } },
        data: { deletedAt: null, role: invitation.role },
      });
    }
    return true;
  });
  if (!accepted) return { ok: false, code: "ALREADY_ACCEPTED" };

  return { ok: true, email: user.email };
}

export type ReissueInvitationResult =
  | { ok: true; eventId: string; email: string }
  | { ok: false; code: "NOT_FOUND" | "ALREADY_ACCEPTED" | "NOT_EXPIRED" };

/**
 * Nuevo enlace para una invitación sin aceptar: otro token (el anterior deja de valer), 7 días
 * más y otro email. Devuelve el evento para enviarlo tras el commit.
 */
async function reissue(invitationId: string, now: Date): Promise<ReissueInvitationResult> {
  return getSystemDb().$transaction(async (tx) => {
    const token = newInvitationToken();
    const expiresAt = invitationExpiresAt(now);
    const updated = await tx.invitation.updateMany({
      where: { id: invitationId, acceptedAt: null, revokedAt: null },
      data: { tokenHash: hashInvitationToken(token), expiresAt },
    });
    if (updated.count !== 1) return { ok: false, code: "ALREADY_ACCEPTED" } as const;

    const invitation = await tx.invitation.findUniqueOrThrow({
      where: { id: invitationId },
      select: { tenantId: true, email: true, role: true, tenant: { select: { name: true } } },
    });
    const eventId = await enqueueInvitationEmail(tx, {
      invitationId,
      tenantId: invitation.tenantId,
      tenantName: invitation.tenant.name,
      email: invitation.email,
      role: invitation.role,
      now,
      token,
      expiresAt,
    });
    return { ok: true, eventId, email: invitation.email } as const;
  });
}

/**
 * PLT-02: desde un enlace caducado, la persona pide otro. Solo si está caducado y sin aceptar;
 * como el enlace viejo deja de valer, no se puede repetir con él.
 */
export async function requestNewInvitation(token: string, now = new Date()): Promise<ReissueInvitationResult> {
  const invitation = await findByToken(token);
  if (!invitation) return { ok: false, code: "NOT_FOUND" };
  const state = invitationState(invitation, now);
  if (state === "ACCEPTED") return { ok: false, code: "ALREADY_ACCEPTED" };
  if (state === "VALID") return { ok: false, code: "NOT_EXPIRED" };
  return reissue(invitation.id, now);
}

/** PLT-01/PLT-09: el superadmin reenvía una invitación sin aceptar (caducada o no). */
export async function reissueInvitation(invitationId: string, now = new Date()): Promise<ReissueInvitationResult> {
  const exists = await getSystemDb().invitation.count({ where: { id: invitationId } });
  if (!exists) return { ok: false, code: "NOT_FOUND" };
  return reissue(invitationId, now);
}
