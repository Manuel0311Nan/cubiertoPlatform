import type { ReactNode } from "react";
import { es } from "@/i18n/es";

/** Marco de las pantallas de invitación (PLT-02): logo, título y contenido, centrado. */
export function InvitationCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-[30rem] flex-col justify-center gap-5 px-6 py-10">
      {/* eslint-disable-next-line @next/next/no-img-element -- SVG estático de la marca: next/image no aporta nada */}
      <img src="/brand/cubierto-logo-color.svg" alt={es.brand.name} width={110} height={29} className="mb-4" />
      <h1 className="text-[2.125rem] leading-[1.05] font-[750] tracking-[-0.03em]">{title}</h1>
      {children}
    </main>
  );
}
