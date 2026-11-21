import { describe, expect, test } from "vitest";
import { magicLinkEmail } from "./magic-link-email";

const url = "http://app.localhost:3000/api/auth/magic-link/verify?token=abc&callbackURL=%2Fpanel";

describe("PLT-02 · email con el enlace de entrada", () => {
  test("PLT-02: lleva el enlace, avisa de los 15 minutos y va al destinatario", () => {
    const message = magicLinkEmail({ to: "duena@casa-brezo.test", url });
    expect(message.to).toBe("duena@casa-brezo.test");
    expect(message.subject).toMatch(/enlace/i);
    expect(message.text).toContain(url);
    expect(message.text).toContain("15 minutos");
    expect(message.html).toContain('lang="es"');
  });

  test("escapa el enlace en el HTML", () => {
    const message = magicLinkEmail({ to: "a@b.test", url });
    expect(message.html).toContain("token=abc&amp;callbackURL=%2Fpanel");
    expect(message.html).not.toContain("token=abc&callbackURL");
  });
});
