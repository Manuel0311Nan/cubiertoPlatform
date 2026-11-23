import type { Metadata } from "next";
import Link from "next/link";
import { es } from "@/i18n/es";
import { resendInvitationAction } from "@/modules/identity/actions";
import { listTenants, type TenantListItem } from "@/modules/tenancy/application/list-tenants";
import { SubmitButton } from "@/ui/forms/submit-button";

const t = es.admin.tenants;

export const metadata: Metadata = { title: t.metaTitle };

const dateFormat = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Madrid" });

function Notice({ tone, children }: { tone: "ok" | "error"; children: React.ReactNode }) {
  const styles = tone === "ok" ? "border-bottle bg-[#e6efe9] text-ink" : "border-tomato bg-tomato-soft text-tomato-ink";
  return (
    <p role={tone === "ok" ? "status" : "alert"} className={`rounded-xl border-2 p-3 text-sm leading-snug ${styles}`}>
      {children}
    </p>
  );
}

function OwnerCell({ tenant }: { tenant: TenantListItem }) {
  const invitation = tenant.pendingOwnerInvitation;
  if (!invitation) return <span className="text-mute">{tenant.owners > 0 ? t.ownerJoined : t.noOwner}</span>;
  return (
    <div className="flex flex-col items-start gap-2">
      <span className={invitation.state === "EXPIRED" ? "text-tomato-ink" : undefined}>
        {invitation.state === "EXPIRED" ? t.invitationExpired(invitation.email) : t.invitationPending(invitation.email)}
      </span>
      <form action={resendInvitationAction}>
        <input type="hidden" name="invitationId" value={invitation.id} />
        <SubmitButton className="btn min-h-10 px-3.5 text-sm" pendingLabel={`${t.resend}…`}>
          {t.resend}
        </SubmitButton>
      </form>
      <span className="text-[0.8125rem] text-mute">{t.resendHint}</span>
    </div>
  );
}

/** PLT-09 · D20 (mínimo): todos los locales y su invitación pendiente, con "Reenviar invitación". */
export default async function TenantsPage({
  searchParams,
}: {
  searchParams: Promise<{ alta?: string; reenviada?: string; reenvio?: string }>;
}) {
  const [tenants, params] = await Promise.all([listTenants(), searchParams]);
  const created = params.alta ? tenants.find((tenant) => tenant.slug === params.alta) : undefined;

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-7 md:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[2rem] leading-[1.05] font-[750] tracking-[-0.03em]">{t.title}</h1>
          <p className="mt-1 text-mute">{t.count(tenants.length)}</p>
        </div>
        <Link href="/admin/locales/nuevo" className="btn btn-primary">
          {t.create}
        </Link>
      </div>

      {created ? (
        <Notice tone="ok">{t.created(created.name, created.pendingOwnerInvitation?.email ?? "")}</Notice>
      ) : null}
      {params.reenviada ? <Notice tone="ok">{t.resent(params.reenviada)}</Notice> : null}
      {params.reenvio === "fallido" ? <Notice tone="error">{t.resendFailed}</Notice> : null}

      {tenants.length === 0 ? (
        <p className="text-mute">{t.empty}</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-line bg-white">
          <table className="w-full border-collapse text-left text-[0.9375rem]">
            <thead className="text-sm text-mute">
              <tr className="border-b border-line">
                <th scope="col" className="px-4 py-3 font-[650]">{t.columns.tenant}</th>
                <th scope="col" className="px-4 py-3 font-[650]">{t.columns.modules}</th>
                <th scope="col" className="px-4 py-3 font-[650]">{t.columns.owner}</th>
              </tr>
            </thead>
            <tbody>
              {tenants.map((tenant) => (
                <tr key={tenant.id} className="border-b border-line align-top last:border-b-0">
                  <th scope="row" className="px-4 py-3.5 font-normal">
                    <b className="font-[700]">{tenant.name}</b>
                    <br />
                    <span className="text-sm text-mute">
                      {tenant.slug} · {t.createdOn(dateFormat.format(tenant.createdAt))}
                    </span>
                  </th>
                  <td className="px-4 py-3.5">
                    {tenant.modules.length === 0 ? (
                      <span className="text-mute">{t.noModules}</span>
                    ) : (
                      <ul className="flex flex-wrap gap-1.5">
                        {tenant.modules.map((module) => (
                          <li key={module} className="rounded-full bg-[#e6efe9] px-2.5 py-0.5 text-sm font-[650] text-bottle">
                            {es.modules[module].name}
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                  <td className="px-4 py-3.5">
                    <OwnerCell tenant={tenant} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
