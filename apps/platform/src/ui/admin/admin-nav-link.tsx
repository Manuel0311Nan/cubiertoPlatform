"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/** Enlace del menú del superadmin, marcado con `aria-current` y subrayado cuando es la página actual. */
export function AdminNavLink({ href, also, children }: { href: string; also?: string; children: ReactNode }) {
  const pathname = usePathname();
  const under = (base: string) => pathname === base || pathname.startsWith(`${base}/`);
  // "/admin" es la portada: solo cuenta la propia página y la sección `also`, no todo el superadmin.
  const current = href === "/admin" ? pathname === href || (also !== undefined && under(also)) : under(href) || (also !== undefined && under(also));
  return (
    <Link
      href={href}
      aria-current={current ? "page" : undefined}
      className="py-2 font-semibold underline-offset-[7px] hover:underline aria-[current=page]:underline aria-[current=page]:decoration-saffron aria-[current=page]:decoration-[3px]"
    >
      {children}
    </Link>
  );
}
