import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { es } from "@/i18n/es";
import { AFTER_SIGN_IN_PATH } from "@/modules/identity/infra/auth";
import { getCurrentSession } from "@/modules/identity/session";
import { SignInForm } from "@/modules/identity/ui/sign-in-form";

const t = es.signIn;

export const metadata: Metadata = { title: t.metaTitle };

/** PLT-02 · D5 (ordenador) y M10 (móvil): entrar al panel con un enlace por email. */
export default async function SignInPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await getCurrentSession()) redirect(AFTER_SIGN_IN_PATH);
  // Better Auth vuelve aquí con ?error=… si el enlace caducó o ya se usó.
  const { error } = await searchParams;

  return (
    <main className="grid min-h-dvh md:grid-cols-2">
      <aside className="hidden flex-col gap-6 bg-bottle px-14 py-12 text-bottle-ink md:flex">
        {/* eslint-disable-next-line @next/next/no-img-element -- SVG estático de la marca: next/image no aporta nada */}
        <img src="/brand/cubierto-logo-blanco.svg" alt={es.brand.name} width={130} height={34} />
        <p className="mt-auto max-w-[13ch] text-[2.75rem] leading-[1.05] font-[750] tracking-[-0.035em]">{t.tagline}</p>
        <p className="max-w-[38ch] text-lg leading-normal opacity-85">{t.taglineDetail}</p>
      </aside>

      <div className="flex flex-col gap-10 px-6 py-7 md:justify-center md:px-18 md:py-12">
        {/* eslint-disable-next-line @next/next/no-img-element -- SVG estático de la marca: next/image no aporta nada */}
        <img src="/brand/cubierto-logo-color.svg" alt={es.brand.name} width={110} height={29} className="md:hidden" />
        <div className="w-full max-w-[26rem]">
          <SignInForm linkInvalid={Boolean(error)} />
        </div>
      </div>
    </main>
  );
}
