/** Módulos que se venden (00-plataforma §6), en el orden en que se muestran. */
export const MODULE_KEYS = ["SITE", "MENU", "RESERVATIONS"] as const;
export type ModuleKeyValue = (typeof MODULE_KEYS)[number];

export type ModuleStatusValue = "ACTIVE" | "PAST_DUE" | "SUSPENDED" | "CANCELED";

/** 00-plataforma §6: se puede usar si está activo o en periodo de gracia (`PAST_DUE`). */
export function moduleGivesAccess(status: ModuleStatusValue): boolean {
  return status === "ACTIVE" || status === "PAST_DUE";
}

/** Módulos que el local puede usar, en el orden de MODULE_KEYS. */
export function usableModules(rows: readonly { module: ModuleKeyValue; status: ModuleStatusValue }[]): ModuleKeyValue[] {
  const usable = new Set(rows.filter((row) => moduleGivesAccess(row.status)).map((row) => row.module));
  return MODULE_KEYS.filter((key) => usable.has(key));
}
