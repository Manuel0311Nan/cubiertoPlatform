import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { es } from "@/i18n/es";
import { InvitationCard } from "@/modules/identity/ui/invitation-card";

const t = es.invitation;

export const metadata: Metadata = { title: t.metaTitle };

/** PLT-02: confirmación tras pedir otra invitación desde un enlace caducado. */
export default async function InvitationSentPage({ searchParams }: { searchParams: Promise<{ enviada?: string }> }) {
  if ((await searchParams).enviada !== "1") notFound();
  return (
    <InvitationCard title={t.sentTitle}>
      <p role="status" className="text-base leading-normal">
        {t.sentBody}
      </p>
    </InvitationCard>
  );
}
