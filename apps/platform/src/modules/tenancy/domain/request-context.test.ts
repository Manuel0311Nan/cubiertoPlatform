import { describe, expect, test } from "vitest";
import { resolveRequestContext, type ResolveRequestInput } from "./request-context";

const prod = (host: string | null, pathname: string): ResolveRequestInput => ({
  host,
  pathname,
  platformDomain: "cubierto.site",
});

const local = (host: string, pathname: string): ResolveRequestInput => ({
  host,
  pathname,
  platformDomain: "localhost",
});

describe("PLT §5 · resolución de tenant en app.<PLATFORM_DOMAIN>", () => {
  test("PLT §5: /panel/** es el panel (tenant desde la sesión)", () => {
    expect(resolveRequestContext(prod("app.cubierto.site", "/panel"))).toEqual({ kind: "panel" });
    expect(resolveRequestContext(prod("app.cubierto.site", "/panel/ajustes"))).toEqual({ kind: "panel" });
  });

  test("PLT §5: /admin/** es el superadmin, sin tenant", () => {
    expect(resolveRequestContext(prod("app.cubierto.site", "/admin/locales"))).toEqual({ kind: "admin" });
  });

  test("PLT §5: /c/<slug> es la carta pública y /r/<slug> las reservas", () => {
    expect(resolveRequestContext(prod("app.cubierto.site", "/c/casa-brezo"))).toEqual({
      kind: "public-menu",
      slug: "casa-brezo",
    });
    expect(resolveRequestContext(prod("app.cubierto.site", "/r/casa-brezo/confirmar"))).toEqual({
      kind: "public-reservations",
      slug: "casa-brezo",
    });
  });

  test("PLT §5: /embed.js es el widget de reservas", () => {
    expect(resolveRequestContext(prod("app.cubierto.site", "/embed.js"))).toEqual({ kind: "reservations-widget" });
  });

  test("PLT §5: /api/public/v1/** es la API pública", () => {
    expect(resolveRequestContext(prod("app.cubierto.site", "/api/public/v1/venues/casa-brezo"))).toEqual({
      kind: "public-api",
    });
  });

  test("PLT §5: un slug imposible en /c o /r da 404 sin consultar la base de datos", () => {
    for (const path of ["/c/admin", "/c/Casa", "/r/ab", "/c", "/r/"]) {
      expect(resolveRequestContext(prod("app.cubierto.site", path))).toEqual({ kind: "not-found" });
    }
  });

  test("PLT §5: no confunde rutas que solo empiezan igual", () => {
    expect(resolveRequestContext(prod("app.cubierto.site", "/panelx"))).toEqual({ kind: "platform" });
    expect(resolveRequestContext(prod("app.cubierto.site", "/administrar"))).toEqual({ kind: "platform" });
  });

  test("PLT §5: el resto de app. es de la plataforma (entrada, auth, webhooks)", () => {
    expect(resolveRequestContext(prod("app.cubierto.site", "/"))).toEqual({ kind: "platform" });
    expect(resolveRequestContext(prod("app.cubierto.site", "/api/webhooks/stripe"))).toEqual({ kind: "platform" });
  });
});

describe("WEB-16 y PLT-11 · <slug>.<PLATFORM_DOMAIN>", () => {
  test("WEB-16: <slug>.cubierto.site es la web mínima de ese local", () => {
    expect(resolveRequestContext(prod("casa-brezo.cubierto.site", "/"))).toEqual({
      kind: "venue-site",
      slug: "casa-brezo",
    });
  });

  test("PLT-11: /panel en <slug>.cubierto.site redirige al panel de app.", () => {
    expect(resolveRequestContext(prod("casa-brezo.cubierto.site", "/panel"))).toEqual({
      kind: "venue-panel-redirect",
      slug: "casa-brezo",
    });
    expect(resolveRequestContext(prod("casa-brezo.cubierto.site", "/panel/"))).toEqual({
      kind: "venue-panel-redirect",
      slug: "casa-brezo",
    });
  });

  test("WEB-16: en local, casa-brezo.localhost:3000 resuelve al local casa-brezo", () => {
    expect(resolveRequestContext(local("casa-brezo.localhost:3000", "/"))).toEqual({
      kind: "venue-site",
      slug: "casa-brezo",
    });
    expect(resolveRequestContext(local("app.localhost:3000", "/panel"))).toEqual({ kind: "panel" });
  });

  test("normaliza mayúsculas, puerto y punto final del host", () => {
    expect(resolveRequestContext(prod("Casa-Brezo.Cubierto.Site.:443", "/"))).toEqual({
      kind: "venue-site",
      slug: "casa-brezo",
    });
  });
});

describe("PLT §5 · hosts que la plataforma no atiende", () => {
  test("PLT §5: la raíz y www son de la web comercial → 404", () => {
    expect(resolveRequestContext(prod("cubierto.site", "/"))).toEqual({ kind: "not-found" });
    expect(resolveRequestContext(prod("www.cubierto.site", "/"))).toEqual({ kind: "not-found" });
  });

  test("PLT §5: host desconocido → 404 genérica", () => {
    for (const host of ["casabrezo.es", "evil.com", "cubierto.site.evil.com", "a.b.cubierto.site", "api.cubierto.site"]) {
      expect(resolveRequestContext(prod(host, "/"))).toEqual({ kind: "not-found" });
    }
  });

  test("PLT §5: sin cabecera Host → 404", () => {
    expect(resolveRequestContext(prod(null, "/"))).toEqual({ kind: "not-found" });
  });

  test("las URL de preview configuradas se tratan como app.", () => {
    const input = {
      ...prod("cubierto-git-feat-x.vercel.app", "/panel"),
      extraAppHosts: ["cubierto-git-feat-x.vercel.app"],
    };
    expect(resolveRequestContext(input)).toEqual({ kind: "panel" });
  });
});
