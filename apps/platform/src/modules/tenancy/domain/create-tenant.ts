import { z } from "zod";
import { signInEmailSchema } from "@/modules/identity/domain/sign-in";
import { slugSchema } from "./slug";

import { MODULE_KEYS } from "./modules";

export { MODULE_KEYS, type ModuleKeyValue } from "./modules";

export const TENANT_NAME_MAX_LENGTH = 80;
export const ACTIVATION_REASON_MAX_LENGTH = 200;

export type CreateTenantField = "name" | "slug" | "ownerEmail" | "modules" | "reason";

/**
 * PLT-01: alta de un local por el superadmin. Los módulos iniciales se activan sin pago hasta que
 * llegue el cobro con Stripe (BILL-03), así que llevan motivo obligatorio, como cualquier
 * activación manual (00-plataforma §6, PLT-09).
 */
export const createTenantSchema = z
  .object({
    name: z.string().trim().min(2).max(TENANT_NAME_MAX_LENGTH),
    slug: z.string().trim().toLowerCase().pipe(slugSchema),
    ownerEmail: signInEmailSchema,
    modules: z.array(z.enum(MODULE_KEYS)).transform((modules) => MODULE_KEYS.filter((key) => modules.includes(key))),
    reason: z
      .string()
      .trim()
      .max(ACTIVATION_REASON_MAX_LENGTH)
      .transform((value) => (value === "" ? null : value)),
  })
  .superRefine((value, ctx) => {
    if (value.modules.length > 0 && (value.reason === null || value.reason.length < 3)) {
      ctx.addIssue({ code: "custom", path: ["reason"], message: "REASON_REQUIRED" });
    }
  });

export type CreateTenantInput = z.output<typeof createTenantSchema>;

/** Campos con error de un intento fallido, para marcarlos en el formulario. */
export function invalidFields(error: z.ZodError): CreateTenantField[] {
  const fields = new Set<CreateTenantField>();
  for (const issue of error.issues) {
    const field = issue.path[0];
    if (field === "name" || field === "slug" || field === "ownerEmail" || field === "modules" || field === "reason") {
      fields.add(field);
    }
  }
  return [...fields];
}

/** Código del error del slug (SLUG_RESERVED, SLUG_TOO_SHORT…) si lo hay. */
export function slugErrorCode(error: z.ZodError): string | null {
  const issue = error.issues.find((i) => i.path[0] === "slug" && i.code === "custom");
  return issue?.message ?? (error.issues.some((i) => i.path[0] === "slug") ? "SLUG_INVALID_FORMAT" : null);
}
