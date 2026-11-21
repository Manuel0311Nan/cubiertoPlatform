-- RLS: segunda barrera del aislamiento entre tenants (CLAUDE.md §6.1, 00-plataforma §9).
--
-- `cubierto_app` es el rol con el que corren las consultas de getTenantDb: no puede iniciar
-- sesión ni saltarse RLS. El rol que conecta (en Neon, el dueño de las tablas) entra en él con
-- `set_config('role', 'cubierto_app', true)` al empezar cada transacción, junto con
-- `app.tenant_id`. Fuera de esas transacciones (systemDb: Tenant, User, superadmin, procesos
-- programados) las consultas corren como dueño de las tablas, al que RLS no aplica.
--
-- Una tabla nueva con `tenantId` necesita en su migración: GRANT a cubierto_app, ENABLE ROW
-- LEVEL SECURITY y la política tenant_isolation. El test de cobertura de RLS lo comprueba.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'cubierto_app') THEN
    CREATE ROLE cubierto_app NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
  END IF;
END
$$;

-- El rol que ejecuta las migraciones (y conecta la app) tiene que poder entrar en cubierto_app.
GRANT cubierto_app TO CURRENT_USER;

GRANT USAGE ON SCHEMA public TO cubierto_app;

-- Domain
GRANT SELECT, INSERT, UPDATE, DELETE ON "Domain" TO cubierto_app;
ALTER TABLE "Domain" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Domain" TO cubierto_app
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

-- TenantModule
GRANT SELECT, INSERT, UPDATE, DELETE ON "TenantModule" TO cubierto_app;
ALTER TABLE "TenantModule" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "TenantModule" TO cubierto_app
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

-- Subscription
GRANT SELECT, INSERT, UPDATE, DELETE ON "Subscription" TO cubierto_app;
ALTER TABLE "Subscription" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Subscription" TO cubierto_app
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

-- Membership
GRANT SELECT, INSERT, UPDATE, DELETE ON "Membership" TO cubierto_app;
ALTER TABLE "Membership" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Membership" TO cubierto_app
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

-- Invitation
GRANT SELECT, INSERT, UPDATE, DELETE ON "Invitation" TO cubierto_app;
ALTER TABLE "Invitation" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Invitation" TO cubierto_app
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

-- Venue
GRANT SELECT, INSERT, UPDATE, DELETE ON "Venue" TO cubierto_app;
ALTER TABLE "Venue" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Venue" TO cubierto_app
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

-- Table
GRANT SELECT, INSERT, UPDATE, DELETE ON "Table" TO cubierto_app;
ALTER TABLE "Table" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Table" TO cubierto_app
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

-- FloorZone
GRANT SELECT, INSERT, UPDATE, DELETE ON "FloorZone" TO cubierto_app;
ALTER TABLE "FloorZone" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "FloorZone" TO cubierto_app
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

-- OutboxEvent (los eventos de plataforma, con tenantId null, solo los ve systemDb)
GRANT SELECT, INSERT, UPDATE, DELETE ON "OutboxEvent" TO cubierto_app;
ALTER TABLE "OutboxEvent" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "OutboxEvent" TO cubierto_app
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

-- AuditLog
GRANT SELECT, INSERT, UPDATE, DELETE ON "AuditLog" TO cubierto_app;
ALTER TABLE "AuditLog" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "AuditLog" TO cubierto_app
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
