import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { disconnectDb, getSystemDb } from "../src/client.ts";
import { APP_DB_ROLE, TENANT_SCOPED_MODELS } from "../src/tenant.ts";
import { requireTestDatabase } from "./helpers.ts";

beforeAll(() => requireTestDatabase());
afterAll(() => disconnectDb());

describe("PLT §9 · cobertura de RLS", () => {
  test("PLT §9: toda tabla con tenantId tiene RLS, política para cubierto_app y está en TENANT_SCOPED_MODELS", async () => {
    const rows = await getSystemDb().$queryRaw<{ table: string; rls: boolean; policies: number }[]>`
      SELECT c.relname AS "table",
             c.relrowsecurity AS rls,
             (SELECT count(*)::int FROM pg_policies p
               WHERE p.schemaname = 'public' AND p.tablename = c.relname
                 AND ${APP_DB_ROLE} = ANY (p.roles)) AS policies
        FROM pg_class c
        JOIN information_schema.columns col
          ON col.table_schema = 'public' AND col.table_name = c.relname AND col.column_name = 'tenantId'
       WHERE c.relnamespace = 'public'::regnamespace AND c.relkind = 'r'
       ORDER BY 1`;

    expect(rows.map((r) => r.table).sort()).toEqual([...TENANT_SCOPED_MODELS].sort());
    for (const row of rows) {
      expect(row, `RLS en ${row.table}`).toMatchObject({ rls: true });
      expect(row.policies, `política de ${row.table}`).toBeGreaterThan(0);
    }
  });

  test("PLT §9: el rol de la app no puede saltarse RLS ni iniciar sesión", async () => {
    const [role] = await getSystemDb().$queryRaw<{ bypass: boolean; superuser: boolean; login: boolean }[]>`
      SELECT rolbypassrls AS bypass, rolsuper AS superuser, rolcanlogin AS login
        FROM pg_roles WHERE rolname = ${APP_DB_ROLE}`;
    expect(role).toEqual({ bypass: false, superuser: false, login: false });
  });
});
