import { describe, expect, test } from "vitest";
import { createTenantSchema, invalidFields, slugErrorCode } from "./create-tenant";

const valid = {
  name: "  Bar La Plaza ",
  slug: "Bar-La-Plaza",
  ownerEmail: " Duena@Bar-La-Plaza.TEST ",
  modules: ["RESERVATIONS", "MENU", "MENU"],
  reason: " Piloto ",
};

describe("PLT-01 · datos del alta de un local", () => {
  test("PLT-01: normaliza nombre, slug, email y módulos", () => {
    const parsed = createTenantSchema.parse(valid);
    expect(parsed).toEqual({
      name: "Bar La Plaza",
      slug: "bar-la-plaza",
      ownerEmail: "duena@bar-la-plaza.test",
      modules: ["MENU", "RESERVATIONS"],
      reason: "Piloto",
    });
  });

  test("PLT-01: slug reservado → error de validación", () => {
    const result = createTenantSchema.safeParse({ ...valid, slug: "admin" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(invalidFields(result.error)).toEqual(["slug"]);
      expect(slugErrorCode(result.error)).toBe("SLUG_RESERVED");
    }
  });

  test("PLT-01: activar módulos sin pago exige motivo; sin módulos no hace falta", () => {
    const noReason = createTenantSchema.safeParse({ ...valid, reason: "  " });
    expect(noReason.success).toBe(false);
    if (!noReason.success) expect(invalidFields(noReason.error)).toEqual(["reason"]);

    const noModules = createTenantSchema.parse({ ...valid, modules: [], reason: "" });
    expect(noModules).toMatchObject({ modules: [], reason: null });
  });

  test("PLT-01: un email no válido o un módulo que no existe no pasan", () => {
    const result = createTenantSchema.safeParse({ ...valid, ownerEmail: "no-es-un-email", modules: ["POS"] });
    expect(result.success).toBe(false);
    if (!result.success) expect(invalidFields(result.error).sort()).toEqual(["modules", "ownerEmail"]);
  });
});
