import { z } from "zod";

/**
 * Cierres puntuales (PLT-04): días en que el local está cerrado entero, como fechas "AAAA-MM-DD"
 * en la zona horaria del local. Un periodo (vacaciones) se guarda como un día por fila.
 */

export const MAX_CLOSURE_DAYS = 62;

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Fecha de calendario como instante a medianoche UTC: solo para sumar días, nunca para mostrar. */
function toUtc(date: string): Date | null {
  if (!DATE.test(date)) return null;
  const parsed = new Date(`${date}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date ? null : parsed;
}

export function isCalendarDate(value: string): boolean {
  return toUtc(value) !== null;
}

export function addDays(date: string, days: number): string {
  const base = toUtc(date);
  if (!base) throw new Error(`Fecha no válida: ${date}`);
  return new Date(base.getTime() + days * 86_400_000).toISOString().slice(0, 10);
}

/** Hoy en la zona horaria del local ("AAAA-MM-DD"). */
export function todayIn(timeZone: string, now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export type ClosureErrorCode = "INVALID_DATE" | "END_BEFORE_START" | "IN_THE_PAST" | "TOO_LONG";

/** Días de un cierre del `from` al `to` (incluidos; sin `to`, un solo día). */
export function expandClosure(from: string, to: string | null, today: string): { ok: true; dates: string[] } | { ok: false; code: ClosureErrorCode } {
  const end = to ?? from;
  if (!isCalendarDate(from) || !isCalendarDate(end)) return { ok: false, code: "INVALID_DATE" };
  if (end < from) return { ok: false, code: "END_BEFORE_START" };
  if (from < today) return { ok: false, code: "IN_THE_PAST" };
  const dates: string[] = [];
  for (let date = from; date <= end; date = addDays(date, 1)) {
    dates.push(date);
    if (dates.length > MAX_CLOSURE_DAYS) return { ok: false, code: "TOO_LONG" };
  }
  return { ok: true, dates };
}

export interface ClosureDay {
  id: string;
  date: string;
  reason: string | null;
}

export interface ClosurePeriod {
  from: string;
  to: string;
  reason: string | null;
  ids: string[];
}

/** Agrupa días seguidos con el mismo motivo ("Vacaciones del 12 al 26 de enero"). */
export function groupClosures(days: readonly ClosureDay[]): ClosurePeriod[] {
  const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date));
  const periods: ClosurePeriod[] = [];
  for (const day of sorted) {
    const last = periods.at(-1);
    if (last && last.reason === day.reason && addDays(last.to, 1) === day.date) {
      last.to = day.date;
      last.ids.push(day.id);
    } else if (last && last.to === day.date) {
      last.ids.push(day.id);
    } else {
      periods.push({ from: day.date, to: day.date, reason: day.reason, ids: [day.id] });
    }
  }
  return periods;
}

export const closureInputSchema = z.object({
  from: z.string().trim(),
  to: z
    .string()
    .trim()
    .transform((value) => (value === "" ? null : value)),
  reason: z
    .string()
    .trim()
    .max(80)
    .transform((value) => (value === "" ? null : value)),
});
