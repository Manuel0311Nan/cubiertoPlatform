import Link from "next/link";
import { es } from "@/i18n/es";
import { signOutAction } from "@/modules/identity/actions";
import { requireSuperadmin } from "@/modules/identity/session";

const t = es.admin;

/** Superadmin (PLT-09, D20–D22). Solo usuarios con `isSuperadmin`; el resto ve una 404. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireSuperadmin();

  return (
    <div className="min-h-dvh">
      <header className="flex flex-wrap items-center gap-x-7 gap-y-2 bg-ink px-5 py-3.5 text-bottle-ink md:px-8">
        <div className="flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element -- SVG estático de la marca: next/image no aporta nada */}
          <img src="/brand/cubierto-logo-blanco.svg" alt={es.brand.name} width={110} height={29} />
          <span className="rounded-full bg-saffron/20 px-2.5 py-0.5 text-[0.8125rem] font-[650] text-[#f5c766]">{t.badge}</span>
        </div>
        <nav aria-label={t.navLabel}>
          <Link
            href="/admin"
            className="font-semibold underline decoration-saffron decoration-[3px] underline-offset-[7px]"
          >
            {t.nav.tenants}
          </Link>
        </nav>
        <div className="ms-auto flex items-center gap-4 text-sm">
          <span className="text-line">{user.name || user.email}</span>
          <form action={signOutAction}>
            <button type="submit" className="cursor-pointer py-2 font-[650] underline underline-offset-3">
              {es.panel.signOut}
            </button>
          </form>
        </div>
      </header>
      {children}
    </div>
  );
}
