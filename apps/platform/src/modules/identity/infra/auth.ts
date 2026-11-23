import { getSystemDb } from "@cubierto/db";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { magicLink } from "better-auth/plugins/magic-link";
import { sendMagicLinkEmail } from "@/modules/notifications/application/magic-link";

/** PLT-02: el enlace de entrada vale 15 minutos y un solo uso. */
export const MAGIC_LINK_TTL_SECONDS = 15 * 60;

export const SIGN_IN_PATH = "/entrar";
export const AFTER_SIGN_IN_PATH = "/panel";

function createAuth() {
  return betterAuth({
    appName: "Cubierto",
    // app.<PLATFORM_DOMAIN>: la sesión y las cookies son solo de ese host (PLT-11).
    baseURL: process.env.BETTER_AUTH_URL,
    secret: process.env.BETTER_AUTH_SECRET,
    // Sesiones, usuarios y enlaces son tablas de plataforma (packages/db/README.md).
    database: prismaAdapter(getSystemDb(), { provider: "postgresql" }),
    advanced: { cookiePrefix: "cubierto" },
    plugins: [
      magicLink({
        expiresIn: MAGIC_LINK_TTL_SECONDS,
        // Solo entran usuarios que ya existen (invitados o superadmin): no hay registro abierto.
        disableSignUp: true,
        storeToken: "hashed",
        // Envío directo, sin outbox (PLT-02): si falla, la petición falla y se pide otro enlace.
        sendMagicLink: async ({ email, url }) => {
          await sendMagicLinkEmail({ to: email, url });
        },
      }),
      // Debe ir el último: guarda las cookies de sesión desde Server Actions.
      nextCookies(),
    ],
  });
}

export type Auth = ReturnType<typeof createAuth>;

const globalForAuth = globalThis as typeof globalThis & { __cubiertoAuth?: Auth };

/** Se crea al primer uso, no al importar: la compilación no necesita base de datos. */
export function getAuth(): Auth {
  globalForAuth.__cubiertoAuth ??= createAuth();
  return globalForAuth.__cubiertoAuth;
}
