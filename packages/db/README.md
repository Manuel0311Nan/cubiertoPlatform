# @cubierto/db

Esquema único (`prisma/schema.prisma`), migraciones, seed y los dos clientes de la plataforma.

## Qué cliente usar

| Cliente | Para qué | Cómo protege |
|---|---|---|
| `getTenantDb(tenantId)` | **Todo dato de un local** (CLAUDE.md §6.1). El `tenantId` sale de la sesión o del middleware | Añade `tenantId` a cada consulta y corre cada una con `app.tenant_id` y el rol `cubierto_app` (RLS) |
| `getTenantDb(tenantId).$tenantTransaction(fn)` | Varias operaciones atómicas del local, p. ej. cambio + `OutboxEvent` (§6.5) | Igual, para toda la transacción |
| `getSystemDb()` | Solo `Tenant`, `User`, `ProcessedWebhook`; resolver el slug; superadmin; procesos que recorren todos los locales (outbox, RGPD); leer las membresías al iniciar sesión | Ninguna: corre como dueño de las tablas |

Con `getTenantDb`, las relaciones se escriben con sus claves (`venueId`), no con escrituras anidadas, y `create` lleva el `tenantId` del tenant activo (si no coincide, `TenantScopeError`).

## Tabla nueva con datos de un local

En la misma migración: columna `tenantId` con índice que empiece por ella, `GRANT` a `cubierto_app`, `ENABLE ROW LEVEL SECURITY` y la política `tenant_isolation` (copiar de `prisma/migrations/*_rls`). Añadir el modelo a `TENANT_SCOPED_MODELS` en `src/tenant.ts`. `test/rls-coverage.test.ts` falla si falta algo.

## Comandos (desde la raíz)

```bash
pnpm db:generate         # cliente en src/generated (también lo hacen typecheck y test)
pnpm db:migrate:dev      # nueva migración en local (rama dev de Neon)
pnpm db:migrate:deploy   # aplicar migraciones (CI)
pnpm db:migrate:test     # aplicar migraciones a TEST_DATABASE_URL (antes de pnpm test)
pnpm db:seed             # 2 locales de demo + superadmin
```

Las variables (`DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `TEST_DATABASE_URL`) van en el `.env` de la raíz; ver `.env.example`.
