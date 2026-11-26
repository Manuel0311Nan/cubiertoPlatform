-- 04-ia.md: base del servicio de IA (AI-03, AI-04, AI-05).

-- CreateEnum
CREATE TYPE "AiJobStatus" AS ENUM ('PENDING', 'RUNNING', 'DONE', 'FAILED');

-- CreateTable
CREATE TABLE "AiSettings" (
    "tenantId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "monthlyBudgetMicros" INTEGER NOT NULL DEFAULT 2000000,
    "disabledTasks" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "AiSettings_pkey" PRIMARY KEY ("tenantId")
);

-- CreateTable
CREATE TABLE "AiUsage" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "taskId" TEXT NOT NULL,
    "taskVersion" INTEGER NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "inputTokens" INTEGER NOT NULL,
    "outputTokens" INTEGER NOT NULL,
    "costMicros" INTEGER NOT NULL,
    "latencyMs" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "jobId" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiJob" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "taskVersion" INTEGER NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "input" JSONB NOT NULL,
    "output" JSONB,
    "status" "AiJobStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "progressDone" INTEGER NOT NULL DEFAULT 0,
    "progressTotal" INTEGER,
    "error" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMPTZ(3),

    CONSTRAINT "AiJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiUsage_tenantId_createdAt_idx" ON "AiUsage"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "AiUsage_taskId_createdAt_idx" ON "AiUsage"("taskId", "createdAt");

-- CreateIndex
CREATE INDEX "AiUsage_createdAt_idx" ON "AiUsage"("createdAt");

-- CreateIndex
CREATE INDEX "AiJob_status_nextAttemptAt_idx" ON "AiJob"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "AiJob_tenantId_createdAt_idx" ON "AiJob"("tenantId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AiJob_tenantId_idempotencyKey_key" ON "AiJob"("tenantId", "idempotencyKey");

-- AddForeignKey
ALTER TABLE "AiSettings" ADD CONSTRAINT "AiSettings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiUsage" ADD CONSTRAINT "AiUsage_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiJob" ADD CONSTRAINT "AiJob_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RLS (CLAUDE.md §6.1): misma política que el resto de tablas de un tenant (migración *_rls).
-- El uso interno (AiUsage.tenantId null) solo lo ve el superadmin con systemDb.
GRANT SELECT, INSERT, UPDATE, DELETE ON "AiSettings", "AiUsage", "AiJob" TO cubierto_app;
ALTER TABLE "AiSettings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AiUsage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AiJob" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "AiSettings" TO cubierto_app
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
CREATE POLICY tenant_isolation ON "AiUsage" TO cubierto_app
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
CREATE POLICY tenant_isolation ON "AiJob" TO cubierto_app
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
