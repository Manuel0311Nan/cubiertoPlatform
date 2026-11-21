import { z } from "zod";

/**
 * Slugs que ningún local puede usar (`specs/02-arquitectura.md` §7, PLT-01).
 * Esta lista solo se amplía, nunca se reduce: quitar uno podría dar a un local
 * un subdominio o una ruta que la plataforma ya usa.
 */
export const RESERVED_SLUGS = [
  "app",
  "admin",
  "api",
  "www",
  "mail",
  "email",
  "blog",
  "ayuda",
  "help",
  "soporte",
  "status",
  "estado",
  "static",
  "assets",
  "cdn",
  "docs",
  "dev",
  "staging",
  "preview",
  "c",
  "r",
  "panel",
  "login",
  "cubierto",
] as const;

export const SLUG_MIN_LENGTH = 3;
export const SLUG_MAX_LENGTH = 40;

/** `[a-z0-9-]`, sin guion al principio ni al final: el slug es un subdominio y DNS no los admite. */
const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

const reservedSlugs: ReadonlySet<string> = new Set(RESERVED_SLUGS);

export type SlugErrorCode =
  | "SLUG_TOO_SHORT"
  | "SLUG_TOO_LONG"
  | "SLUG_INVALID_FORMAT"
  | "SLUG_RESERVED";

export type SlugValidation = { ok: true } | { ok: false; code: SlugErrorCode };

export function isReservedSlug(slug: string): boolean {
  return reservedSlugs.has(slug);
}

/** PLT-01: comprueba formato, longitud y lista de reservados. La unicidad la comprueba la base de datos. */
export function validateSlug(slug: string): SlugValidation {
  if (slug.length < SLUG_MIN_LENGTH) return { ok: false, code: "SLUG_TOO_SHORT" };
  if (slug.length > SLUG_MAX_LENGTH) return { ok: false, code: "SLUG_TOO_LONG" };
  if (!SLUG_PATTERN.test(slug)) return { ok: false, code: "SLUG_INVALID_FORMAT" };
  if (isReservedSlug(slug)) return { ok: false, code: "SLUG_RESERVED" };
  return { ok: true };
}

/** Un slug que podría pertenecer a un local (para descartar rutas y hosts sin ir a la base de datos). */
export function isUsableSlug(slug: string): boolean {
  return validateSlug(slug).ok;
}

/** Schema para el borde (Server Action de PLT-01). El mensaje del issue es el `SlugErrorCode`. */
export const slugSchema = z.string().superRefine((value, ctx) => {
  const result = validateSlug(value);
  if (!result.ok) ctx.addIssue({ code: "custom", message: result.code });
});

/**
 * PLT-01: slug sugerido desde el nombre del local ("Casa Brezo" → "casa-brezo").
 * Quita tildes y signos, y recorta a la longitud máxima. Puede salir reservado o demasiado
 * corto: el formulario lo valida igual que si lo hubiera escrito el superadmin.
 */
export function suggestSlug(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, SLUG_MAX_LENGTH)
    .replace(/-+$/, "");
}
