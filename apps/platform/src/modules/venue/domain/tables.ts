import { z } from "zod";

/**
 * Mesas del local (PLT-05). El QR de cada mesa lleva a `/c/<slug>?t=<qrToken>` (MENU-08); el
 * token se genera en `qr-token.ts`, solo en el servidor. Este archivo lo usa también el formulario.
 * Regenerarlo invalida el QR impreso: la carta se abre igual, pero sin mesa (MENU-01).
 */

export const MAX_SEATS = 50;

/** Ajustes → Mesas. Aquí y no en las acciones: un archivo "use server" solo exporta funciones. */
export const TABLES_PATH = "/panel/ajustes/mesas";

/** Lo que se enseña del token para ver que ha cambiado (el QR es público: va impreso en la mesa). */
export function qrFingerprint(token: string): string {
  return token.slice(0, 6).toUpperCase();
}

const seats = z.coerce.number().int().min(1).max(MAX_SEATS);

export const tableInputSchema = z
  .object({
    label: z.string().trim().min(1).max(20),
    zone: z
      .string()
      .trim()
      .max(40)
      .transform((value) => (value === "" ? null : value)),
    minSeats: seats,
    maxSeats: seats,
  })
  .refine((value) => value.maxSeats >= value.minSeats, { path: ["maxSeats"], message: "MAX_BELOW_MIN" });

export type TableInput = z.output<typeof tableInputSchema>;
export type TableField = "label" | "zone" | "minSeats" | "maxSeats";

export function invalidTableFields(error: z.ZodError): TableField[] {
  const fields: TableField[] = ["label", "zone", "minSeats", "maxSeats"];
  return [...new Set(error.issues.map((i) => i.path[0]))].filter((f): f is TableField => fields.includes(f as TableField));
}

/** Orden natural por etiqueta ("2" antes que "10"), las activas primero. */
export function compareTables(a: { label: string; active: boolean }, b: { label: string; active: boolean }): number {
  if (a.active !== b.active) return a.active ? -1 : 1;
  return a.label.localeCompare(b.label, "es", { numeric: true, sensitivity: "base" });
}
