import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { middleware } from "./middleware";

function run(url: string) {
  const { host } = new URL(url);
  return middleware(new NextRequest(url, { headers: { host } }));
}

/** Ruta a la que NextResponse.rewrite manda la petición, o null si no reescribe. */
const rewrittenTo = (response: Response) => response.headers.get("x-middleware-rewrite");

beforeEach(() => {
  vi.stubEnv("PLATFORM_DOMAIN", "cubierto.site");
  vi.stubEnv("VERCEL_URL", "");
  vi.stubEnv("VERCEL_BRANCH_URL", "");
  vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "");
});
afterEach(() => vi.unstubAllEnvs());

describe("00-plataforma §5 · middleware", () => {
  test("app.<dominio> sirve el panel, el superadmin, la entrada y la API", () => {
    for (const path of ["/panel", "/admin/locales/nuevo", "/entrar", "/api/auth/get-session", "/invitacion/abc"]) {
      const response = run(`https://app.cubierto.site${path}`);
      expect(response.headers.get("x-middleware-next"), path).toBe("1");
      expect(rewrittenTo(response), path).toBeNull();
    }
  });

  test("PLT-11: <slug>.<dominio>/panel redirige con 302 al panel de app. y no se indexa", () => {
    const response = run("https://casa-brezo.cubierto.site/panel?x=1");
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("https://app.cubierto.site/panel");
    expect(response.headers.get("x-robots-tag")).toBe("noindex");
  });

  test("PLT-11: en local la redirección conserva el puerto", () => {
    vi.stubEnv("PLATFORM_DOMAIN", "localhost");
    const response = run("http://casa-brezo.localhost:3000/panel");
    expect(response.headers.get("location")).toBe("http://app.localhost:3000/panel");
  });

  test("hosts y rutas que no son de la plataforma dan la 404 genérica", () => {
    for (const url of [
      "https://cubierto.site/",
      "https://www.cubierto.site/",
      "https://otro-dominio.es/panel",
      "https://app.cubierto.site/c/",
      "https://admin.cubierto.site/",
    ]) {
      const response = run(url);
      expect(response.status, url).toBe(404);
      expect(new URL(rewrittenTo(response) ?? "").pathname, url).toBe("/__no-encontrado");
    }
  });

  test("WEB-16 aún no está: la web mínima de un local da la 404 genérica", () => {
    const response = run("https://casa-brezo.cubierto.site/");
    expect(response.status).toBe(404);
  });

  test("manda x-forwarded-host: el render interno tras el redirect de una Server Action llega a localhost", () => {
    const request = new NextRequest("http://localhost:3000/admin?alta=bar", {
      headers: { host: "localhost:3000", "x-forwarded-host": "app.cubierto.site" },
    });
    expect(middleware(request).headers.get("x-middleware-next")).toBe("1");
  });

  test("la URL de Vercel de una preview se sirve como app.", () => {
    vi.stubEnv("VERCEL_URL", "cubierto-git-feat-x.vercel.app");
    const response = run("https://cubierto-git-feat-x.vercel.app/panel");
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });
});
