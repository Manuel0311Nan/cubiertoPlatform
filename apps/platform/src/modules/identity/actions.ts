"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { dispatchOutboxEvent } from "@/modules/notifications/application/outbox";
import { acceptInvitation, reissueInvitation, requestNewInvitation } from "./application/invitations";
import { requestSignInLink, signInDirectly, signOut } from "./application/sign-in";
import { INVITATION_PATH } from "./domain/invitation";
import { AFTER_SIGN_IN_PATH } from "./infra/auth";
import { requireSuperadmin } from "./session";
import { signInEmailSchema } from "./domain/sign-in";
import { SIGN_IN_PATH } from "./infra/auth";

export type SignInFormState =
  | { status: "idle"; email: string }
  | { status: "invalid"; email: string }
  | { status: "failed"; email: string }
  | { status: "sent"; email: string; resent: boolean };

/** PLT-02: formulario "Entra en tu panel" (D5, M10). Funciona también sin JavaScript. */
export async function requestSignInLinkAction(previous: SignInFormState, formData: FormData): Promise<SignInFormState> {
  const raw = String(formData.get("email") ?? "");
  const parsed = signInEmailSchema.safeParse(raw);
  if (!parsed.success) return { status: "invalid", email: raw };

  const result = await requestSignInLink(parsed.data, await headers());
  if (!result.ok) return { status: "failed", email: parsed.data };
  return { status: "sent", email: parsed.data, resent: previous.status === "sent" };
}

export async function signOutAction(): Promise<void> {
  await signOut(await headers());
  redirect(SIGN_IN_PATH);
}

/**
 * PLT-02: "Aceptar y entrar". Con éxito, abre la sesión aquí mismo y lleva al panel; si no,
 * vuelve a la pantalla de la invitación, que explica qué pasa (caducada, ya usada…).
 */
export async function acceptInvitationAction(formData: FormData): Promise<void> {
  const token = String(formData.get("token") ?? "");
  const result = await acceptInvitation(token);
  if (!result.ok) redirect(`${INVITATION_PATH}/${encodeURIComponent(token)}`);
  await signInDirectly(result.email, await headers());
  redirect(AFTER_SIGN_IN_PATH);
}

/** PLT-02: desde un enlace caducado, "Enviarme otra invitación". */
export async function requestNewInvitationAction(formData: FormData): Promise<void> {
  const token = String(formData.get("token") ?? "");
  const result = await requestNewInvitation(token);
  if (!result.ok) redirect(`${INVITATION_PATH}/${encodeURIComponent(token)}`);
  after(() => dispatchOutboxEvent(result.eventId));
  redirect(`${INVITATION_PATH}?enviada=1`);
}

/** PLT-01/PLT-09: el superadmin reenvía la invitación de un local (red de seguridad del outbox). */
export async function resendInvitationAction(formData: FormData): Promise<void> {
  await requireSuperadmin();
  const result = await reissueInvitation(String(formData.get("invitationId") ?? ""));
  if (result.ok) after(() => dispatchOutboxEvent(result.eventId));
  redirect(`/admin?${result.ok ? `reenviada=${encodeURIComponent(result.email)}` : "reenvio=fallido"}`);
}
