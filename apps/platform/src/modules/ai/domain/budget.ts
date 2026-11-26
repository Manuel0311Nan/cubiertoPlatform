import type { AiErrorCode } from "@cubierto/ai";

/**
 * AI-04: reglas de presupuesto y límites, sin base de datos. El mes se cuenta en hora de España:
 * el presupuesto "se renueva el día 1" a las 00:00 de Madrid.
 */

export const AI_TIME_ZONE = "Europe/Madrid";
/** 20 llamadas por minuto por local (AI-04). */
export const RATE_LIMIT_PER_MINUTE = 20;
/** 2 € al mes por local, en micro-euros (04-ia.md §4 y §8). */
export const DEFAULT_MONTHLY_BUDGET_MICROS = 2_000_000;
/** Avisos al superadmin por el tope global de la plataforma (AI-04). */
export const GLOBAL_BUDGET_THRESHOLDS = [80, 100] as const;
export type GlobalBudgetThreshold = (typeof GLOBAL_BUDGET_THRESHOLDS)[number];

export const MICROS_PER_EURO = 1_000_000;

function partsIn(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour"), minute: get("minute"), second: get("second") };
}

/** Diferencia (ms) entre la hora local de `timeZone` y UTC en ese instante. */
function offsetMs(date: Date, timeZone: string): number {
  const p = partsIn(date, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** Instante UTC de las 00:00 locales del día 1 del mes `month` (1–12) de `year`. */
function localMonthStart(year: number, month: number, timeZone: string): Date {
  const guess = Date.UTC(year, month - 1, 1);
  const first = guess - offsetMs(new Date(guess), timeZone);
  // Si el cambio de hora cae entre medias, el segundo cálculo lo corrige.
  return new Date(guess - offsetMs(new Date(first), timeZone));
}

/** Comienzo del mes en curso (hora de Madrid), en UTC. */
export function monthStart(now: Date, timeZone = AI_TIME_ZONE): Date {
  const { year, month } = partsIn(now, timeZone);
  return localMonthStart(year, month, timeZone);
}

/** Día 1 del mes siguiente: cuándo se renueva el presupuesto. */
export function nextMonthStart(now: Date, timeZone = AI_TIME_ZONE): Date {
  const { year, month } = partsIn(now, timeZone);
  return month === 12 ? localMonthStart(year + 1, 1, timeZone) : localMonthStart(year, month + 1, timeZone);
}

/** "2026-11": identifica el mes para no repetir avisos. */
export function monthKey(now: Date, timeZone = AI_TIME_ZONE): string {
  const { year, month } = partsIn(now, timeZone);
  return `${year}-${String(month).padStart(2, "0")}`;
}

/** `AI_GLOBAL_BUDGET_EUR` en micro-euros; null si no hay tope global configurado. */
export function readGlobalBudgetMicros(value: string | undefined): number | null {
  if (!value?.trim()) return null;
  const euros = Number(value.replace(",", "."));
  return Number.isFinite(euros) && euros > 0 ? Math.round(euros * MICROS_PER_EURO) : null;
}

export interface TenantAiState {
  enabled: boolean;
  disabledTasks: readonly string[];
  monthlyBudgetMicros: number;
  spentMicros: number;
  callsLastMinute: number;
}

export interface GlobalAiState {
  budgetMicros: number | null;
  spentMicros: number;
}

/**
 * AI-04: qué impide ejecutar una tarea antes de llamar al proveedor; null si puede ir.
 * `tenant` null = uso interno o del superadmin (solo cuenta el tope global).
 */
export function checkBeforeRun(task: { id: string; essential?: boolean }, tenant: TenantAiState | null, global: GlobalAiState): AiErrorCode | null {
  if (tenant && (!tenant.enabled || tenant.disabledTasks.includes(task.id))) return "AI_DISABLED";
  if (global.budgetMicros !== null && global.spentMicros >= global.budgetMicros && !task.essential) return "AI_BUDGET_EXCEEDED";
  if (tenant && tenant.spentMicros >= tenant.monthlyBudgetMicros) return "AI_BUDGET_EXCEEDED";
  if (tenant && tenant.callsLastMinute >= RATE_LIMIT_PER_MINUTE) return "AI_RATE_LIMITED";
  return null;
}

/** Umbrales del tope global (80 %, 100 %) que se cruzan al pasar de `before` a `after`. */
export function crossedGlobalThresholds(before: number, after: number, budgetMicros: number | null): GlobalBudgetThreshold[] {
  if (budgetMicros === null || after <= before) return [];
  return GLOBAL_BUDGET_THRESHOLDS.filter((percent) => {
    const limit = (budgetMicros * percent) / 100;
    return before < limit && after >= limit;
  });
}
