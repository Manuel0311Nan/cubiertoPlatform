-- PLT-02: local activo del panel en la sesión. Columna nueva y opcional: compatible hacia atrás.

-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "activeTenantId" TEXT;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_activeTenantId_fkey" FOREIGN KEY ("activeTenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
