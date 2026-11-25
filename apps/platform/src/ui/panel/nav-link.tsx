"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { currentSectionKey, type PanelSectionKey } from "@/modules/tenancy/domain/panel-sections";

/**
 * Enlace del menú del panel. Marca la página actual con `aria-current="page"` (guía `navbar` de
 * modern-web-guidance): el estilo cuelga de ese atributo y no depende solo del color.
 */
export function NavLink({ href, section, className, children }: { href: string; section: PanelSectionKey | "more"; className: string; children: ReactNode }) {
  const current = currentSectionKey(usePathname()) === section;
  return (
    <Link href={href} aria-current={current ? "page" : undefined} className={className}>
      {children}
    </Link>
  );
}
