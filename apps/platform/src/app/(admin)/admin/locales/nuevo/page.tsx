import type { Metadata } from "next";
import Link from "next/link";
import { es } from "@/i18n/es";
import { CreateTenantForm } from "@/modules/tenancy/ui/create-tenant-form";

const t = es.admin.createTenant;

export const metadata: Metadata = { title: t.metaTitle };

/** PLT-01 · D22: alta de un local. La vista es un asistente de 4 pasos; la spec, un formulario. */
export default function NewTenantPage() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-5 py-7 md:px-8">
      <Link href="/admin" className="link self-start">
        {t.back}
      </Link>
      <div className="flex flex-col gap-2">
        <h1 className="text-[2rem] leading-[1.05] font-[750] tracking-[-0.03em]">{t.title}</h1>
        <p className="text-mute">{t.intro}</p>
      </div>
      <CreateTenantForm platformDomain={process.env.PLATFORM_DOMAIN ?? "localhost"} />
    </main>
  );
}
