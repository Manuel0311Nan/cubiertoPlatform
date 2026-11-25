import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { es } from "@/i18n/es";
import { canSeeSection, sectionByKey, type PanelSectionKey } from "@/modules/tenancy/domain/panel-sections";
import { requirePanel } from "@/modules/tenancy/panel";

const t = es.panel;

export function SectionHeading({ section }: { section: PanelSectionKey }) {
  return (
    <div className="flex flex-col gap-1.5">
      <h1 className="text-[2rem] leading-[1.05] font-[750] tracking-[-0.03em] md:text-[2.125rem]">{t.sections[section].name}</h1>
      <p className="max-w-[60ch] text-mute">{t.sections[section].description}</p>
    </div>
  );
}

/**
 * Página de un apartado del panel. Comprueba el papel (Ajustes es solo de OWNER) y el módulo
 * (CLAUDE.md §6.4): sin él, en lugar del contenido ofrece activarlo.
 */
export async function SectionPage({ section, children }: { section: PanelSectionKey; children?: ReactNode }) {
  const panel = await requirePanel();
  const definition = sectionByKey(section);
  if (!canSeeSection(definition, panel.membership.role)) notFound();

  if (definition.module && !panel.modules.includes(definition.module)) {
    const moduleName = es.modules[definition.module].name;
    return (
      <div className="flex max-w-[36rem] flex-col gap-4">
        <h1 className="text-[2rem] leading-[1.05] font-[750] tracking-[-0.03em]">{t.upsell.title(moduleName)}</h1>
        <p className="text-mute">{es.modules[definition.module].detail}.</p>
        <p>{panel.membership.role === "OWNER" ? t.upsell.ownerBody : t.upsell.staffBody}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <SectionHeading section={section} />
      {children ?? <p className="max-w-[60ch] rounded-2xl border border-line bg-white p-5">{t.comingSoon}</p>}
    </div>
  );
}
