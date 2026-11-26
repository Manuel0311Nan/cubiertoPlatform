"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOwner } from "@/modules/tenancy/panel";
import { createTable, regenerateQrToken, setTableActive, updateTable } from "./application/tables";
import { invalidTableFields, TABLES_PATH, tableInputSchema, type TableField } from "./domain/tables";

/** PLT-05: acciones de Ajustes → Mesas. Solo OWNER; el local sale de la sesión. */

export type TableFormValues = Record<TableField, string>;

export type TableFormState =
  | { status: "idle"; values: TableFormValues }
  | { status: "invalid"; values: TableFormValues; fields: TableField[]; labelTaken: boolean; maxBelowMin: boolean };

function valuesFrom(formData: FormData): TableFormValues {
  return {
    label: String(formData.get("label") ?? ""),
    zone: String(formData.get("zone") ?? ""),
    minSeats: String(formData.get("minSeats") ?? ""),
    maxSeats: String(formData.get("maxSeats") ?? ""),
  };
}

/** Crea una mesa o, si el formulario trae `id`, edita esa mesa (solo si es del local de la sesión). */
export async function saveTableAction(_previous: TableFormState, formData: FormData): Promise<TableFormState> {
  const panel = await requireOwner();
  const values = valuesFrom(formData);
  const parsed = tableInputSchema.safeParse(values);
  if (!parsed.success) {
    const maxBelowMin = parsed.error.issues.some((i) => i.message === "MAX_BELOW_MIN");
    return { status: "invalid", values, fields: invalidTableFields(parsed.error), labelTaken: false, maxBelowMin };
  }

  const id = String(formData.get("id") ?? "");
  const tenantId = panel.membership.tenantId;
  const result = id ? await updateTable(tenantId, id, parsed.data) : await createTable(tenantId, parsed.data);
  if (!result.ok && result.code === "LABEL_TAKEN") {
    return { status: "invalid", values, fields: ["label"], labelTaken: true, maxBelowMin: false };
  }
  revalidatePath(TABLES_PATH);
  redirect(`${TABLES_PATH}?${result.ok ? "guardada=1" : "noexiste=1"}`);
}

export async function setTableActiveAction(formData: FormData): Promise<void> {
  const panel = await requireOwner();
  await setTableActive(panel.membership.tenantId, String(formData.get("id") ?? ""), formData.get("active") === "true");
  revalidatePath(TABLES_PATH);
}

/** Tras confirmar en la pantalla: el QR impreso deja de llevar a esta mesa. */
export async function regenerateQrAction(formData: FormData): Promise<void> {
  const panel = await requireOwner();
  const id = String(formData.get("id") ?? "");
  const ok = await regenerateQrToken(panel.membership.tenantId, id);
  revalidatePath(TABLES_PATH);
  redirect(`${TABLES_PATH}?${ok ? `regenerada=${encodeURIComponent(id)}` : "noexiste=1"}`);
}
