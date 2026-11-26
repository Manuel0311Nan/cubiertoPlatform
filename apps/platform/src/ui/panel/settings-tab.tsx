"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/** Pestaña de Ajustes: enlace a su página, marcada con `aria-current` cuando es la actual. */
export function SettingsTab({ href, children }: { href: string; children: ReactNode }) {
  const pathname = usePathname();
  const current = pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link href={href} aria-current={current ? "page" : undefined} className="settings-tab">
      {children}
    </Link>
  );
}
