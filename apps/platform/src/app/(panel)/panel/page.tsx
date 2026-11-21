import type { Metadata } from "next";
import { es } from "@/i18n/es";
import { signOutAction } from "@/modules/identity/actions";
import { requireSession } from "@/modules/identity/session";

const t = es.panel;

export const metadata: Metadata = { title: t.metaTitle };

/** Provisional hasta el panel del local (paso 4 del primer hito): comprueba que la sesión funciona. */
export default async function PanelPage() {
  const { user } = await requireSession();

  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-5 p-6">
      <h1 className="text-[2.125rem] leading-[1.05] font-[750] tracking-[-0.03em]">
        {t.greeting}, {user.name || user.email}
      </h1>
      <p className="text-mute">{t.comingSoon}</p>
      <form action={signOutAction}>
        <button type="submit" className="btn">
          {t.signOut}
        </button>
      </form>
    </main>
  );
}
