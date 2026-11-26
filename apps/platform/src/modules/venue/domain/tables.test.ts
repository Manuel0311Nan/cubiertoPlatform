import { describe, expect, test } from "vitest";
import { newQrToken } from "./qr-token";
import { compareTables, invalidTableFields, qrFingerprint, tableInputSchema } from "./tables";

describe("PLT-05 · mesas", () => {
  test("PLT-05: etiqueta, zona y plazas mínimas y máximas", () => {
    expect(tableInputSchema.parse({ label: " 5 ", zone: " Terraza ", minSeats: "2", maxSeats: "4" })).toEqual({ label: "5", zone: "Terraza", minSeats: 2, maxSeats: 4 });
    expect(tableInputSchema.parse({ label: "Barra", zone: "", minSeats: "1", maxSeats: "1" }).zone).toBeNull();
  });

  test("PLT-05: plazas máximas por debajo de las mínimas, sin etiqueta o fuera de rango → error en el campo", () => {
    const result = tableInputSchema.safeParse({ label: " ", zone: "", minSeats: "6", maxSeats: "4" });
    expect(result.success).toBe(false);
    if (!result.success) expect(invalidTableFields(result.error).sort()).toEqual(["label", "maxSeats"]);
    const zero = tableInputSchema.safeParse({ label: "1", zone: "", minSeats: "0", maxSeats: "99" });
    if (!zero.success) expect(invalidTableFields(zero.error).sort()).toEqual(["maxSeats", "minSeats"]);
  });

  test("PLT-05: el token del QR es aleatorio, corto y seguro en una URL", () => {
    const token = newQrToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(newQrToken()).not.toBe(token);
    expect(qrFingerprint("abcdefghij")).toBe("ABCDEF");
  });

  test("orden natural de las mesas, las desactivadas al final", () => {
    const tables = [
      { label: "10", active: true },
      { label: "Terraza 2", active: true },
      { label: "2", active: true },
      { label: "1", active: false },
    ];
    expect([...tables].sort(compareTables).map((t) => t.label)).toEqual(["2", "10", "Terraza 2", "1"]);
  });
});
