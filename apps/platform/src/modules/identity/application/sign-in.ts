import { getSystemDb } from "@cubierto/db";
import { MAGIC_LINK_EVENT } from "@/modules/notifications/application/outbox";
import { SIGN_IN_THROTTLE_MS, type RequestSignInLinkResult } from "../domain/sign-in";
import { AFTER_SIGN_IN_PATH, getAuth, SIGN_IN_PATH } from "../infra/auth";

/**
 * PLT-02: pide un enlace de entrada para `email` (ya validado y normalizado).
 *
 * La respuesta es la misma exista o no el usuario, para no revelar quién tiene acceso. Tampoco se
 * manda un segundo enlace al mismo email antes de un minuto.
 */
export async function requestSignInLink(email: string, headers: Headers): Promise<RequestSignInLinkResult> {
  const db = getSystemDb();
  try {
    const user = await db.user.findUnique({ where: { email }, select: { id: true } });
    if (!user) return { ok: true };

    const recentLinks = await db.outboxEvent.count({
      where: {
        type: MAGIC_LINK_EVENT,
        createdAt: { gt: new Date(Date.now() - SIGN_IN_THROTTLE_MS) },
        payload: { path: ["to"], equals: email },
      },
    });
    if (recentLinks > 0) return { ok: true };

    await getAuth().api.signInMagicLink({
      body: { email, callbackURL: AFTER_SIGN_IN_PATH, errorCallbackURL: SIGN_IN_PATH },
      headers,
    });
    return { ok: true };
  } catch (error) {
    console.error("[identity] No se pudo pedir el enlace de entrada", error);
    return { ok: false, code: "SEND_FAILED" };
  }
}

/** Sesión del usuario que hace la petición, o null. */
export async function getSessionFromHeaders(headers: Headers) {
  return getAuth().api.getSession({ headers });
}

export async function signOut(headers: Headers): Promise<void> {
  await getAuth().api.signOut({ headers });
}
