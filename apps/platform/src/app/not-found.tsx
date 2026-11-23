import type { Metadata } from "next";
import { es } from "@/i18n/es";

const t = es.notFound;

export const metadata: Metadata = { title: t.metaTitle };

/** 404 genérica: no dice si existe ningún local con ese nombre (00-plataforma §5). */
export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-4 p-6">
      {/* eslint-disable-next-line @next/next/no-img-element -- SVG estático de la marca: next/image no aporta nada */}
      <img src="/brand/cubierto-logo-color.svg" alt={es.brand.name} width={110} height={29} />
      <h1 className="text-[2.125rem] leading-[1.05] font-[750] tracking-[-0.03em]">{t.title}</h1>
      <p className="text-mute">{t.body}</p>
    </main>
  );
}
