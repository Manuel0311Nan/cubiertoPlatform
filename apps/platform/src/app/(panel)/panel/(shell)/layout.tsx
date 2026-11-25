import type { Metadata } from "next";
import { es } from "@/i18n/es";
import { requirePanel } from "@/modules/tenancy/panel";
import { PanelShell } from "@/ui/panel/panel-shell";

export const metadata: Metadata = { title: es.panel.metaTitle };

/** Panel del local (PLT-02, paso 5 del primer hito). El local sale de la sesión, nunca de la URL. */
export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const panel = await requirePanel();
  return <PanelShell panel={panel}>{children}</PanelShell>;
}
