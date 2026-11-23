"use server";

import { after } from "next/server";
import { redirect } from "next/navigation";
import { requireSuperadmin } from "@/modules/identity/session";
import { dispatchOutboxEvent } from "@/modules/notifications/application/outbox";
import { createTenant } from "./application/create-tenant";
import { createTenantSchema, invalidFields, slugErrorCode, type CreateTenantField } from "./domain/create-tenant";

export interface CreateTenantFormValues {
  name: string;
  slug: string;
  ownerEmail: string;
  modules: string[];
  reason: string;
}

export type CreateTenantFormState =
  | { status: "idle"; values: CreateTenantFormValues }
  | { status: "invalid"; values: CreateTenantFormValues; fields: CreateTenantField[]; slugError: string | null };

function valuesFrom(formData: FormData): CreateTenantFormValues {
  return {
    name: String(formData.get("name") ?? ""),
    slug: String(formData.get("slug") ?? ""),
    ownerEmail: String(formData.get("ownerEmail") ?? ""),
    modules: formData.getAll("modules").map(String),
    reason: String(formData.get("reason") ?? ""),
  };
}

/** PLT-01 (D22): "Dar de alta un local". Solo el superadmin. Funciona también sin JavaScript. */
export async function createTenantAction(_previous: CreateTenantFormState, formData: FormData): Promise<CreateTenantFormState> {
  const session = await requireSuperadmin();
  const values = valuesFrom(formData);

  const parsed = createTenantSchema.safeParse(values);
  if (!parsed.success) {
    return { status: "invalid", values, fields: invalidFields(parsed.error), slugError: slugErrorCode(parsed.error) };
  }

  const result = await createTenant(parsed.data, session.user.id);
  if (!result.ok) return { status: "invalid", values, fields: ["slug"], slugError: result.code };

  // El email de invitación sale después de responder (PLT-08); si falla, se reenvía desde la lista.
  after(() => dispatchOutboxEvent(result.invitationEventId));
  redirect(`/admin?alta=${encodeURIComponent(result.slug)}`);
}
