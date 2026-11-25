import { getTenantDb } from "@cubierto/db";
import { usableModules, type ModuleKeyValue } from "../domain/modules";

export interface TenantPanelData {
  modules: ModuleKeyValue[];
  venue: { name: string; addressLine: string | null; city: string | null; timezone: string } | null;
}

/** Lo que necesita el marco del panel de un local: sus módulos usables y su local (MVP: uno por tenant). */
export async function getTenantPanelData(tenantId: string): Promise<TenantPanelData> {
  const db = getTenantDb(tenantId);
  const [modules, venue] = await Promise.all([
    db.tenantModule.findMany({ select: { module: true, status: true } }),
    db.venue.findFirst({ orderBy: { createdAt: "asc" }, select: { name: true, addressLine: true, city: true, timezone: true } }),
  ]);
  return { modules: usableModules(modules), venue };
}
