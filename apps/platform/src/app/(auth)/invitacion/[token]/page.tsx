import type { Metadata } from "next";
import Link from "next/link";
import { es } from "@/i18n/es";
import { acceptInvitationAction, requestNewInvitationAction } from "@/modules/identity/actions";
import { getInvitationView } from "@/modules/identity/application/invitations";
import { SIGN_IN_PATH } from "@/modules/identity/infra/auth";
import { InvitationCard } from "@/modules/identity/ui/invitation-card";
import { SubmitButton } from "@/ui/forms/submit-button";

const t = es.invitation;

// La dirección lleva el token: que no salga en el Referer de nada que se abra desde aquí.
export const metadata: Metadata = { title: t.metaTitle, referrer: "no-referrer" };

function TokenForm({
  token,
  action,
  label,
  pendingLabel,
  primary,
}: {
  token: string;
  action: (formData: FormData) => Promise<void>;
  label: string;
  pendingLabel: string;
  primary?: boolean;
}) {
  return (
    <form action={action} className="pt-2">
      <input type="hidden" name="token" value={token} />
      <SubmitButton className={`btn btn-lg w-full ${primary ? "btn-primary" : ""}`} pendingLabel={pendingLabel}>
        {label}
      </SubmitButton>
    </form>
  );
}

/**
 * PLT-02: lo que abre el enlace del email de invitación. Abrirlo no cambia nada (los antivirus
 * del correo abren los enlaces); se acepta con el botón.
 */
export default async function InvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invitation = await getInvitationView(token);

  switch (invitation.state) {
    case "VALID":
      return (
        <InvitationCard title={t.validTitle(invitation.tenantName)}>
          <p className="text-base leading-normal">
            {t.validBody(invitation.tenantName, t.roles[invitation.role], invitation.email)}
          </p>
          <TokenForm token={token} action={acceptInvitationAction} label={t.accept} pendingLabel={t.accepting} primary />
        </InvitationCard>
      );
    case "EXPIRED":
      return (
        <InvitationCard title={t.expiredTitle}>
          <p className="text-base leading-normal">{t.expiredBody}</p>
          <TokenForm token={token} action={requestNewInvitationAction} label={t.requestNew} pendingLabel={t.requesting} primary />
        </InvitationCard>
      );
    case "ACCEPTED":
      return (
        <InvitationCard title={t.acceptedTitle}>
          <p className="text-base leading-normal">{t.acceptedBody}</p>
          <Link href={SIGN_IN_PATH} className="btn btn-primary btn-lg w-full">
            {t.signIn}
          </Link>
        </InvitationCard>
      );
    default:
      return (
        <InvitationCard title={t.notFoundTitle}>
          <p className="text-base leading-normal">{t.notFoundBody}</p>
          <Link href={SIGN_IN_PATH} className="link self-start py-2.5">
            {t.signIn}
          </Link>
        </InvitationCard>
      );
  }
}
