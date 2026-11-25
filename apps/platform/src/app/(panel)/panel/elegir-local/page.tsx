import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { es } from "@/i18n/es";
import { selectTenantAction, signOutAction } from "@/modules/identity/actions";
import { listUserMemberships } from "@/modules/identity/application/active-tenant";
import { ADMIN_PATH, requireSession, sessionIsSuperadmin } from "@/modules/identity/session";
import { InvitationCard } from "@/modules/identity/ui/invitation-card";
import { SubmitButton } from "@/ui/forms/submit-button";

const t = es.panel;

export const metadata: Metadata = { title: t.chooseTenant.metaTitle };

/** PLT-02: elegir local cuando se tiene acceso a varios (o explicar que no se tiene a ninguno). */
export default async function ChooseTenantPage() {
  const session = await requireSession();
  const [memberships, superadmin] = await Promise.all([listUserMemberships(session.user.id), sessionIsSuperadmin(session.user.id)]);

  if (memberships.length === 0) {
    if (superadmin) redirect(ADMIN_PATH);
    return (
      <InvitationCard title={t.chooseTenant.noneTitle}>
        <p className="text-base leading-normal">{t.chooseTenant.noneBody}</p>
        <form action={signOutAction}>
          <button type="submit" className="btn btn-lg w-full">
            {t.signOut}
          </button>
        </form>
      </InvitationCard>
    );
  }

  return (
    <InvitationCard title={t.chooseTenant.title}>
      <p className="text-base leading-normal">{t.chooseTenant.intro}</p>
      <ul className="flex flex-col gap-2.5">
        {memberships.map((membership) => (
          <li key={membership.tenantId}>
            <form action={selectTenantAction}>
              <input type="hidden" name="tenantId" value={membership.tenantId} />
              <SubmitButton className="choice" pendingLabel={membership.tenantName}>
                <span className="font-[700]">{membership.tenantName}</span>
                <span className="text-sm text-mute">{t.roles[membership.role]}</span>
              </SubmitButton>
            </form>
          </li>
        ))}
      </ul>
      {superadmin ? (
        <Link href={ADMIN_PATH} className="link self-start py-2.5">
          {t.toAdmin}
        </Link>
      ) : null}
    </InvitationCard>
  );
}
