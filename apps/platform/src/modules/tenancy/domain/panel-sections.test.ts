import { describe, expect, test } from "vitest";
import { usableModules } from "./modules";
import { currentSectionKey, mobileTabs, visibleSections } from "./panel-sections";

const keys = (sections: { key: string }[]) => sections.map((s) => s.key);

describe("00-plataforma §6 · módulos que se pueden usar", () => {
  test("activos y en periodo de gracia sí; suspendidos y cancelados no", () => {
    expect(
      usableModules([
        { module: "RESERVATIONS", status: "PAST_DUE" },
        { module: "SITE", status: "SUSPENDED" },
        { module: "MENU", status: "ACTIVE" },
      ]),
    ).toEqual(["MENU", "RESERVATIONS"]);
    expect(usableModules([{ module: "MENU", status: "CANCELED" }])).toEqual([]);
  });
});

describe("PLT-02 · menú del panel según módulos y papel", () => {
  test("con los tres módulos, la responsable ve todos los apartados", () => {
    expect(keys(visibleSections(["SITE", "MENU", "RESERVATIONS"], "OWNER"))).toEqual([
      "today", "reservations", "floor", "menu", "site", "messages", "customers", "settings",
    ]);
  });

  test("solo con la carta: Hoy, Carta y Ajustes", () => {
    expect(keys(visibleSections(["MENU"], "OWNER"))).toEqual(["today", "menu", "settings"]);
  });

  test("el personal no ve Ajustes (facturación y equipo)", () => {
    expect(keys(visibleSections(["MENU"], "STAFF"))).toEqual(["today", "menu"]);
  });

  test("móvil: Hoy y hasta tres apartados de sus módulos", () => {
    expect(keys(mobileTabs(visibleSections(["SITE", "MENU", "RESERVATIONS"], "OWNER")))).toEqual(["today", "reservations", "floor", "menu"]);
    expect(keys(mobileTabs(visibleSections(["SITE"], "STAFF")))).toEqual(["today", "site"]);
  });

  test("marca el apartado de la ruta actual", () => {
    expect(currentSectionKey("/panel")).toBe("today");
    expect(currentSectionKey("/panel/reservas")).toBe("reservations");
    expect(currentSectionKey("/panel/reservas/abc")).toBe("reservations");
    expect(currentSectionKey("/panel/mas")).toBe("more");
    expect(currentSectionKey("/panel/elegir-local")).toBeNull();
  });
});
