import { describe, expect, test } from "vitest";
import { addDays, expandClosure, groupClosures, todayIn } from "./closed-dates";
import { emptyOpeningHours, openingHoursFromForm, parseStoredOpeningHours, validateOpeningHours, type OpeningHours } from "./opening-hours";
import { normalizePhone, venueDetailsSchema } from "./venue-details";

function hours(partial: Partial<OpeningHours>): OpeningHours {
  return { ...emptyOpeningHours(), ...partial };
}

describe("PLT-04 · horario semanal", () => {
  test("PLT-04: varias franjas por día, se guardan ordenadas", () => {
    const result = validateOpeningHours(hours({ 2: [{ open: "20:00", close: "23:30" }, { open: "13:00", close: "16:00" }] }));
    expect(result).toEqual({ ok: true, hours: hours({ 2: [{ open: "13:00", close: "16:00" }, { open: "20:00", close: "23:30" }] }) });
  });

  test("PLT-04: una franja que acaba de madrugada vale si es la última del día", () => {
    expect(validateOpeningHours(hours({ 5: [{ open: "13:00", close: "16:00" }, { open: "20:00", close: "02:00" }] })).ok).toBe(true);
    expect(validateOpeningHours(hours({ 5: [{ open: "20:00", close: "02:00" }, { open: "23:00", close: "23:30" }] }))).toEqual({
      ok: false,
      errors: [{ day: 5, code: "OVERNIGHT_NOT_LAST" }],
    });
  });

  test("PLT-04: franjas que se pisan, vacías, con horas mal escritas o más de 4 → error en ese día", () => {
    const result = validateOpeningHours(
      hours({
        1: [{ open: "13:00", close: "16:00" }, { open: "15:30", close: "18:00" }],
        2: [{ open: "13:00", close: "13:00" }],
        3: [{ open: "25:00", close: "16:00" }],
        4: Array.from({ length: 5 }, (_, i) => ({ open: `0${i}:00`, close: `0${i}:30` })),
      }),
    );
    expect(result).toEqual({
      ok: false,
      errors: [
        { day: 1, code: "OVERLAP" },
        { day: 2, code: "EMPTY_RANGE" },
        { day: 3, code: "INVALID_TIME" },
        { day: 4, code: "TOO_MANY_RANGES" },
      ],
    });
  });

  test("lee el formulario e ignora las filas vacías", () => {
    const form = new FormData();
    form.set("hours.1.0.open", "13:00");
    form.set("hours.1.0.close", "16:00");
    form.set("hours.1.1.open", "");
    form.set("hours.1.1.close", "");
    form.set("hours.7.0.open", "12:00");
    form.set("hours.7.0.close", "17:00");
    form.set("otro", "x");
    expect(openingHoursFromForm(form)).toEqual(hours({ 1: [{ open: "13:00", close: "16:00" }], 7: [{ open: "12:00", close: "17:00" }] }));
  });

  test("lo guardado con otra forma cuenta como cerrado", () => {
    expect(parseStoredOpeningHours({ "1": [{ open: "13:00", close: "16:00" }, { open: "x" }], "2": "nada" })).toEqual(
      hours({ 1: [{ open: "13:00", close: "16:00" }] }),
    );
    expect(parseStoredOpeningHours(null)).toEqual(emptyOpeningHours());
  });
});

describe("PLT-04 · datos del local", () => {
  test("teléfonos a E.164 con +34 por defecto", () => {
    expect(normalizePhone("600 12 34 56")).toBe("+34600123456");
    expect(normalizePhone("918.12.34.56")).toBe("+34918123456");
    expect(normalizePhone("0034 600 123 456")).toBe("+34600123456");
    expect(normalizePhone("+33 6 12 34 56 78")).toBe("+33612345678");
    expect(normalizePhone("123")).toBeNull();
  });

  test("PLT-04: campos opcionales vacíos se guardan como vacíos; los mal escritos dan error", () => {
    const ok = venueDetailsSchema.parse({ name: " Casa Brezo ", addressLine: "", city: " Alcalá ", postalCode: "", phone: "600123456", whatsappPhone: "", email: " Hola@Casa.ES " });
    expect(ok).toEqual({ name: "Casa Brezo", addressLine: null, city: "Alcalá", postalCode: null, phone: "+34600123456", whatsappPhone: null, email: "hola@casa.es" });
    const bad = venueDetailsSchema.safeParse({ name: "C", addressLine: "", city: "", postalCode: "2880", phone: "12", whatsappPhone: "", email: "no" });
    expect(bad.success).toBe(false);
    if (!bad.success) expect(new Set(bad.error.issues.map((i) => i.path[0]))).toEqual(new Set(["name", "postalCode", "phone", "email"]));
  });
});

describe("PLT-04 · cierres puntuales", () => {
  const today = "2026-12-20";

  test("PLT-04: un día o un periodo, incluidos los dos extremos", () => {
    expect(expandClosure("2026-12-25", null, today)).toEqual({ ok: true, dates: ["2026-12-25"] });
    expect(expandClosure("2026-12-30", "2027-01-02", today)).toEqual({ ok: true, dates: ["2026-12-30", "2026-12-31", "2027-01-01", "2027-01-02"] });
  });

  test("PLT-04: no vale en el pasado, al revés, con fechas imposibles ni de más de 62 días", () => {
    expect(expandClosure("2026-12-19", null, today)).toEqual({ ok: false, code: "IN_THE_PAST" });
    expect(expandClosure("2026-12-26", "2026-12-25", today)).toEqual({ ok: false, code: "END_BEFORE_START" });
    expect(expandClosure("2027-02-30", null, today)).toEqual({ ok: false, code: "INVALID_DATE" });
    expect(expandClosure("2027-01-01", "2027-03-31", today)).toEqual({ ok: false, code: "TOO_LONG" });
  });

  test("agrupa días seguidos con el mismo motivo", () => {
    const periods = groupClosures([
      { id: "c", date: "2027-01-14", reason: "Vacaciones" },
      { id: "a", date: "2027-01-12", reason: "Vacaciones" },
      { id: "b", date: "2027-01-13", reason: "Vacaciones" },
      { id: "d", date: "2026-12-25", reason: null },
      { id: "e", date: "2027-01-15", reason: null },
    ]);
    expect(periods).toEqual([
      { from: "2026-12-25", to: "2026-12-25", reason: null, ids: ["d"] },
      { from: "2027-01-12", to: "2027-01-14", reason: "Vacaciones", ids: ["a", "b", "c"] },
      { from: "2027-01-15", to: "2027-01-15", reason: null, ids: ["e"] },
    ]);
  });

  test("fechas en la zona del local y suma de días sin errores de cambio de hora", () => {
    expect(todayIn("Europe/Madrid", new Date("2026-12-31T23:30:00Z"))).toBe("2027-01-01");
    expect(addDays("2026-10-24", 2)).toBe("2026-10-26");
  });
});
