import { readAiConfig } from "@cubierto/ai";
import { disconnectDb, getSystemDb, getTenantDb } from "@cubierto/db";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { requireTestDatabase, uniqueSuffix } from "@/test/database";
import { monthStart } from "../domain/budget";
import { menuTranslateV1, type MenuTranslateInput } from "../tasks/menu-translate/v1";
import { systemPingV1 } from "../tasks/system-ping/v1";
import { recordGlobalBudgetWarnings } from "./global-budget";
import { enqueueAiJob, getAiJob, processAiJob, processDueAiJobs } from "./jobs";
import { runAiTask } from "./run-ai-task";
import { getTenantAiUsage } from "./usage";

const tenantIds: string[] = [];
const eventIds: string[] = [];
const pingUsageSince = new Date();

async function tenant() {
  const suffix = uniqueSuffix();
  const created = await getSystemDb().tenant.create({ data: { slug: `ia-${suffix}`, name: `IA ${suffix}` } });
  tenantIds.push(created.id);
  return created.id;
}

const translation: MenuTranslateInput = {
  targetLocale: "en",
  entries: [
    { key: "MenuItem:1", name: "Croquetas de jamón", description: "Seis unidades." },
    { key: "MenuItem:2", name: "Tortilla de Betanzos", keepName: true },
  ],
};

/** Gasto ya hecho, sin llamar a nada. */
async function spend(tenantId: string, costMicros: number, createdAt = new Date(), count = 1) {
  await getTenantDb(tenantId).aiUsage.createMany({
    data: Array.from({ length: count }, () => ({
      tenantId,
      taskId: "menu.translate",
      taskVersion: 1,
      provider: "anthropic",
      model: "anthropic:claude-haiku-5-5",
      inputTokens: 1000,
      outputTokens: 1000,
      costMicros,
      latencyMs: 900,
      status: "ok",
      createdAt,
    })),
  });
}

/** Cuenta las llamadas al proveedor simulado. */
function countingMock() {
  const calls: number[] = [];
  return {
    calls,
    mock: ({ call }: { call: number }) => {
      calls.push(call);
      return JSON.stringify(menuTranslateV1.mock(translation));
    },
  };
}

beforeAll(() => requireTestDatabase());
afterAll(async () => {
  const db = getSystemDb();
  const where = { tenantId: { in: tenantIds } };
  await db.aiUsage.deleteMany({ where });
  await db.aiUsage.deleteMany({ where: { tenantId: null, taskId: "system.ping", createdAt: { gte: pingUsageSince } } });
  await db.aiJob.deleteMany({ where });
  await db.aiSettings.deleteMany({ where });
  await db.outboxEvent.deleteMany({ where: { id: { in: eventIds } } });
  await db.tenant.deleteMany({ where: { id: { in: tenantIds } } });
  await disconnectDb();
});

describe("AI-03 · uso y coste por cliente", () => {
  test("AI-03: cada llamada crea un AiUsage del local con su tarea, versión, modelo y estado", async () => {
    const tenantId = await tenant();
    const result = await runAiTask(tenantId, menuTranslateV1, translation);
    expect(result).toMatchObject({ ok: true, data: { entries: [{ key: "MenuItem:1", name: "[EN] Croquetas de jamón" }, { name: "Tortilla de Betanzos" }] } });

    const usage = await getTenantDb(tenantId).aiUsage.findMany();
    expect(usage).toHaveLength(1);
    expect(usage[0]).toMatchObject({ tenantId, taskId: "menu.translate", taskVersion: 1, provider: "mock", model: "mock:claude-haiku-5-5", status: "ok", costMicros: 0 });
  });

  test("AI-03 y AI-02: las llamadas fallidas también quedan registradas y no se guarda nada más", async () => {
    const tenantId = await tenant();
    const result = await runAiTask(tenantId, menuTranslateV1, translation, { mock: () => '{"entries": []}' });
    expect(result).toEqual({ ok: false, code: "AI_INVALID_OUTPUT" });
    const statuses = (await getTenantDb(tenantId).aiUsage.findMany()).map((u) => u.status);
    expect(statuses).toEqual(["invalid_output", "invalid_output"]);
  });

  test("AI-01: sin clave del proveedor devuelve AI_DISABLED sin llamar ni registrar nada", async () => {
    const tenantId = await tenant();
    const result = await runAiTask(tenantId, menuTranslateV1, translation, { config: readAiConfig({ AI_PROVIDER: "live" }) });
    expect(result).toEqual({ ok: false, code: "AI_DISABLED" });
    expect(await getTenantDb(tenantId).aiUsage.count()).toBe(0);
  });

  test("AI-03: el uso interno (Probar conexión) se guarda sin local", async () => {
    const result = await runAiTask(null, systemPingV1, {}, { tier: "standard" });
    expect(result).toMatchObject({ ok: true, usage: { model: "mock:claude-sonnet-5-5" } });
    const internal = await getSystemDb().aiUsage.findFirst({ where: { tenantId: null, taskId: "system.ping" }, orderBy: { createdAt: "desc" } });
    expect(internal).toMatchObject({ model: "mock:claude-sonnet-5-5", status: "ok" });
  });
});

describe("AI-04 · presupuestos y límites", () => {
  test("AI-04: con el presupuesto del mes agotado devuelve AI_BUDGET_EXCEEDED y no llama al proveedor", async () => {
    const tenantId = await tenant();
    await spend(tenantId, 2_000_000);
    const { calls, mock } = countingMock();
    expect(await runAiTask(tenantId, menuTranslateV1, translation, { mock })).toEqual({ ok: false, code: "AI_BUDGET_EXCEEDED" });
    expect(calls).toEqual([]);
    expect(await getTenantDb(tenantId).aiUsage.count()).toBe(1);
  });

  test("AI-04: el gasto del mes anterior no cuenta y el presupuesto se puede subir", async () => {
    const tenantId = await tenant();
    await spend(tenantId, 5_000_000, new Date(monthStart(new Date()).getTime() - 60_000));
    expect(await runAiTask(tenantId, menuTranslateV1, translation)).toMatchObject({ ok: true });

    await spend(tenantId, 2_000_000);
    await getTenantDb(tenantId).aiSettings.create({ data: { tenantId, monthlyBudgetMicros: 3_000_000 } });
    expect(await runAiTask(tenantId, menuTranslateV1, translation)).toMatchObject({ ok: true });
    expect(await getTenantAiUsage(tenantId)).toMatchObject({ spentMicros: 2_000_000, calls: 3, budgetMicros: 3_000_000 });
  });

  test("AI-04: IA desactivada para el local o para la tarea → AI_DISABLED", async () => {
    const tenantId = await tenant();
    const db = getTenantDb(tenantId);
    await db.aiSettings.create({ data: { tenantId, disabledTasks: ["menu.translate"] } });
    expect(await runAiTask(tenantId, menuTranslateV1, translation)).toEqual({ ok: false, code: "AI_DISABLED" });
    await db.aiSettings.update({ where: { tenantId }, data: { disabledTasks: [], enabled: false } });
    expect(await runAiTask(tenantId, menuTranslateV1, translation)).toEqual({ ok: false, code: "AI_DISABLED" });
  });

  test("AI-04: más de 20 llamadas en el último minuto → AI_RATE_LIMITED", async () => {
    const tenantId = await tenant();
    await spend(tenantId, 0, new Date(), 20);
    const { calls, mock } = countingMock();
    expect(await runAiTask(tenantId, menuTranslateV1, translation, { mock })).toEqual({ ok: false, code: "AI_RATE_LIMITED" });
    expect(calls).toEqual([]);
  });

  test("AI-04: al llegar al tope global se cortan las tareas no esenciales; Probar conexión sigue", async () => {
    const tenantId = await tenant();
    expect(await runAiTask(tenantId, menuTranslateV1, translation, { globalBudgetMicros: 0 })).toEqual({ ok: false, code: "AI_BUDGET_EXCEEDED" });
    expect(await runAiTask(null, systemPingV1, {}, { globalBudgetMicros: 0 })).toMatchObject({ ok: true });
  });

  test("AI-04: el aviso del 80 % al superadmin sale una sola vez por mes", async () => {
    const now = new Date("2031-05-10T10:00:00Z");
    const first = await recordGlobalBudgetWarnings([80], { now, spentMicros: 40_000_000, budgetMicros: 50_000_000 });
    eventIds.push(...first);
    const again = await recordGlobalBudgetWarnings([80], { now, spentMicros: 41_000_000, budgetMicros: 50_000_000 });
    eventIds.push(...again);
    expect(first).toHaveLength(1);
    expect(again).toEqual([]);
    const event = await getSystemDb().outboxEvent.findUnique({ where: { id: first[0]! } });
    expect(event).toMatchObject({ tenantId: null, type: "ai.global_budget" });
    expect(event?.payload).toMatchObject({ month: "2031-05", threshold: 80 });
  });
});

describe("AI-05 · trabajos en segundo plano", () => {
  test("AI-05: dos enqueueAiJob con la misma idempotencyKey crean un solo trabajo", async () => {
    const tenantId = await tenant();
    const a = await enqueueAiJob(tenantId, menuTranslateV1, translation, { idempotencyKey: "carta-1:en", progressTotal: 2 });
    const b = await enqueueAiJob(tenantId, menuTranslateV1, translation, { idempotencyKey: "carta-1:en" });
    expect(a.created).toBe(true);
    expect(b).toEqual({ jobId: a.jobId, created: false });
    expect(await getTenantDb(tenantId).aiJob.count()).toBe(1);
  });

  test("AI-05: el trabajo se ejecuta, guarda la salida y su uso lleva el jobId", async () => {
    const tenantId = await tenant();
    const { jobId } = await enqueueAiJob(tenantId, menuTranslateV1, translation, { idempotencyKey: "carta-2:en", progressTotal: 2 });
    expect(await processAiJob(jobId)).toMatchObject({ status: "DONE", skipped: false });
    expect(await processAiJob(jobId)).toMatchObject({ status: "DONE", skipped: true });

    const job = await getAiJob(tenantId, jobId);
    expect(job).toMatchObject({ status: "DONE", progressDone: 2, progressTotal: 2, error: null });
    expect(job?.output).toMatchObject({ entries: [{ key: "MenuItem:1" }, { key: "MenuItem:2" }] });
    expect(await getTenantDb(tenantId).aiUsage.findMany({ select: { jobId: true } })).toEqual([{ jobId }]);
  });

  test("AI-05: un fallo pasajero se reintenta con espera y a los 3 intentos queda FAILED", async () => {
    const tenantId = await tenant();
    const { jobId } = await enqueueAiJob(tenantId, menuTranslateV1, translation, { idempotencyKey: "carta-3:en" });
    const failing = {
      mock: () => {
        throw new Error("Overloaded");
      },
    };
    let now = new Date();
    expect(await processAiJob(jobId, { now: () => now, ...failing })).toMatchObject({ status: "PENDING" });
    let job = await getTenantDb(tenantId).aiJob.findUniqueOrThrow({ where: { id: jobId } });
    expect(job).toMatchObject({ status: "PENDING", attempts: 1, error: "AI_PROVIDER_ERROR" });
    expect(job.nextAttemptAt.getTime() - now.getTime()).toBe(60_000);

    // Antes de su hora no se toca.
    expect(await processAiJob(jobId, { now: () => now, ...failing })).toMatchObject({ skipped: true });

    now = new Date(now.getTime() + 2 * 60_000);
    await processDueAiJobs({ now: () => now, ...failing });
    now = new Date(now.getTime() + 6 * 60_000);
    await processDueAiJobs({ now: () => now, ...failing });
    job = await getTenantDb(tenantId).aiJob.findUniqueOrThrow({ where: { id: jobId } });
    expect(job).toMatchObject({ status: "FAILED", attempts: 3, error: "AI_PROVIDER_ERROR" });
    expect(job.finishedAt).not.toBeNull();
  });

  test("AI-05: un trabajo que se quedó a medias (proceso muerto) se recupera al caducar la reserva", async () => {
    const tenantId = await tenant();
    const { jobId } = await enqueueAiJob(tenantId, menuTranslateV1, translation, { idempotencyKey: "carta-4:en" });
    const past = new Date(Date.now() - 60_000);
    await getTenantDb(tenantId).aiJob.update({ where: { id: jobId }, data: { status: "RUNNING", attempts: 1, nextAttemptAt: past } });
    const result = await processDueAiJobs();
    expect(result.done).toBeGreaterThanOrEqual(1);
    expect(await getAiJob(tenantId, jobId)).toMatchObject({ status: "DONE" });
  });

  test("AI-05: sin presupuesto el trabajo falla sin reintentos", async () => {
    const tenantId = await tenant();
    await spend(tenantId, 2_000_000);
    const { jobId } = await enqueueAiJob(tenantId, menuTranslateV1, translation, { idempotencyKey: "carta-5:en" });
    expect(await processAiJob(jobId)).toMatchObject({ status: "FAILED" });
    expect(await getAiJob(tenantId, jobId)).toMatchObject({ status: "FAILED", error: "AI_BUDGET_EXCEEDED" });
  });
});

describe("Aislamiento", () => {
  test("PLT §9: el local B no ve el uso ni los trabajos del local A", async () => {
    const a = await tenant();
    const b = await tenant();
    await spend(a, 700_000);
    const { jobId } = await enqueueAiJob(a, menuTranslateV1, translation, { idempotencyKey: "aislado" });

    expect(await getAiJob(b, jobId)).toBeNull();
    expect(await getTenantAiUsage(b)).toMatchObject({ spentMicros: 0, calls: 0 });
    expect(await getTenantAiUsage(a)).toMatchObject({ spentMicros: 700_000, calls: 1 });
    expect(await getTenantDb(b).aiJob.count()).toBe(0);
    expect(await getTenantDb(b).aiUsage.count()).toBe(0);
  });
});
