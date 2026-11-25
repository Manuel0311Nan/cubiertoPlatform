import type { ReactNode } from "react";
import Link from "next/link";
import { es } from "@/i18n/es";
import { signOutAction } from "@/modules/identity/actions";
import { mobileTabs } from "@/modules/tenancy/domain/panel-sections";
import type { PanelContext } from "@/modules/tenancy/panel";
import { PanelIcon } from "./icons";
import { NavLink } from "./nav-link";

const t = es.panel;

function venueLine(panel: PanelContext): string | null {
  const parts = [panel.venue?.addressLine, panel.venue?.city].filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}

/**
 * Marco del panel del local (vistas D6 en ordenador y M11 en móvil). En ordenador, barra lateral
 * con el local, el menú y quién eres; en móvil, cabecera con el local y barra inferior con "Hoy",
 * hasta tres apartados y "Más". Solo se ve una de las dos navegaciones a la vez.
 */
export function PanelShell({ panel, children }: { panel: PanelContext; children: ReactNode }) {
  const tenantName = panel.venue?.name ?? panel.membership.tenantName;
  const address = venueLine(panel);
  const tabs = mobileTabs(panel.sections);

  return (
    <div className="min-h-dvh md:flex">
      <a href="#contenido" className="skip-link">
        {t.skipToContent}
      </a>

      <aside className="sticky top-0 hidden h-dvh w-[15rem] flex-none flex-col gap-6 overflow-y-auto bg-bottle px-3.5 py-5 text-bottle-ink md:flex">
        {/* eslint-disable-next-line @next/next/no-img-element -- SVG estático de la marca: next/image no aporta nada */}
        <img src="/brand/cubierto-logo-blanco.svg" alt={es.brand.name} width={116} height={30} className="mx-2" />

        <div className="rounded-xl border border-bottle-ink/25 px-3 py-2.5">
          <p className="font-[700] leading-snug">{tenantName}</p>
          {address ? <p className="text-sm leading-snug opacity-85">{address}</p> : null}
          {panel.hasOtherTenants ? (
            <Link href="/panel/elegir-local" className="mt-1.5 inline-block text-sm font-[650] underline underline-offset-3">
              {t.changeTenant}
            </Link>
          ) : null}
        </div>

        <nav aria-label={t.navLabel}>
          <ul className="flex flex-col gap-0.5">
            {panel.sections.map((section) => (
              <li key={section.key}>
                <NavLink href={section.path} section={section.key} className="side-link">
                  <PanelIcon name={section.key} />
                  {t.sections[section.key].name}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="mt-auto flex flex-col gap-2 px-3 text-sm leading-snug">
          <p>
            <span className="block font-[650] break-all">{panel.user.name ?? panel.user.email}</span>
            <span className="opacity-85">{t.roles[panel.membership.role]}</span>
          </p>
          {panel.isSuperadmin ? (
            <Link href="/admin" className="font-[650] underline underline-offset-3">
              {t.toAdmin}
            </Link>
          ) : null}
          <form action={signOutAction}>
            <button type="submit" className="cursor-pointer py-1 font-[650] underline underline-offset-3">
              {t.signOut}
            </button>
          </form>
        </div>
      </aside>

      <header className="bg-bottle px-5 py-3.5 text-bottle-ink md:hidden">
        <p className="font-[700]">{tenantName}</p>
        {address ? <p className="text-sm opacity-85">{address}</p> : null}
      </header>

      <main id="contenido" tabIndex={-1} className="min-w-0 flex-1 px-5 pt-6 pb-28 outline-none md:px-9 md:py-8">
        {children}
      </main>

      <nav aria-label={t.navLabel} className="tab-bar md:hidden">
        <ul style={{ gridTemplateColumns: `repeat(${tabs.length + 1}, minmax(0, 1fr))` }}>
          {tabs.map((section) => (
            <li key={section.key}>
              <NavLink href={section.path} section={section.key} className="tab-link">
                <PanelIcon name={section.key} />
                {t.sections[section.key].name}
              </NavLink>
            </li>
          ))}
          <li>
            <NavLink href="/panel/mas" section="more" className="tab-link">
              <PanelIcon name="more" />
              {t.more.name}
            </NavLink>
          </li>
        </ul>
      </nav>
    </div>
  );
}
