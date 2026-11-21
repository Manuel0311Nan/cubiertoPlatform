import { isUsableSlug } from "./slug";

/**
 * Contexto de una petición según su host y su ruta (`specs/modulos/00-plataforma.md` §5).
 * Función pura: el middleware la usa para decidir qué servir. El tenant público sale del
 * `slug` que devuelve aquí, nunca de nada que mande el navegador (CLAUDE.md §6.3).
 */
export type RequestContext =
  /** `app.<dominio>/panel/**`: el tenant sale de la membresía activa de la sesión. */
  | { kind: "panel" }
  /** `app.<dominio>/admin/**`: superadmin, sin tenant. */
  | { kind: "admin" }
  /** `app.<dominio>/c/<slug>/**`: carta pública. */
  | { kind: "public-menu"; slug: string }
  /** `app.<dominio>/r/<slug>/**`: reservas públicas. */
  | { kind: "public-reservations"; slug: string }
  /** `app.<dominio>/embed.js`: script del widget de reservas. */
  | { kind: "reservations-widget" }
  /** `app.<dominio>/api/public/v1/**`: API pública (WEB-13, FORM-07). */
  | { kind: "public-api" }
  /** Resto de `app.<dominio>`: entrada, auth, webhooks, cron, manifest… */
  | { kind: "platform" }
  /** `<slug>.<dominio>/**`: página mínima del local o 301 a su web (WEB-16). */
  | { kind: "venue-site"; slug: string }
  /** `<slug>.<dominio>/panel`: 302 a `app.<dominio>/panel` (PLT-11). */
  | { kind: "venue-panel-redirect"; slug: string }
  /** Host o ruta que la plataforma no atiende: 404 genérica, sin nombres de otros clientes. */
  | { kind: "not-found" };

export interface ResolveRequestInput {
  /** Cabecera `Host` tal cual llega (puede traer puerto). */
  host: string | null;
  pathname: string;
  /** `PLATFORM_DOMAIN`: `cubierto.site` en producción, `localhost` en local. */
  platformDomain: string;
  /** Hosts que se tratan como `app.` además de él, p. ej. la URL de Vercel de una preview. */
  extraAppHosts?: readonly string[];
}

export const APP_SUBDOMAIN = "app";

export function normalizeHost(host: string): string {
  return host.trim().toLowerCase().replace(/:\d+$/, "").replace(/\.$/, "");
}

function isPathUnder(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

const PUBLIC_SLUG_ROUTE = /^\/(c|r)\/([^/]+)(?:\/.*)?$/;

function resolveAppPath(pathname: string): RequestContext {
  if (isPathUnder(pathname, "/panel")) return { kind: "panel" };
  if (isPathUnder(pathname, "/admin")) return { kind: "admin" };
  if (pathname === "/embed.js") return { kind: "reservations-widget" };
  if (isPathUnder(pathname, "/api/public/v1")) return { kind: "public-api" };

  const publicRoute = PUBLIC_SLUG_ROUTE.exec(pathname);
  if (publicRoute) {
    const [, section, slug] = publicRoute;
    if (!slug || !isUsableSlug(slug)) return { kind: "not-found" };
    return section === "c" ? { kind: "public-menu", slug } : { kind: "public-reservations", slug };
  }
  if (pathname === "/c" || pathname === "/r" || pathname === "/c/" || pathname === "/r/") {
    return { kind: "not-found" };
  }

  return { kind: "platform" };
}

export function resolveRequestContext(input: ResolveRequestInput): RequestContext {
  if (!input.host) return { kind: "not-found" };

  const host = normalizeHost(input.host);
  const platformDomain = normalizeHost(input.platformDomain);
  const appHosts = new Set([
    `${APP_SUBDOMAIN}.${platformDomain}`,
    ...(input.extraAppHosts ?? []).map(normalizeHost),
  ]);

  if (appHosts.has(host)) return resolveAppPath(input.pathname);

  // La raíz y `www` son de la web comercial: la plataforma no los atiende.
  const suffix = `.${platformDomain}`;
  if (!host.endsWith(suffix)) return { kind: "not-found" };

  const label = host.slice(0, -suffix.length);
  if (label.includes(".") || !isUsableSlug(label)) return { kind: "not-found" };

  if (input.pathname === "/panel" || input.pathname === "/panel/") {
    return { kind: "venue-panel-redirect", slug: label };
  }
  return { kind: "venue-site", slug: label };
}
