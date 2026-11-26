-- PLT-03: quitar el acceso y cancelar invitaciones sin borrar filas (CLAUDE.md §11). Columnas
-- nuevas y opcionales: compatible hacia atrás.

-- AlterTable
ALTER TABLE "Invitation" ADD COLUMN     "revokedAt" TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "Membership" ADD COLUMN     "deletedAt" TIMESTAMPTZ(3);
