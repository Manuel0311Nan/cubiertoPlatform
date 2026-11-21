import { describe, expect, test } from "vitest";
import { scopeArgs, TenantScopeError } from "./tenant.ts";

const T = "tenant_a";

describe("PLT §9 · scopeArgs (primera barrera, sin base de datos)", () => {
  test("añade tenantId al where de lecturas, cambios y borrados", () => {
    for (const op of ["findMany", "findFirst", "findUnique", "count", "update", "updateMany", "delete", "deleteMany"]) {
      expect(scopeArgs(op, { where: { id: "x" } }, T).where).toEqual({ id: "x", tenantId: T });
    }
  });

  test("añade where aunque la consulta no traiga ninguno", () => {
    expect(scopeArgs("findMany", undefined, T)).toEqual({ where: { tenantId: T } });
  });

  test("pone tenantId en create y en cada fila de createMany", () => {
    expect(scopeArgs("create", { data: { name: "x" } }, T).data).toEqual({ name: "x", tenantId: T });
    expect(scopeArgs("createMany", { data: [{ name: "x" }, { name: "y" }] }, T).data).toEqual([
      { name: "x", tenantId: T },
      { name: "y", tenantId: T },
    ]);
  });

  test("upsert: where y create con tenantId", () => {
    const args = scopeArgs("upsert", { where: { id: "x" }, create: { name: "x" }, update: { name: "y" } }, T);
    expect(args).toEqual({ where: { id: "x", tenantId: T }, create: { name: "x", tenantId: T }, update: { name: "y" } });
  });

  test("un tenantId distinto del activo es un error en where, create y update", () => {
    expect(() => scopeArgs("findMany", { where: { tenantId: "otro" } }, T)).toThrow(TenantScopeError);
    expect(() => scopeArgs("create", { data: { tenantId: "otro" } }, T)).toThrow(TenantScopeError);
    expect(() => scopeArgs("update", { where: { id: "x" }, data: { tenantId: "otro" } }, T)).toThrow(TenantScopeError);
    expect(() => scopeArgs("upsert", { where: { id: "x" }, create: {}, update: { tenantId: "otro" } }, T)).toThrow(
      TenantScopeError,
    );
  });

  test("el mismo tenantId explícito se acepta", () => {
    expect(scopeArgs("create", { data: { tenantId: T, name: "x" } }, T).data).toEqual({ tenantId: T, name: "x" });
  });

  test("no deja usar la relación tenant en escrituras", () => {
    expect(() => scopeArgs("create", { data: { tenant: { connect: { id: "otro" } } } }, T)).toThrow(TenantScopeError);
    expect(() => scopeArgs("update", { where: { id: "x" }, data: { tenant: { connect: { id: "otro" } } } }, T)).toThrow(
      TenantScopeError,
    );
  });
});
