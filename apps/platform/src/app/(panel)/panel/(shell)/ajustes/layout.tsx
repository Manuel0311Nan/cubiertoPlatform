import { es } from "@/i18n/es";
import { requireOwner } from "@/modules/tenancy/panel";
import { SectionHeading } from "@/ui/panel/section-page";
import { SettingsTab } from "@/ui/panel/settings-tab";

const t = es.settings;

/**
 * Ajustes (D17–D19): solo para el responsable (00-plataforma §3: STAFF no ve facturación ni equipo).
 * Apartados: El local (PLT-04), Mesas (PLT-05) y Equipo (PLT-03); Reservas y Plan llegan con RES-11 y PLT-06.
 */
export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  await requireOwner();
  return (
    <div className="flex flex-col gap-6">
      <SectionHeading section="settings" />
      <nav aria-label={t.tabsLabel} className="border-b border-line">
        <ul className="flex gap-1 overflow-x-auto">
          <li>
            <SettingsTab href="/panel/ajustes/local">{t.tabs.venue}</SettingsTab>
          </li>
          <li>
            <SettingsTab href="/panel/ajustes/mesas">{t.tabs.tables}</SettingsTab>
          </li>
          <li>
            <SettingsTab href="/panel/ajustes/equipo">{t.tabs.team}</SettingsTab>
          </li>
        </ul>
      </nav>
      {children}
    </div>
  );
}
