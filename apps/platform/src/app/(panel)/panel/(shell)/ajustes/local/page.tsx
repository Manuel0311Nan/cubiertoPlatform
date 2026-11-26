import type { Metadata } from "next";
import { es } from "@/i18n/es";
import { removeClosureAction } from "@/modules/venue/actions";
import { getVenueSettings } from "@/modules/venue/application/venue-settings";
import type { ClosurePeriod } from "@/modules/venue/domain/closed-dates";
import { ClosureForm } from "@/modules/venue/ui/closure-form";
import { OpeningHoursForm } from "@/modules/venue/ui/opening-hours-form";
import { VenueDetailsForm } from "@/modules/venue/ui/venue-details-form";
import { requireOwner } from "@/modules/tenancy/panel";

const t = es.settings;

export const metadata: Metadata = { title: t.venue.metaTitle };

// Fechas de calendario ("2026-12-25"): se muestran tal cual, sin pasar por la zona horaria de nadie.
const dateFormat = new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const formatDate = (date: string) => dateFormat.format(new Date(`${date}T00:00:00Z`));

function periodLabel(period: ClosurePeriod) {
  return period.from === period.to ? t.closures.single(formatDate(period.from)) : t.closures.range(formatDate(period.from), formatDate(period.to));
}

function Card({ id, title, intro, children }: { id: string; title: string; intro: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 id={id} className="text-[1.5rem] leading-tight font-[750] tracking-[-0.02em]">
          {title}
        </h2>
        <p className="max-w-[62ch] text-mute">{intro}</p>
      </div>
      {children}
    </section>
  );
}

/** PLT-04 · Ajustes → El local: datos, horario y cierres. */
export default async function VenueSettingsPage() {
  const panel = await requireOwner();
  const settings = await getVenueSettings(panel.membership.tenantId);
  const details = Object.fromEntries(Object.entries(settings.details).map(([key, value]) => [key, value ?? ""])) as Record<keyof typeof settings.details, string>;

  return (
    <div className="flex max-w-[52rem] flex-col gap-10">
      <p className="-mb-6 text-sm text-mute">{t.requiredNote}</p>
      <Card id="details-title" title={t.venue.detailsTitle} intro={t.venue.detailsIntro}>
        <VenueDetailsForm initial={details} />
      </Card>

      <Card id="hours-title" title={t.hours.title} intro={t.hours.intro}>
        <OpeningHoursForm initial={settings.openingHours} />
      </Card>

      <Card id="closures-title" title={t.closures.title} intro={t.closures.intro}>
        {settings.closures.length === 0 ? (
          <p className="text-mute">{t.closures.empty}</p>
        ) : (
          <ul aria-label={t.closures.listLabel} className="flex flex-col divide-y divide-line rounded-2xl border border-line bg-white">
            {settings.closures.map((period) => {
              const label = periodLabel(period);
              return (
                <li key={period.ids[0]} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <span>
                    <span className="font-[650] first-letter:uppercase">{label}</span>
                    {period.reason ? <span className="block text-sm text-mute">{period.reason}</span> : null}
                  </span>
                  <form action={removeClosureAction}>
                    {period.ids.map((id) => (
                      <input key={id} type="hidden" name="id" value={id} />
                    ))}
                    <button type="submit" className="btn min-h-11 px-3.5 text-sm" aria-label={t.closures.removeLabel(label)}>
                      {t.closures.remove}
                    </button>
                  </form>
                </li>
              );
            })}
          </ul>
        )}
        <ClosureForm today={settings.today} />
      </Card>
    </div>
  );
}
