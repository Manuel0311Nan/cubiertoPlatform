import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";

/** PLT-02: una invitación vale 7 días desde que se envía. */
export const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Pantalla que abre el enlace de la invitación: `/invitacion/<token>`. */
export const INVITATION_PATH = "/invitacion";

/** 32 bytes aleatorios en base64url: 43 caracteres, no adivinable. Solo se guarda su hash. */
export function newInvitationToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashInvitationToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Forma de un token válido: descarta lo demás sin ir a la base de datos. */
export const invitationTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);

export function invitationExpiresAt(now: Date): Date {
  return new Date(now.getTime() + INVITATION_TTL_MS);
}

export type InvitationState = "VALID" | "EXPIRED" | "ACCEPTED";

export function invitationState(invitation: { acceptedAt: Date | null; expiresAt: Date }, now: Date): InvitationState {
  if (invitation.acceptedAt) return "ACCEPTED";
  return invitation.expiresAt.getTime() <= now.getTime() ? "EXPIRED" : "VALID";
}
