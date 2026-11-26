import type { Prisma, PrismaClient } from "./generated/prisma/client.ts";
import { getSystemDb } from "./client.ts";

/** Rol de PostgreSQL sin BYPASSRLS con el que corren las consultas de un tenant (migración `*_rls`). */
export const APP_DB_ROLE = "cubierto_app";

/**
 * Modelos con `tenantId`. Cada uno tiene RLS en su migración; el test de cobertura de RLS
 * falla si una tabla con `tenantId` no está aquí o no tiene política.
 */
export const TENANT_SCOPED_MODELS = [
  "Domain",
  "TenantModule",
  "Subscription",
  "Membership",
  "Invitation",
  "Venue",
  "Table",
  "FloorZone",
  "ClosedDate",
  "OutboxEvent",
  "AuditLog",
  "AiSettings",
  "AiUsage",
  "AiJob",
] as const satisfies readonly Prisma.ModelName[];

export type TenantScopedModel = (typeof TENANT_SCOPED_MODELS)[number];

const tenantScopedModels: ReadonlySet<string> = new Set(TENANT_SCOPED_MODELS);

/** Uso indebido de getTenantDb: es un fallo de programación, no un error de negocio. */
export class TenantScopeError extends Error {
  override name = "TenantScopeError";
}

type Args = Record<string, unknown>;

const WHERE_OPERATIONS = new Set([
  "findUnique",
  "findUniqueOrThrow",
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "count",
  "aggregate",
  "groupBy",
  "update",
  "updateMany",
  "updateManyAndReturn",
  "delete",
  "deleteMany",
  "upsert",
]);

const CREATE_OPERATIONS = new Set(["create", "createMany", "createManyAndReturn"]);
const UPDATE_OPERATIONS = new Set(["update", "updateMany", "updateManyAndReturn"]);

function isRecord(value: unknown): value is Args {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertNoOtherTenant(value: unknown, tenantId: string, where: string): void {
  if (value !== undefined && value !== tenantId) {
    throw new TenantScopeError(`${where}: tenantId distinto del tenant activo`);
  }
}

function scopeCreateData(data: unknown, tenantId: string): unknown {
  if (Array.isArray(data)) return data.map((item) => scopeCreateData(item, tenantId));
  if (!isRecord(data)) throw new TenantScopeError("create: data no válido");
  if ("tenant" in data) {
    throw new TenantScopeError("create: no uses la relación `tenant`; getTenantDb pone el tenantId");
  }
  assertNoOtherTenant(data.tenantId, tenantId, "create");
  return { ...data, tenantId };
}

function assertUpdateData(data: unknown, tenantId: string): void {
  if (!isRecord(data)) return;
  if ("tenant" in data) throw new TenantScopeError("update: no se puede cambiar la relación `tenant`");
  assertNoOtherTenant(data.tenantId, tenantId, "update");
}

/**
 * Primera barrera (CLAUDE.md §6.1): añade `tenantId` al `where` de toda lectura, cambio y borrado,
 * y al `data` de toda creación. Un `tenantId` distinto del activo es un error.
 * Las relaciones se escriben con sus claves (`venueId`), no con escrituras anidadas.
 */
export function scopeArgs(operation: string, args: unknown, tenantId: string): Args {
  const scoped: Args = isRecord(args) ? { ...args } : {};

  if (WHERE_OPERATIONS.has(operation)) {
    const where = isRecord(scoped.where) ? scoped.where : {};
    assertNoOtherTenant(where.tenantId, tenantId, operation);
    scoped.where = { ...where, tenantId };
  }
  if (CREATE_OPERATIONS.has(operation)) {
    scoped.data = scopeCreateData(scoped.data, tenantId);
  }
  if (UPDATE_OPERATIONS.has(operation)) {
    assertUpdateData(scoped.data, tenantId);
  }
  if (operation === "upsert") {
    scoped.create = scopeCreateData(scoped.create, tenantId);
    assertUpdateData(scoped.update, tenantId);
  }
  return scoped;
}

function assertTenantId(tenantId: string): void {
  if (typeof tenantId !== "string" || tenantId.trim() === "") {
    throw new TenantScopeError("getTenantDb: falta el tenantId");
  }
}

function assertTenantScopedModel(model: string): void {
  if (!tenantScopedModels.has(model)) {
    throw new TenantScopeError(`El modelo ${model} no es de un tenant: usa getSystemDb()`);
  }
}

/** Segunda barrera: fija el tenant y el rol sin BYPASSRLS para el resto de la transacción. */
function enterTenantContext(client: Pick<PrismaClient, "$executeRaw">, tenantId: string) {
  return client.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true), set_config('role', ${APP_DB_ROLE}, true)`;
}

function buildArgsScopedClient(base: PrismaClient, tenantId: string) {
  return base.$extends({
    name: "tenant-args",
    query: {
      $allModels: {
        $allOperations({ model, operation, args, query }) {
          assertTenantScopedModel(model);
          return query(scopeArgs(operation, args, tenantId));
        },
      },
    },
  });
}

type ArgsScopedClient = ReturnType<typeof buildArgsScopedClient>;

/** Cliente de transacción de un tenant: mismos modelos, con tenant y RLS fijados. */
export type TenantTransaction = Parameters<Parameters<ArgsScopedClient["$transaction"]>[0]>[0];

function buildTenantClient(base: PrismaClient, tenantId: string) {
  const argsScoped = buildArgsScopedClient(base, tenantId);

  return argsScoped.$extends({
    name: "tenant-rls",
    query: {
      $allModels: {
        async $allOperations({ args, query }) {
          const [, result] = await base.$transaction([enterTenantContext(base, tenantId), query(args)]);
          return result;
        },
      },
      async $queryRaw({ args, query }) {
        const [, result] = await base.$transaction([enterTenantContext(base, tenantId), query(args)]);
        return result;
      },
      async $executeRaw({ args, query }) {
        const [, result] = await base.$transaction([enterTenantContext(base, tenantId), query(args)]);
        return result;
      },
      $queryRawUnsafe() {
        throw new TenantScopeError("$queryRawUnsafe no está permitido en getTenantDb");
      },
      $executeRawUnsafe() {
        throw new TenantScopeError("$executeRawUnsafe no está permitido en getTenantDb");
      },
    },
    client: {
      /**
       * Transacción interactiva del tenant (p. ej. cambio de datos + `OutboxEvent`, CLAUDE.md §6.5).
       * No llames a servicios externos dentro (§11).
       */
      $tenantTransaction<T>(
        fn: (tx: TenantTransaction) => Promise<T>,
        options?: { maxWait?: number; timeout?: number },
      ): Promise<T> {
        return argsScoped.$transaction(async (tx) => {
          await enterTenantContext(tx, tenantId);
          return fn(tx);
        }, options);
      },
    },
  });
}

type TenantClient = ReturnType<typeof buildTenantClient>;

/**
 * Acceso a los datos de un tenant (CLAUDE.md §6.1). Cada operación corre en una transacción con
 * `app.tenant_id` y el rol `cubierto_app` (RLS), y con `tenantId` añadido a sus argumentos.
 * Para varias operaciones atómicas, `$tenantTransaction`; el `$transaction` normal no está disponible.
 *
 * El `tenantId` sale de la sesión (panel) o del middleware (público), nunca del navegador.
 */
export type TenantDb = Omit<
  TenantClient,
  "$transaction" | "$extends" | "$connect" | "$disconnect" | "$on" | "$queryRawUnsafe" | "$executeRawUnsafe"
>;

export function getTenantDb(tenantId: string): TenantDb {
  assertTenantId(tenantId);
  return buildTenantClient(getSystemDb(), tenantId);
}
