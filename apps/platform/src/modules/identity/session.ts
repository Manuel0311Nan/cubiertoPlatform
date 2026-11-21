import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSessionFromHeaders } from "./application/sign-in";
import { SIGN_IN_PATH } from "./infra/auth";

/** Para Server Components: sesión actual o null. */
export async function getCurrentSession() {
  return getSessionFromHeaders(await headers());
}

/** Para pantallas del panel y del superadmin: sin sesión, a la pantalla de entrada. */
export async function requireSession() {
  const session = await getCurrentSession();
  if (!session) redirect(SIGN_IN_PATH);
  return session;
}
