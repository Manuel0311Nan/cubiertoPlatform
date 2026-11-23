import { NextResponse, type NextRequest } from "next/server";
import { APP_SUBDOMAIN, resolveRequestContext } from "@/modules/tenancy/domain/request-context";

/**
 * Ruta interna que no existe: reescribir aquí da la 404 genérica (`app/not-found.tsx`) sin
 * cambiar la dirección y sin decir si el slug o el host pertenecen a algún local (00-plataforma §5).
 */
const NOT_FOUND_PATH = "/__no-encontrado";

/** Hosts de Vercel que se sirven como `app.` (URL de la preview y del despliegue). */
function vercelAppHosts(): string[] {
  return [process.env.VERCEL_URL, process.env.VERCEL_BRANCH_URL, process.env.VERCEL_PROJECT_PRODUCTION_URL].filter(
    (host): host is string => Boolean(host),
  );
}

/**
 * Host con el que llegó la petición. Primero `x-forwarded-host`: Vercel lo pone con el host real,
 * y Next también, al reenviar a sí mismo el render tras el `redirect()` de una Server Action (esa
 * petición interna va a `localhost` y sin esto acabaría en la 404).
 */
function requestHost(request: NextRequest): string | null {
  const forwarded = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("host");
}

function notFound(request: NextRequest) {
  return NextResponse.rewrite(new URL(NOT_FOUND_PATH, request.url), { status: 404 });
}

/**
 * Decide qué sirve la plataforma según el host y la ruta (00-plataforma §5). Solo enruta: la
 * sesión, el superadmin y el tenant se comprueban en cada pantalla y acción, en el servidor.
 */
export function middleware(request: NextRequest) {
  const platformDomain = process.env.PLATFORM_DOMAIN ?? "localhost";
  const context = resolveRequestContext({
    host: requestHost(request),
    pathname: request.nextUrl.pathname,
    platformDomain,
    extraAppHosts: vercelAppHosts(),
  });

  switch (context.kind) {
    case "venue-panel-redirect": {
      // PLT-11: el panel nunca se sirve en el dominio de un local.
      const panel = request.nextUrl.clone();
      panel.hostname = `${APP_SUBDOMAIN}.${platformDomain}`;
      panel.pathname = "/panel";
      panel.search = "";
      const response = NextResponse.redirect(panel, 302);
      response.headers.set("X-Robots-Tag", "noindex");
      return response;
    }
    case "venue-site":
      // WEB-16 (página mínima o 301 a la web del local) llega en su propio PR.
      return notFound(request);
    case "not-found":
      return notFound(request);
    default:
      return NextResponse.next();
  }
}

export const config = {
  // Todo salvo los estáticos que genera Next.
  matcher: ["/((?!_next/static|_next/image).*)"],
};
