import { describe, expect, test } from "vitest";
import { checkBeforeRun, crossedGlobalThresholds, monthKey, monthStart, nextMonthStart, readGlobalBudgetMicros, type TenantAiState } from "./budget";

const tenant = (overrides: Partial<TenantAiState> = {}): TenantAiState => ({
  enabled: true,
  disabledTasks: [],
  monthlyBudgetMicros: 2_000_000,
  spentMicros: 0,
  callsLastMinute: 0,
  ...overrides,
});
const noGlobal = { budgetMicros: null, spentMicros: 0 };
const task = { id: "menu.translate" };

describe("AI-04 · presupuestos y límites", () => {
  test("AI-04: deja pasar con IA activada, presupuesto y ritmo dentro de los límites", () => {
    expect(checkBeforeRun(task, tenant({ spentMicros: 1_999_999, callsLastMinute: 19 }), noGlobal)).toBeNull();
  });

  test("AI-04: IA desactivada para el local o para la tarea → AI_DISABLED", () => {
    expect(checkBeforeRun(task, tenant({ enabled: false }), noGlobal)).toBe("AI_DISABLED");
    expect(checkBeforeRun(task, tenant({ disabledTasks: ["menu.translate"] }), noGlobal)).toBe("AI_DISABLED");
  });

  test("AI-04: presupuesto del mes agotado → AI_BUDGET_EXCEEDED", () => {
    expect(checkBeforeRun(task, tenant({ spentMicros: 2_000_000 }), noGlobal)).toBe("AI_BUDGET_EXCEEDED");
  });

  test("AI-04: más de 20 llamadas por minuto → AI_RATE_LIMITED", () => {
    expect(checkBeforeRun(task, tenant({ callsLastMinute: 20 }), noGlobal)).toBe("AI_RATE_LIMITED");
  });

  test("AI-04: al 100 % del tope global se cortan las tareas no esenciales", () => {
    const full = { budgetMicros: 50_000_000, spentMicros: 50_000_000 };
    expect(checkBeforeRun(task, tenant(), full)).toBe("AI_BUDGET_EXCEEDED");
    expect(checkBeforeRun({ id: "system.ping", essential: true }, null, full)).toBeNull();
  });

  test("AI-04: avisos al cruzar el 80 % y el 100 % del tope global, una sola vez", () => {
    expect(crossedGlobalThresholds(39_000_000, 40_000_000, 50_000_000)).toEqual([80]);
    expect(crossedGlobalThresholds(40_000_000, 41_000_000, 50_000_000)).toEqual([]);
    expect(crossedGlobalThresholds(39_000_000, 51_000_000, 50_000_000)).toEqual([80, 100]);
    expect(crossedGlobalThresholds(0, 10, null)).toEqual([]);
    expect(readGlobalBudgetMicros("50")).toBe(50_000_000);
    expect(readGlobalBudgetMicros("12,5")).toBe(12_500_000);
    expect(readGlobalBudgetMicros("")).toBeNull();
  });

  test("AI-04: el mes se cuenta en hora de Madrid y se renueva el día 1", () => {
    // 1 de diciembre a las 00:30 en Madrid = 30 de noviembre a las 23:30 UTC: ya es diciembre.
    const now = new Date("2026-11-30T23:30:00Z");
    expect(monthKey(now)).toBe("2026-12");
    expect(monthStart(now).toISOString()).toBe("2026-11-30T23:00:00.000Z");
    expect(nextMonthStart(now).toISOString()).toBe("2026-12-31T23:00:00.000Z");
    // En verano (UTC+2)
    expect(monthStart(new Date("2026-07-15T10:00:00Z")).toISOString()).toBe("2026-06-30T22:00:00.000Z");
    // El mes en el que cambia la hora (marzo empieza en UTC+1)
    expect(nextMonthStart(new Date("2026-03-10T10:00:00Z")).toISOString()).toBe("2026-03-31T22:00:00.000Z");
  });
});
