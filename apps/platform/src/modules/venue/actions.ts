"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "@/modules/tenancy/panel";
import { addClosure, removeClosure, updateOpeningHours, updateVenueDetails } from "./application/venue-settings";
import { closureInputSchema, type ClosureErrorCode } from "./domain/closed-dates";
import { openingHoursFromForm, validateOpeningHours, type OpeningHoursError } from "./domain/opening-hours";
import { invalidVenueFields, venueDetailsSchema, type VenueDetailsField } from "./domain/venue-details";

/**
 * PLT-04: acciones de Ajustes → El local. Solo OWNER; el local sale de la sesión (requireOwner),
 * nunca del formulario (CLAUDE.md §6.2).
 */

const SETTINGS_PATH = "/panel/ajustes/local";

function refresh() {
  revalidatePath(SETTINGS_PATH);
  // El nombre y la dirección salen en la barra lateral de todo el panel.
  revalidatePath("/panel", "layout");
}

export type VenueDetailsFormValues = Record<VenueDetailsField, string>;

export type VenueDetailsFormState =
  | { status: "idle" | "saved"; values: VenueDetailsFormValues }
  | { status: "invalid"; values: VenueDetailsFormValues; fields: VenueDetailsField[] };

const DETAIL_FIELDS: VenueDetailsField[] = ["name", "addressLine", "city", "postalCode", "phone", "whatsappPhone", "email"];

export async function updateVenueDetailsAction(_previous: VenueDetailsFormState, formData: FormData): Promise<VenueDetailsFormState> {
  const panel = await requireOwner();
  const values = Object.fromEntries(DETAIL_FIELDS.map((field) => [field, String(formData.get(field) ?? "")])) as VenueDetailsFormValues;
  const parsed = venueDetailsSchema.safeParse(values);
  if (!parsed.success) return { status: "invalid", values, fields: invalidVenueFields(parsed.error) };

  await updateVenueDetails(panel.membership.tenantId, parsed.data);
  refresh();
  const saved = Object.fromEntries(DETAIL_FIELDS.map((field) => [field, parsed.data[field] ?? ""])) as VenueDetailsFormValues;
  return { status: "saved", values: saved };
}

export type OpeningHoursFormState = { status: "idle" | "saved" } | { status: "invalid"; errors: OpeningHoursError[] };

export async function updateOpeningHoursAction(_previous: OpeningHoursFormState, formData: FormData): Promise<OpeningHoursFormState> {
  const panel = await requireOwner();
  const result = validateOpeningHours(openingHoursFromForm(formData));
  if (!result.ok) return { status: "invalid", errors: result.errors };
  await updateOpeningHours(panel.membership.tenantId, result.hours);
  refresh();
  return { status: "saved" };
}

export type ClosureFormState =
  | { status: "idle" | "added"; key: number }
  | { status: "invalid"; code: ClosureErrorCode; values: { from: string; to: string; reason: string }; key: number };

export async function addClosureAction(previous: ClosureFormState, formData: FormData): Promise<ClosureFormState> {
  const panel = await requireOwner();
  const values = { from: String(formData.get("from") ?? ""), to: String(formData.get("to") ?? ""), reason: String(formData.get("reason") ?? "") };
  const input = closureInputSchema.parse(values);
  const result = await addClosure(panel.membership.tenantId, input);
  if (!result.ok) return { status: "invalid", code: result.code, values, key: previous.key };
  refresh();
  // Otra `key` vacía el formulario tras añadir.
  return { status: "added", key: previous.key + 1 };
}

export async function removeClosureAction(formData: FormData): Promise<void> {
  const panel = await requireOwner();
  await removeClosure(panel.membership.tenantId, formData.getAll("id").map(String));
  refresh();
}
