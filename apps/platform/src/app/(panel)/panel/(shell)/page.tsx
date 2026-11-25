import { es } from "@/i18n/es";
import { requirePanel } from "@/modules/tenancy/panel";
import { SectionPage } from "@/ui/panel/section-page";

/** D6/M11 · Hoy: portada del panel. Su contenido llega con reservas, carta y web. */
export default async function TodayPage() {
  const panel = await requirePanel();
  const date = new Intl.DateTimeFormat("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: panel.venue?.timezone ?? "Europe/Madrid",
  }).format(new Date());

  return (
    <SectionPage section="today">
      <p className="text-lg font-[650] first-letter:uppercase">{date}</p>
      <p className="max-w-[60ch] rounded-2xl border border-line bg-white p-5">
        {panel.modules.length === 0 ? es.panel.todayNoModules : es.panel.comingSoon}
      </p>
    </SectionPage>
  );
}
