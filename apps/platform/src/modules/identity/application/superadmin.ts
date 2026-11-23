import { getSystemDb } from "@cubierto/db";

/** PLT-09: el superadmin es un usuario con `isSuperadmin` (lo crea `pnpm db:seed`). */
export async function isSuperadmin(userId: string): Promise<boolean> {
  const user = await getSystemDb().user.findUnique({ where: { id: userId }, select: { isSuperadmin: true } });
  return user?.isSuperadmin ?? false;
}
