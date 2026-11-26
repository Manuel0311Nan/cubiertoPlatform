import type { AiConfig, AiTask, MockCall } from "@cubierto/ai";
import { getSystemDb, getTenantDb, Prisma, type AiJob, type AiJobStatus } from "@cubierto/db";
import { AI_JOB_LEASE_MS, decideAfterJobFailure } from "../domain/jobs";
import { findAiTask } from "../tasks";
import { runAiTask } from "./run-ai-task";

/**
 * AI-05: tareas largas en segundo plano. `enqueueAiJob` guarda el trabajo; quien lo encola lo
 * arranca justo después con `after(() => processAiJob(jobId))` (o Vercel Workflows si no cabe en
 * el tiempo de una función). Lo que falle se reintenta en `processDueAiJobs`, sin cron cada minuto
 * (el barrido del panel y el cron diario, PLT-08). Máximo 3 intentos.
 */

export interface EnqueueAiJobOptions {
  /** Evita duplicar el trabajo si se pulsa dos veces (p. ej. `menu.translate:<menuId>:en:<hash>`). */
  idempotencyKey: string;
  /** Partes que tendrá el trabajo, para el progreso del panel ("34 de 80"). */
  progressTotal?: number;
}

export async function enqueueAiJob<I, O>(
  tenantId: string,
  task: AiTask<I, O>,
  input: I,
  options: EnqueueAiJobOptions,
): Promise<{ jobId: string; created: boolean }> {
  if (findAiTask(task.id) !== (task as unknown)) throw new Error(`La tarea ${task.id} no está registrada en modules/ai/tasks`);
  const parsed = task.input.parse(input);
  const db = getTenantDb(tenantId);
  try {
    const job = await db.aiJob.create({
      data: {
        tenantId,
        taskId: task.id,
        taskVersion: task.version,
        idempotencyKey: options.idempotencyKey,
        input: parsed as Prisma.InputJsonValue,
        progressTotal: options.progressTotal ?? null,
        // Reloj de la app, el mismo con el que se reserva el trabajo justo después.
        nextAttemptAt: new Date(),
      },
      select: { id: true },
    });
    return { jobId: job.id, created: true };
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;
    const existing = await db.aiJob.findUniqueOrThrow({
      where: { tenantId_idempotencyKey: { tenantId, idempotencyKey: options.idempotencyKey } },
      select: { id: true },
    });
    return { jobId: existing.id, created: false };
  }
}

export interface AiJobView {
  id: string;
  taskId: string;
  status: AiJobStatus;
  progressDone: number;
  progressTotal: number | null;
  output: unknown;
  error: string | null;
  createdAt: Date;
  finishedAt: Date | null;
}

/** Estado y progreso de un trabajo del local, para el panel. null si no es de este local. */
export async function getAiJob(tenantId: string, jobId: string): Promise<AiJobView | null> {
  return getTenantDb(tenantId).aiJob.findFirst({
    where: { id: jobId },
    select: {
      id: true,
      taskId: true,
      status: true,
      progressDone: true,
      progressTotal: true,
      output: true,
      error: true,
      createdAt: true,
      finishedAt: true,
    },
  });
}

/** Para trabajos con partes (MENU-07): el panel muestra "Traduciendo `done` de `total`". */
export async function reportAiJobProgress(tenantId: string, jobId: string, done: number, total?: number) {
  await getTenantDb(tenantId).aiJob.updateMany({
    where: { id: jobId },
    data: { progressDone: done, ...(total === undefined ? {} : { progressTotal: total }) },
  });
}

export interface ProcessAiJobDeps<I = unknown> {
  now: () => Date;
  config?: AiConfig;
  mock?: (call: MockCall<I>) => string | Promise<string>;
}

const defaultDeps = (): ProcessAiJobDeps => ({ now: () => new Date() });

/**
 * Reserva el trabajo para este proceso si le toca: pendiente con su intento ya vencido, o en marcha
 * con la reserva caducada (el proceso anterior murió). systemDb: el barrido recorre todos los locales.
 */
async function claim(job: Pick<AiJob, "id" | "status" | "nextAttemptAt">, now: Date): Promise<AiJob | null> {
  const db = getSystemDb();
  const claimed = await db.aiJob.updateMany({
    where: { id: job.id, status: job.status, nextAttemptAt: job.nextAttemptAt, AND: [{ nextAttemptAt: { lte: now } }] },
    data: { status: "RUNNING", attempts: { increment: 1 }, nextAttemptAt: new Date(now.getTime() + AI_JOB_LEASE_MS) },
  });
  if (claimed.count !== 1) return null;
  return db.aiJob.findUnique({ where: { id: job.id } });
}

async function runClaimed(job: AiJob, deps: ProcessAiJobDeps): Promise<AiJobStatus> {
  const db = getTenantDb(job.tenantId);
  const task = findAiTask(job.taskId);
  if (!task) {
    await db.aiJob.update({ where: { id: job.id }, data: { status: "FAILED", error: "UNKNOWN_TASK", finishedAt: deps.now() } });
    return "FAILED";
  }
  // La entrada ya no cumple el schema de la tarea (p. ej. cambió de versión): no se reintenta.
  const input = task.input.safeParse(job.input);
  if (!input.success) {
    await db.aiJob.update({ where: { id: job.id }, data: { status: "FAILED", error: "INVALID_INPUT", finishedAt: deps.now() } });
    return "FAILED";
  }
  const result = await runAiTask(job.tenantId, task, input.data, { jobId: job.id, now: deps.now, config: deps.config, mock: deps.mock });
  const now = deps.now();
  if (result.ok) {
    await db.aiJob.update({
      where: { id: job.id },
      data: { status: "DONE", output: result.data as Prisma.InputJsonValue, error: null, finishedAt: now, progressDone: job.progressTotal ?? job.progressDone },
    });
    return "DONE";
  }
  const decision = decideAfterJobFailure(result.code, job.attempts, now);
  if (decision.status === "FAILED") {
    await db.aiJob.update({ where: { id: job.id }, data: { status: "FAILED", error: result.code, finishedAt: now } });
    return "FAILED";
  }
  await db.aiJob.update({ where: { id: job.id }, data: { status: "PENDING", error: result.code, nextAttemptAt: decision.nextAttemptAt } });
  return "PENDING";
}

/** Ejecuta ahora un trabajo recién encolado (desde `after()`). Si no le toca o ya lo tiene otro, no hace nada. */
export async function processAiJob(jobId: string, deps: ProcessAiJobDeps = defaultDeps()) {
  const job = await getSystemDb().aiJob.findUnique({ where: { id: jobId }, select: { id: true, status: true, nextAttemptAt: true } });
  if (!job || (job.status !== "PENDING" && job.status !== "RUNNING")) return { jobId, status: job?.status ?? null, skipped: true };
  const claimed = await claim(job, deps.now());
  if (!claimed) return { jobId, status: job.status, skipped: true };
  return { jobId, status: await runClaimed(claimed, deps), skipped: false };
}

/** AI-05: barrido de los trabajos que tocan (reintentos y los que quedaron a medias). */
export async function processDueAiJobs(deps: ProcessAiJobDeps = defaultDeps(), limit = 5) {
  const now = deps.now();
  const due = await getSystemDb().aiJob.findMany({
    where: { status: { in: ["PENDING", "RUNNING"] }, nextAttemptAt: { lte: now } },
    orderBy: { nextAttemptAt: "asc" },
    take: limit,
    select: { id: true, status: true, nextAttemptAt: true },
  });
  const result = { done: 0, retrying: 0, failed: 0, skipped: 0 };
  for (const job of due) {
    const claimed = await claim(job, now);
    if (!claimed) {
      result.skipped += 1;
      continue;
    }
    const status = await runClaimed(claimed, deps);
    if (status === "DONE") result.done += 1;
    else if (status === "FAILED") result.failed += 1;
    else result.retrying += 1;
  }
  return result;
}
