import { disconnectDb, getSystemDb } from "@cubierto/db";
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import type { EmailMessage } from "@/modules/notifications/domain/email";
import { requireTestDatabase, uniqueSuffix } from "@/test/database";
import { getAuth } from "../infra/auth";
import { requestSignInLink } from "./sign-in";

// Los emails se quedan en memoria: así el test puede leer el enlace.
const outbox = vi.hoisted(() => ({ sent: [] as EmailMessage[] }));
vi.mock("@/modules/notifications/infra/email-sender", () => ({
  getEmailSender: () => ({
    send: async (message: EmailMessage) => {
      outbox.sent.push(message);
    },
  }),
}));

const headers = new Headers({ "user-agent": "vitest" });
const userIds: string[] = [];
const emails: string[] = [];

async function createUser(): Promise<string> {
  const email = `user-${uniqueSuffix()}@cubierto.test`;
  const user = await getSystemDb().user.create({ data: { email } });
  userIds.push(user.id);
  emails.push(email);
  return email;
}

function lastLinkTo(email: string): URL {
  const message = outbox.sent.findLast((m) => m.to === email);
  if (!message) throw new Error(`No hay email para ${email}`);
  const url = message.text.split("\n").find((line) => line.startsWith("http"));
  if (!url) throw new Error("El email no lleva el enlace");
  return new URL(url);
}

async function verify(link: URL) {
  return getAuth().api.magicLinkVerify({
    query: {
      token: link.searchParams.get("token") ?? "",
      callbackURL: link.searchParams.get("callbackURL") ?? undefined,
      errorCallbackURL: link.searchParams.get("errorCallbackURL") ?? undefined,
    },
    headers,
    asResponse: true,
  });
}

/** Better Auth redirige con URL absolutas a BETTER_AUTH_URL: se compara la ruta. */
function redirectPath(response: Response): string {
  const location = response.headers.get("location") ?? "";
  const url = new URL(location, "http://app.localhost:3000");
  expect(url.origin).toBe("http://app.localhost:3000");
  return url.pathname + url.search;
}

const linkEventsTo = (email: string) =>
  getSystemDb().outboxEvent.count({ where: { type: "auth.magic_link", payload: { path: ["to"], equals: email } } });

beforeAll(() => requireTestDatabase());
beforeEach(() => {
  outbox.sent.length = 0;
});
afterAll(async () => {
  const db = getSystemDb();
  for (const email of emails) {
    await db.outboxEvent.deleteMany({ where: { payload: { path: ["to"], equals: email } } });
    await db.verification.deleteMany({ where: { value: { contains: email } } });
  }
  await db.session.deleteMany({ where: { userId: { in: userIds } } });
  await db.user.deleteMany({ where: { id: { in: userIds } } });
  await disconnectDb();
});

describe("PLT-02 · entrar con un enlace por email", () => {
  test("PLT-02: un usuario con acceso recibe un enlace al panel que vale 15 minutos", async () => {
    const email = await createUser();
    expect(await requestSignInLink(email, headers)).toEqual({ ok: true });

    const link = lastLinkTo(email);
    expect(link.pathname).toBe("/api/auth/magic-link/verify");
    expect(link.searchParams.get("callbackURL")).toBe("/panel");

    const verification = await getSystemDb().verification.findFirstOrThrow({ where: { value: { contains: email } } });
    const minutes = (verification.expiresAt.getTime() - Date.now()) / 60_000;
    expect(minutes).toBeGreaterThan(14);
    expect(minutes).toBeLessThanOrEqual(15);
    // El token se guarda con hash: el de la base de datos no es el del enlace.
    expect(verification.identifier).not.toBe(link.searchParams.get("token"));
  });

  test("PLT-02: el enlace inicia sesión y lleva al panel", async () => {
    const email = await createUser();
    await requestSignInLink(email, headers);

    const response = await verify(lastLinkTo(email));
    expect(response.status).toBe(302);
    expect(redirectPath(response)).toBe("/panel");
    expect(response.headers.get("set-cookie")).toContain("cubierto.session_token");
  });

  test("PLT-02: un enlace ya usado no vale y vuelve a la pantalla de entrada con el error", async () => {
    const email = await createUser();
    await requestSignInLink(email, headers);
    const link = lastLinkTo(email);
    await verify(link);

    const again = await verify(link);
    expect(again.status).toBe(302);
    expect(redirectPath(again)).toMatch(/^\/entrar\?error=/);
    expect(again.headers.get("set-cookie") ?? "").not.toContain("cubierto.session_token=");
  });

  test("PLT-02: un enlace caducado no vale", async () => {
    const email = await createUser();
    await requestSignInLink(email, headers);
    await getSystemDb().verification.updateMany({
      where: { value: { contains: email } },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const response = await verify(lastLinkTo(email));
    expect(redirectPath(response)).toMatch(/^\/entrar\?error=/);
  });

  test("PLT-02: un email sin acceso recibe la misma respuesta, pero ningún enlace", async () => {
    const email = `nadie-${uniqueSuffix()}@cubierto.test`;
    emails.push(email);
    expect(await requestSignInLink(email, headers)).toEqual({ ok: true });
    expect(outbox.sent.filter((m) => m.to === email)).toHaveLength(0);
    expect(await getSystemDb().user.count({ where: { email } })).toBe(0);
  });

  test("no manda un segundo enlace al mismo email antes de un minuto", async () => {
    const email = await createUser();
    await requestSignInLink(email, headers);
    await requestSignInLink(email, headers);
    expect(await linkEventsTo(email)).toBe(1);
  });
});
