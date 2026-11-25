import type { Metadata } from "next";
import Link from "next/link";
import { es } from "@/i18n/es";
import { signOutAction } from "@/modules/identity/actions";
import { requirePanel } from "@/modules/tenancy/panel";
import { PanelIcon } from "@/ui/panel/icons";

const t = es.panel;

export const metadata: Metadata = { title: t.more.metaTitle };

/** M11 · "Más": en móvil, todos los apartados, cambiar de local y salir. */
export default async function MorePage() {
  const panel = await requirePanel();
  return (
    <div className="flex max-w-[30rem] flex-col gap-6">
      <h1 className="text-[2rem] leading-[1.05] font-[750] tracking-[-0.03em]">{t.more.title}</h1>
      <ul className="flex flex-col overflow-hidden rounded-2xl border border-line bg-white">
        {panel.sections.map((section) => (
          <li key={section.key} className="border-b border-line last:border-b-0">
            <Link href={section.path} className="flex min-h-13 items-center gap-3 px-4 font-[650]">
              <PanelIcon name={section.key} className="text-bottle" />
              {t.sections[section.key].name}
            </Link>
          </li>
        ))}
      </ul>
      <div className="flex flex-col items-start gap-1">
        <p className="text-sm text-mute">
          {panel.user.name ?? panel.user.email} · {t.roles[panel.membership.role]}
        </p>
        {panel.hasOtherTenants ? (
          <Link href="/panel/elegir-local" className="link py-2.5">
            {t.changeTenant}
          </Link>
        ) : null}
        {panel.isSuperadmin ? (
          <Link href="/admin" className="link py-2.5">
            {t.toAdmin}
          </Link>
        ) : null}
        <form action={signOutAction}>
          <button type="submit" className="btn mt-2">
            {t.signOut}
          </button>
        </form>
      </div>
    </div>
  );
}
