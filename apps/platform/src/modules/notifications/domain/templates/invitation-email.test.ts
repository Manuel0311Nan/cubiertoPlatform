import { describe, expect, test } from "vitest";
import { invitationEmail } from "./invitation-email";

const url = "http://app.localhost:3000/invitacion/tok_123";

describe("PLT-01 · email de invitación", () => {
  test("PLT-01: invita al local con su papel, lleva el enlace y avisa de los 7 días", () => {
    const message = invitationEmail({ to: "duena@casa-brezo.test", tenantName: "Casa Brezo", role: "OWNER", url });
    expect(message.to).toBe("duena@casa-brezo.test");
    expect(message.subject).toContain("Casa Brezo");
    expect(message.text).toContain(url);
    expect(message.text).toContain("responsable del local");
    expect(message.text).toContain("7 días");
    expect(message.html).toContain(`href="${url}"`);
  });

  test("escapa el nombre del local en el HTML", () => {
    const message = invitationEmail({ to: "a@b.test", tenantName: "Bar <Pepe> & Co", role: "STAFF", url });
    expect(message.html).toContain("Bar &lt;Pepe&gt; &amp; Co");
    expect(message.html).not.toContain("<Pepe>");
    expect(message.text).toContain("personal");
  });
});
