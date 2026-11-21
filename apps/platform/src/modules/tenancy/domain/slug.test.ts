import { describe, expect, test } from "vitest";
import { RESERVED_SLUGS, slugSchema, suggestSlug, validateSlug } from "./slug";

describe("PLT-01 · slug del local", () => {
  test("PLT-01: acepta [a-z0-9-] entre 3 y 40 caracteres", () => {
    expect(validateSlug("casa-brezo")).toEqual({ ok: true });
    expect(validateSlug("bar-2")).toEqual({ ok: true });
    expect(validateSlug("abc")).toEqual({ ok: true });
    expect(validateSlug("a".repeat(40))).toEqual({ ok: true });
  });

  test("PLT-01: rechaza slugs demasiado cortos o largos", () => {
    expect(validateSlug("ab")).toEqual({ ok: false, code: "SLUG_TOO_SHORT" });
    expect(validateSlug("a".repeat(41))).toEqual({ ok: false, code: "SLUG_TOO_LONG" });
  });

  test("PLT-01: rechaza mayúsculas, tildes, espacios y otros signos", () => {
    for (const slug of ["Casa-Brezo", "café-sol", "casa brezo", "casa_brezo", "casa.brezo"]) {
      expect(validateSlug(slug)).toEqual({ ok: false, code: "SLUG_INVALID_FORMAT" });
    }
  });

  test("PLT-01: rechaza guion al principio o al final (no es un subdominio válido)", () => {
    expect(validateSlug("-brezo")).toEqual({ ok: false, code: "SLUG_INVALID_FORMAT" });
    expect(validateSlug("brezo-")).toEqual({ ok: false, code: "SLUG_INVALID_FORMAT" });
  });

  test("PLT-01: todo slug reservado de 3 o más caracteres da error de validación", () => {
    for (const slug of RESERVED_SLUGS.filter((s) => s.length >= 3)) {
      expect(validateSlug(slug)).toEqual({ ok: false, code: "SLUG_RESERVED" });
    }
  });

  test("PLT-01: la lista de reservados incluye la de 02-arquitectura §7", () => {
    expect(RESERVED_SLUGS).toEqual(
      expect.arrayContaining(["app", "admin", "api", "www", "mail", "panel", "c", "r", "login", "cubierto"]),
    );
  });

  test("PLT-01: el schema de Zod devuelve el código de error como mensaje", () => {
    const result = slugSchema.safeParse("admin");
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("SLUG_RESERVED");
    expect(slugSchema.safeParse("casa-brezo").success).toBe(true);
  });

  test("PLT-01: sugiere el slug desde el nombre", () => {
    expect(suggestSlug("Casa Brezo")).toBe("casa-brezo");
    expect(suggestSlug("  El Arco & Co. ")).toBe("el-arco-co");
    expect(suggestSlug("Mesón Peñalara")).toBe("meson-penalara");
    expect(suggestSlug("La Taberna d'en Pep")).toBe("la-taberna-d-en-pep");
  });

  test("PLT-01: la sugerencia nunca pasa de 40 caracteres ni acaba en guion", () => {
    const slug = suggestSlug("Restaurante de cocina tradicional castellana y algo más");
    expect(slug.length).toBeLessThanOrEqual(40);
    expect(slug.endsWith("-")).toBe(false);
    expect(validateSlug(slug)).toEqual({ ok: true });
  });
});
