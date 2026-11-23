import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getSessionFromHeaders } from "./application/sign-in";
import { isSuperadmin } from "./application/superadmin";
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

/**
 * Para pantallas y acciones del superadmin (PLT-09). Sin sesión, a la entrada; con sesión pero
 * sin ser superadmin, 404: no se dice que `/admin` existe.
 */
export async function requireSuperadmin() {
  const session = await requireSession();
  if (!(await isSuperadmin(session.user.id))) notFound();
  return session;
}
