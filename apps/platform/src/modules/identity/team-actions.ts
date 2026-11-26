"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { dispatchOutboxEvent } from "@/modules/notifications/application/outbox";
import { requireOwner } from "@/modules/tenancy/panel";
import { changeRole, inviteMember, removeMember, resendTeamInvitation, revokeInvitation } from "./application/team";
import { inviteSchema, roleSchema, TEAM_PATH } from "./domain/team";

/**
 * PLT-03: acciones de Ajustes → Equipo. Solo OWNER; el local sale de la sesión (requireOwner).
 * Los avisos van en la dirección sin datos personales (`?aviso=invited`), nunca el email.
 */

function done(param: "aviso" | "error", code: string): never {
  revalidatePath(TEAM_PATH);
  redirect(`${TEAM_PATH}?${param}=${code}`);
}

export type InviteFormState =
  | { status: "idle"; values: { email: string; role: string } }
  | { status: "invalid"; values: { email: string; role: string }; code: "INVALID_EMAIL" | "ALREADY_MEMBER" | "ALREADY_INVITED" };

export async function inviteMemberAction(_previous: InviteFormState, formData: FormData): Promise<InviteFormState> {
  const panel = await requireOwner();
  const values = { email: String(formData.get("email") ?? ""), role: String(formData.get("role") ?? "STAFF") };
  const parsed = inviteSchema.safeParse(values);
  if (!parsed.success) return { status: "invalid", values, code: "INVALID_EMAIL" };

  const result = await inviteMember(panel.membership.tenantId, panel.user.id, parsed.data);
  if (!result.ok) return { status: "invalid", values, code: result.code };
  // El email sale después de responder (PLT-08); si falla, se reenvía desde la lista.
  after(() => dispatchOutboxEvent(result.eventId));
  done("aviso", "invited");
}

export async function changeRoleAction(formData: FormData): Promise<void> {
  const panel = await requireOwner();
  const role = roleSchema.safeParse(formData.get("role"));
  if (!role.success) done("error", "NOT_FOUND");
  const result = await changeRole(panel.membership.tenantId, panel.user.id, String(formData.get("userId") ?? ""), role.data);
  if (result.ok) done("aviso", "roleChanged");
  done("error", result.code);
}

export async function removeMemberAction(formData: FormData): Promise<void> {
  const panel = await requireOwner();
  const result = await removeMember(panel.membership.tenantId, panel.user.id, String(formData.get("userId") ?? ""));
  if (result.ok) done("aviso", "removed");
  done("error", result.code);
}

export async function resendTeamInvitationAction(formData: FormData): Promise<void> {
  const panel = await requireOwner();
  const result = await resendTeamInvitation(panel.membership.tenantId, String(formData.get("invitationId") ?? ""));
  if (!result.ok) done("error", "NOT_FOUND");
  after(() => dispatchOutboxEvent(result.eventId));
  done("aviso", "resent");
}

export async function revokeInvitationAction(formData: FormData): Promise<void> {
  const panel = await requireOwner();
  const ok = await revokeInvitation(panel.membership.tenantId, panel.user.id, String(formData.get("invitationId") ?? ""));
  done(ok ? "aviso" : "error", ok ? "revoked" : "NOT_FOUND");
}
