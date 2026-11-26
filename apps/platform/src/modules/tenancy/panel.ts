import { notFound } from "next/navigation";
import { cache } from "react";
import { requireTenant, type TenantSession } from "@/modules/identity/session";
import { getTenantPanelData, type TenantPanelData } from "./application/panel-data";
import type { ModuleKeyValue } from "./domain/modules";
import { visibleSections, type PanelSection } from "./domain/panel-sections";

export interface PanelContext extends TenantSession, TenantPanelData {
  sections: PanelSection[];
}

/** Todo lo del panel de esta petición: sesión, local activo, módulos y menú (una vez por petición). */
export const requirePanel = cache(async (): Promise<PanelContext> => {
  const session = await requireTenant();
  const data = await getTenantPanelData(session.membership.tenantId);
  return { ...session, ...data, sections: visibleSections(data.modules, session.membership.role) };
});

/** Fallo de programación o acceso indebido: una acción de un módulo que el local no tiene. */
export class ModuleNotActiveError extends Error {
  override name = "ModuleNotActiveError";
}

/**
 * CLAUDE.md §6.4: para Server Actions de un módulo. Devuelve el contexto si el local lo tiene
 * (activo o en periodo de gracia); si no, lanza. Las pantallas usan `<ModuleGate>`, que ofrece el módulo.
 */
export async function requireModule(module: ModuleKeyValue): Promise<PanelContext> {
  const panel = await requirePanel();
  if (!panel.modules.includes(module)) throw new ModuleNotActiveError(`Módulo ${module} no activo`);
  return panel;
}

/** Para pantallas y acciones solo del responsable (Ajustes: datos del local, equipo, plan). */
export async function requireOwner(): Promise<PanelContext> {
  const panel = await requirePanel();
  if (panel.membership.role !== "OWNER") notFound();
  return panel;
}
