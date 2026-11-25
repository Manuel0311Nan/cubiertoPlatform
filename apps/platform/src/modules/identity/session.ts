import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { resolveActiveTenant, type UserMembership } from "./application/active-tenant";
import { getSessionFromHeaders } from "./application/sign-in";
import { isSuperadmin } from "./application/superadmin";
import { SIGN_IN_PATH } from "./infra/auth";

export const CHOOSE_TENANT_PATH = "/panel/elegir-local";
export const ADMIN_PATH = "/admin";

/** Para Server Components: sesión actual o null. Una sola consulta por petición (cache). */
export const getCurrentSession = cache(async () => getSessionFromHeaders(await headers()));

/** Para pantallas del panel y del superadmin: sin sesión, a la pantalla de entrada. */
export async function requireSession() {
  const session = await getCurrentSession();
  if (!session) redirect(SIGN_IN_PATH);
  return session;
}

const currentUserIsSuperadmin = cache(async (userId: string) => isSuperadmin(userId));

/**
 * Para pantallas y acciones del superadmin (PLT-09). Sin sesión, a la entrada; con sesión pero
 * sin ser superadmin, 404: no se dice que `/admin` existe.
 */
export async function requireSuperadmin() {
  const session = await requireSession();
  if (!(await currentUserIsSuperadmin(session.user.id))) notFound();
  return session;
}

export interface TenantSession {
  user: { id: string; email: string; name: string | null };
  sessionId: string;
  membership: UserMembership;
  /** Tiene más de un local: el panel ofrece cambiar. */
  hasOtherTenants: boolean;
  isSuperadmin: boolean;
}

/**
 * Para pantallas y acciones del panel del local (PLT-02, CLAUDE.md §6.2): el local activo de la
 * sesión, con la membresía comprobada en esta petición. Sin local elegido, a elegirlo; sin ningún
 * local, el superadmin va a su panel y el resto a la pantalla que lo explica.
 */
export const requireTenant = cache(async (): Promise<TenantSession> => {
  const session = await requireSession();
  const active = await resolveActiveTenant(session.user.id, session.session.id);
  const superadmin = await currentUserIsSuperadmin(session.user.id);
  if (active.kind === "active") {
    return {
      user: { id: session.user.id, email: session.user.email, name: session.user.name || null },
      sessionId: session.session.id,
      membership: active.membership,
      hasOtherTenants: active.membershipCount > 1,
      isSuperadmin: superadmin,
    };
  }
  if (active.kind === "none" && superadmin) redirect(ADMIN_PATH);
  redirect(CHOOSE_TENANT_PATH);
});

/** Si es superadmin (para enseñar el enlace a su panel). */
export async function sessionIsSuperadmin(userId: string): Promise<boolean> {
  return currentUserIsSuperadmin(userId);
}
