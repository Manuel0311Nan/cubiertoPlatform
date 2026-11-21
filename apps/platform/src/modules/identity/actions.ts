"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requestSignInLink, signOut } from "./application/sign-in";
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
