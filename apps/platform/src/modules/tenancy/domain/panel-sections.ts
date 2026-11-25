import type { ModuleKeyValue } from "./modules";

export type PanelRole = "OWNER" | "STAFF";

export type PanelSectionKey = "today" | "reservations" | "floor" | "menu" | "site" | "messages" | "customers" | "settings";

export interface PanelSection {
  key: PanelSectionKey;
  path: string;
  /** Módulo que hace falta (null = siempre). Sin él, la sección no sale en el menú y su página ofrece el módulo (CLAUDE.md §6.4). */
  module: ModuleKeyValue | null;
  /** Solo OWNER: STAFF no ve facturación ni usuarios (00-plataforma §3), que están en Ajustes. */
  ownerOnly: boolean;
}

/** Apartados del panel del local, en el orden del menú (vistas D6 y M11). */
export const PANEL_SECTIONS: readonly PanelSection[] = [
  { key: "today", path: "/panel", module: null, ownerOnly: false },
  { key: "reservations", path: "/panel/reservas", module: "RESERVATIONS", ownerOnly: false },
  { key: "floor", path: "/panel/sala", module: "RESERVATIONS", ownerOnly: false },
  { key: "menu", path: "/panel/carta", module: "MENU", ownerOnly: false },
  { key: "site", path: "/panel/web", module: "SITE", ownerOnly: false },
  { key: "messages", path: "/panel/mensajes", module: "SITE", ownerOnly: false },
  { key: "customers", path: "/panel/clientes", module: "RESERVATIONS", ownerOnly: false },
  { key: "settings", path: "/panel/ajustes", module: null, ownerOnly: true },
];

export function sectionByKey(key: PanelSectionKey): PanelSection {
  return PANEL_SECTIONS.find((section) => section.key === key)!;
}

export function canSeeSection(section: PanelSection, role: PanelRole): boolean {
  return !section.ownerOnly || role === "OWNER";
}

/** Apartados del menú para ese local y esa persona: los de sus módulos y su papel. */
export function visibleSections(modules: readonly ModuleKeyValue[], role: PanelRole): PanelSection[] {
  return PANEL_SECTIONS.filter((section) => canSeeSection(section, role) && (section.module === null || modules.includes(section.module)));
}

/** Barra inferior del móvil (M11): "Hoy", hasta tres apartados de sus módulos y "Más" con el resto. */
export const MOBILE_TAB_CANDIDATES: readonly PanelSectionKey[] = ["reservations", "floor", "menu", "site"];

export function mobileTabs(sections: readonly PanelSection[]): PanelSection[] {
  const keys = new Set(sections.map((section) => section.key));
  const modules = MOBILE_TAB_CANDIDATES.filter((key) => keys.has(key)).slice(0, 3);
  return [sectionByKey("today"), ...modules.map(sectionByKey)];
}

/** Apartado al que pertenece una ruta del panel (el más largo que encaje), para marcarlo en el menú. */
export function currentSectionKey(pathname: string): PanelSectionKey | "more" | null {
  if (pathname === "/panel/mas") return "more";
  const matches = PANEL_SECTIONS.filter((s) => pathname === s.path || (s.path !== "/panel" && pathname.startsWith(`${s.path}/`)));
  return matches.sort((a, b) => b.path.length - a.path.length)[0]?.key ?? null;
}
