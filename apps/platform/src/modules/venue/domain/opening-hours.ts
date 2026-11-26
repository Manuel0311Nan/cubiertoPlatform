import { z } from "zod";

/**
 * Horario semanal del local (PLT-04): por día, de 0 a 4 franjas. Se guarda en `Venue.openingHours`
 * como `{ "1": [{ "open": "13:00", "close": "16:00" }], … }`, con los días como en `Shift.daysOfWeek`
 * (1 = lunes … 7 = domingo). Un día sin franjas está cerrado.
 *
 * Una franja cuyo cierre es igual o anterior a su apertura termina al día siguiente ("20:00"–"02:00"):
 * solo puede ser la última del día.
 */

export const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export const MAX_RANGES_PER_DAY = 4;

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export interface TimeRange {
  open: string;
  close: string;
}

export type OpeningHours = Record<Weekday, TimeRange[]>;

export type OpeningHoursError =
  | { day: Weekday; code: "INVALID_TIME" | "TOO_MANY_RANGES" | "EMPTY_RANGE" | "OVERLAP" | "OVERNIGHT_NOT_LAST" };

const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));

export function emptyOpeningHours(): OpeningHours {
  return { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [] };
}

/** Lee lo guardado en la base de datos; lo que no tenga la forma esperada cuenta como cerrado. */
export function parseStoredOpeningHours(value: unknown): OpeningHours {
  const hours = emptyOpeningHours();
  if (typeof value !== "object" || value === null || Array.isArray(value)) return hours;
  for (const day of WEEKDAYS) {
    const ranges = (value as Record<string, unknown>)[String(day)];
    if (!Array.isArray(ranges)) continue;
    hours[day] = ranges.filter(
      (r): r is TimeRange => typeof r?.open === "string" && typeof r?.close === "string" && TIME.test(r.open) && TIME.test(r.close),
    );
  }
  return hours;
}

/** Comprueba un horario: horas válidas, como mucho 4 franjas al día, sin solapes. Ordena las franjas. */
export function validateOpeningHours(hours: OpeningHours): { ok: true; hours: OpeningHours } | { ok: false; errors: OpeningHoursError[] } {
  const errors: OpeningHoursError[] = [];
  const result = emptyOpeningHours();
  for (const day of WEEKDAYS) {
    const ranges = hours[day] ?? [];
    if (ranges.length > MAX_RANGES_PER_DAY) {
      errors.push({ day, code: "TOO_MANY_RANGES" });
      continue;
    }
    if (ranges.some((r) => !TIME.test(r.open) || !TIME.test(r.close))) {
      errors.push({ day, code: "INVALID_TIME" });
      continue;
    }
    if (ranges.some((r) => r.open === r.close)) {
      errors.push({ day, code: "EMPTY_RANGE" });
      continue;
    }
    const sorted = [...ranges].sort((a, b) => minutes(a.open) - minutes(b.open));
    const overnight = sorted.findIndex((r) => minutes(r.close) < minutes(r.open));
    if (overnight !== -1 && overnight !== sorted.length - 1) {
      errors.push({ day, code: "OVERNIGHT_NOT_LAST" });
      continue;
    }
    if (sorted.some((r, i) => i > 0 && minutes(r.open) < minutes(sorted[i - 1]!.close))) {
      errors.push({ day, code: "OVERLAP" });
      continue;
    }
    result[day] = sorted.map(({ open, close }) => ({ open, close }));
  }
  return errors.length ? { ok: false, errors } : { ok: true, hours: result };
}

/** Lee el formulario: `hours.<día>.<n>.open` y `hours.<día>.<n>.close`. Las filas vacías se ignoran. */
export function openingHoursFromForm(formData: FormData): OpeningHours {
  const hours = emptyOpeningHours();
  const rows = new Map<string, Partial<TimeRange>>();
  for (const [key, value] of formData.entries()) {
    const match = /^hours\.([1-7])\.(\d)\.(open|close)$/.exec(key);
    if (!match || typeof value !== "string") continue;
    const [, day, index, field] = match;
    const row = rows.get(`${day}.${index}`) ?? {};
    row[field as keyof TimeRange] = value.trim();
    rows.set(`${day}.${index}`, row);
  }
  for (const [key, row] of [...rows.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    if (!row.open && !row.close) continue;
    const day = Number(key.split(".")[0]) as Weekday;
    hours[day].push({ open: row.open ?? "", close: row.close ?? "" });
  }
  return hours;
}

/** Para guardar en `Venue.openingHours` (claves "1"…"7"). */
export function toStoredOpeningHours(hours: OpeningHours): Record<string, { open: string; close: string }[]> {
  return Object.fromEntries(WEEKDAYS.map((day) => [String(day), hours[day].map(({ open, close }) => ({ open, close }))]));
}

export const timeSchema = z.string().regex(TIME);
