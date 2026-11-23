import { getSystemDb } from "@cubierto/db";
import { SIGN_IN_THROTTLE_MS, type RequestSignInLinkResult } from "../domain/sign-in";
import { AFTER_SIGN_IN_PATH, getAuth, SIGN_IN_PATH } from "../infra/auth";

/**
 * Enlaces de entrada de `email` pedidos después de `since`. Better Auth los guarda en `Verification`
 * con `identifier = "magic-link:<hash del token>"` y `value = {"type":"magic-link","email":…}`.
 */
function magicLinksFor(email: string, since: Date) {
  return {
    identifier: { startsWith: "magic-link:" },
    // Con las comillas del JSON: "ana@x.es" no casa con "juana@x.es".
    value: { contains: `"email":${JSON.stringify(email)}` },
    createdAt: { gt: since },
  };
}

/**
 * PLT-02: pide un enlace de entrada para `email` (ya validado y normalizado) y lo envía al momento.
 *
 * La respuesta es la misma exista o no el usuario, para no revelar quién tiene acceso. Tampoco se
 * manda un segundo enlace al mismo email antes de un minuto. Si el envío falla, se borra el enlace
 * que no llegó a salir: así no cuenta para ese minuto y la persona puede pedir otro en seguida.
 */
export async function requestSignInLink(email: string, headers: Headers): Promise<RequestSignInLinkResult> {
  const db = getSystemDb();
  const since = new Date(Date.now() - SIGN_IN_THROTTLE_MS);
  try {
    const user = await db.user.findUnique({ where: { email }, select: { id: true } });
    if (!user) return { ok: true };

    const recentLinks = await db.verification.count({ where: magicLinksFor(email, since) });
    if (recentLinks > 0) return { ok: true };

    await getAuth().api.signInMagicLink({
      body: { email, callbackURL: AFTER_SIGN_IN_PATH, errorCallbackURL: SIGN_IN_PATH },
      headers,
    });
    return { ok: true };
  } catch (error) {
    console.error("[identity] No se pudo enviar el enlace de entrada", error);
    await db.verification.deleteMany({ where: magicLinksFor(email, since) }).catch(() => undefined);
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
