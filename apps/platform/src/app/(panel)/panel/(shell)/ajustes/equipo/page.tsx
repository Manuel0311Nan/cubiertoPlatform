import type { Metadata } from "next";
import Link from "next/link";
import { es } from "@/i18n/es";
import { getTeam, type TeamMember } from "@/modules/identity/application/team";
import { TEAM_PATH } from "@/modules/identity/domain/team";
import { changeRoleAction, removeMemberAction, resendTeamInvitationAction, revokeInvitationAction } from "@/modules/identity/team-actions";
import { InviteForm } from "@/modules/identity/ui/invite-form";
import { requireOwner } from "@/modules/tenancy/panel";
import { Alert } from "@/ui/forms/field-error";
import { SubmitButton } from "@/ui/forms/submit-button";

const t = es.settings.team;

export const metadata: Metadata = { title: t.metaTitle };

const smallButton = "btn min-h-11 px-3.5 text-sm";

function who(member: TeamMember): string {
  return member.name ?? member.email;
}

function ConfirmRemove({ member }: { member: TeamMember }) {
  return (
    <section aria-labelledby="confirm-title" className="flex flex-col gap-3 rounded-2xl border-2 border-tomato bg-white p-4 md:p-5">
      <h2 id="confirm-title" className="text-[1.25rem] font-[750] tracking-[-0.02em]">
        {t.confirmTitle(who(member))}
      </h2>
      <p className="max-w-[60ch]">{t.confirmBody}</p>
      <div className="flex flex-wrap items-center gap-3">
        <form action={removeMemberAction}>
          <input type="hidden" name="userId" value={member.userId} />
          <SubmitButton className="btn btn-primary" pendingLabel={es.settings.saving}>
            {t.confirm}
          </SubmitButton>
        </form>
        <Link href={TEAM_PATH} className="link px-2 py-2.5">
          {t.cancel}
        </Link>
      </div>
    </section>
  );
}

/** PLT-03 · Ajustes → Equipo (vista D19): personas, invitaciones pendientes e invitar. */
export default async function TeamPage({ searchParams }: { searchParams: Promise<{ aviso?: string; error?: string; quitar?: string }> }) {
  const panel = await requireOwner();
  const [team, params] = await Promise.all([getTeam(panel.membership.tenantId, panel.user.id), searchParams]);
  const removing = params.quitar ? team.members.find((m) => m.userId === params.quitar && !m.isYou) : undefined;
  const timeZone = panel.venue?.timezone ?? "Europe/Madrid";
  const dateTime = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone });
  const date = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "long", timeZone });

  return (
    <div className="flex max-w-[52rem] flex-col gap-6">
      <p className="max-w-[62ch] text-mute">{t.intro}</p>

      {params.aviso && t.notices[params.aviso] ? (
        <p role="status" className="rounded-xl border-2 border-bottle bg-[#e6efe9] p-3 text-sm leading-snug">
          {t.notices[params.aviso]}
        </p>
      ) : null}
      {params.error ? <Alert>{t.errors[params.error] ?? t.errors.NOT_FOUND}</Alert> : null}

      {removing ? <ConfirmRemove member={removing} /> : <InviteForm />}

      <section aria-labelledby="members-title" className="flex flex-col gap-3">
        <h2 id="members-title" className="text-[1.5rem] font-[750] tracking-[-0.02em]">
          {t.membersTitle}
        </h2>
        <ul className="flex flex-col divide-y divide-line rounded-2xl border border-line bg-white">
          {team.members.map((member) => {
            const target = member.role === "OWNER" ? "STAFF" : "OWNER";
            const action = member.role === "OWNER" ? t.makeStaff : t.makeOwner;
            return (
              <li key={member.userId} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                <div className="min-w-[14rem] flex-1">
                  <p className="font-[700] break-all">
                    {who(member)}
                    {member.isYou ? <span className="ms-2 rounded-full bg-[#e6efe9] px-2 py-0.5 text-xs font-[650] text-bottle">{t.you}</span> : null}
                  </p>
                  {member.name ? <p className="text-sm break-all text-mute">{member.email}</p> : null}
                  <p className="text-sm">
                    <b className="font-[650]">{t.roles[member.role].name}</b>
                    <span className="text-mute"> · {t.roles[member.role].can}</span>
                  </p>
                  <p className="text-sm text-mute">{member.lastAccessAt ? t.lastAccess(dateTime.format(member.lastAccessAt)) : t.neverAccessed}</p>
                </div>
                {member.isYou ? null : (
                  <div className="flex flex-wrap items-center gap-2">
                    <form action={changeRoleAction}>
                      <input type="hidden" name="userId" value={member.userId} />
                      <input type="hidden" name="role" value={target} />
                      <button type="submit" className={smallButton} aria-label={t.changeRoleLabel(action, who(member))}>
                        {action}
                      </button>
                    </form>
                    <Link href={`${TEAM_PATH}?quitar=${member.userId}`} className={smallButton} aria-label={t.removeLabel(who(member))}>
                      {t.remove}
                    </Link>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        <p className="text-[0.8125rem] text-mute">{t.lastOwnerNote}</p>
      </section>

      {team.invitations.length > 0 ? (
        <section aria-labelledby="invitations-title" className="flex flex-col gap-3">
          <h2 id="invitations-title" className="text-[1.5rem] font-[750] tracking-[-0.02em]">
            {t.invitationsTitle}
          </h2>
          <ul className="flex flex-col divide-y divide-line rounded-2xl border border-line bg-white">
            {team.invitations.map((invitation) => (
              <li key={invitation.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                <div className="min-w-[14rem] flex-1">
                  <p className="font-[700] break-all">{invitation.email}</p>
                  <p className="text-sm text-mute">
                    {t.roles[invitation.role].name} · {invitation.expired ? <b className="font-[650] text-tomato-ink">{t.expired}</b> : t.sentOn(date.format(invitation.sentAt))}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <form action={resendTeamInvitationAction}>
                    <input type="hidden" name="invitationId" value={invitation.id} />
                    <button type="submit" className={smallButton} aria-label={t.resendLabel(invitation.email)}>
                      {t.resend}
                    </button>
                  </form>
                  <form action={revokeInvitationAction}>
                    <input type="hidden" name="invitationId" value={invitation.id} />
                    <button type="submit" className={smallButton} aria-label={t.revokeLabel(invitation.email)}>
                      {t.revoke}
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
