import { z } from "zod";

/**
 * Teléfono a E.164 (RES-02: "+34 por defecto"). Acepta espacios, puntos, guiones y paréntesis;
 * "00" delante cuenta como "+". Un número de 9 cifras sin prefijo se toma como español.
 */
export function normalizePhone(raw: string): string | null {
  const compact = raw.trim().replace(/[\s.\-()]/g, "");
  if (compact === "") return null;
  const withPlus = compact.startsWith("00") ? `+${compact.slice(2)}` : compact;
  const e164 = /^[6789]\d{8}$/.test(withPlus) ? `+34${withPlus}` : withPlus;
  return /^\+[1-9]\d{7,14}$/.test(e164) ? e164 : null;
}

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === "" ? null : value));

const optionalPhone = z
  .string()
  .transform((value, ctx) => {
    if (value.trim() === "") return null;
    const phone = normalizePhone(value);
    if (!phone) ctx.addIssue({ code: "custom", message: "INVALID_PHONE" });
    return phone;
  });

/** PLT-04: datos del local que edita el OWNER. Alimentan la web, la carta y las reservas. */
export const venueDetailsSchema = z.object({
  name: z.string().trim().min(2).max(80),
  addressLine: optionalText(160),
  city: optionalText(80),
  postalCode: z
    .string()
    .trim()
    .refine((value) => value === "" || /^\d{5}$/.test(value), "INVALID_POSTAL_CODE")
    .transform((value) => (value === "" ? null : value)),
  phone: optionalPhone,
  whatsappPhone: optionalPhone,
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(254)
    .refine((value) => value === "" || z.email().safeParse(value).success, "INVALID_EMAIL")
    .transform((value) => (value === "" ? null : value)),
});

export type VenueDetails = z.output<typeof venueDetailsSchema>;
export type VenueDetailsField = keyof VenueDetails;

export function invalidVenueFields(error: z.ZodError): VenueDetailsField[] {
  const keys = new Set(Object.keys(venueDetailsSchema.shape));
  return [...new Set(error.issues.map((i) => String(i.path[0])).filter((k) => keys.has(k)))] as VenueDetailsField[];
}
