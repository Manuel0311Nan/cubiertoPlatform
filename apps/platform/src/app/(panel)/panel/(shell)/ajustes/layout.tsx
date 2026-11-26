import { es } from "@/i18n/es";
import { requireOwner } from "@/modules/tenancy/panel";
import { NavLink } from "@/ui/panel/nav-link";
import { SectionHeading } from "@/ui/panel/section-page";

const t = es.settings;

/**
 * Ajustes (D17–D19): solo para el responsable (00-plataforma §3: STAFF no ve facturación ni equipo).
 * Los apartados Reservas, Equipo y Plan se añaden cuando lleguen (RES-11, PLT-03, PLT-06).
 */
export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  await requireOwner();
  return (
    <div className="flex flex-col gap-6">
      <SectionHeading section="settings" />
      <nav aria-label={t.tabsLabel} className="border-b border-line">
        <ul className="flex gap-1">
          <li>
            <NavLink href="/panel/ajustes/local" section="settings" className="settings-tab">
              {t.tabs.venue}
            </NavLink>
          </li>
        </ul>
      </nav>
      {children}
    </div>
  );
}
