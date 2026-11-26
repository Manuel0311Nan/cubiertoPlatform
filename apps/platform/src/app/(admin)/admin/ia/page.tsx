import { AI_ERROR_CODES, AI_TIERS, isModelAvailable, readAiConfig, type AiTier } from "@cubierto/ai";
import type { Metadata } from "next";
import { es } from "@/i18n/es";
import { testAiConnectionAction } from "@/modules/ai/actions";
import { getPlatformAiUsage } from "@/modules/ai/application/usage";
import { SubmitButton } from "@/ui/forms/submit-button";

const t = es.admin.ai;

export const metadata: Metadata = { title: t.metaTitle };
export const dynamic = "force-dynamic";

const euros = (micros: number) =>
  new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(micros / 1_000_000);

function isTier(value: string | undefined): value is AiTier {
  return (AI_TIERS as readonly string[]).includes(value ?? "");
}

function TestResult({ params }: { params: { prueba?: string; modelo?: string; ms?: string; error?: string } }) {
  if (!isTier(params.prueba)) return null;
  const tier = t.tiers[params.prueba];
  if (params.modelo) {
    return (
      <p role="status" className="rounded-xl border-2 border-bottle bg-[#e6efe9] p-3 text-sm leading-snug">
        {t.testOk(tier, params.modelo, Number(params.ms) || 0)}
      </p>
    );
  }
  const code = (AI_ERROR_CODES as readonly string[]).includes(params.error ?? "") ? params.error! : "AI_PROVIDER_ERROR";
  return (
    <p role="alert" className="rounded-xl border-2 border-tomato bg-tomato-soft p-3 text-sm leading-snug text-tomato-ink">
      {t.testFailed(tier, code)}
    </p>
  );
}

/** AI-01 · Superadmin → IA: modelos por nivel, "Probar conexión" y gasto del mes (el panel completo es AI-09). */
export default async function AiAdminPage({ searchParams }: { searchParams: Promise<{ prueba?: string; modelo?: string; ms?: string; error?: string }> }) {
  const [params, usage] = await Promise.all([searchParams, getPlatformAiUsage()]);
  const config = readAiConfig();
  const percent = usage.budgetMicros ? Math.round((usage.spentMicros / usage.budgetMicros) * 100) : 0;

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-7 md:px-8">
      <div>
        <h1 className="text-[2rem] leading-[1.05] font-[750] tracking-[-0.03em]">{t.title}</h1>
        <p className="mt-1 max-w-[62ch] text-mute">{t.intro}</p>
        <p className="mt-2 text-sm font-[650]">{t.mode[config.mode]}</p>
      </div>

      <TestResult params={params} />

      <section aria-labelledby="tiers-title" className="flex flex-col gap-3">
        <div>
          <h2 id="tiers-title" className="text-[1.5rem] font-[750] tracking-[-0.02em]">
            {t.tiersTitle}
          </h2>
          <p className="text-sm text-mute">{t.tiersHint}</p>
        </div>
        <div className="overflow-x-auto rounded-2xl border border-line bg-white">
          <table className="w-full border-collapse text-left text-[0.9375rem]">
            <thead className="text-sm text-mute">
              <tr className="border-b border-line">
                <th scope="col" className="px-4 py-3 font-[650]">{t.columns.tier}</th>
                <th scope="col" className="px-4 py-3 font-[650]">{t.columns.model}</th>
                <th scope="col" className="px-4 py-3 font-[650]">{t.columns.fallback}</th>
                <th scope="col" className="px-4 py-3 font-[650]">{t.columns.status}</th>
                <th scope="col" className="px-4 py-3">
                  <span className="sr-only">{t.columns.actions}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {AI_TIERS.map((tier) => {
                const model = config.models[tier];
                const fallback = config.fallbacks[tier];
                const available = isModelAvailable(model, config) || (fallback !== undefined && isModelAvailable(fallback, config));
                return (
                  <tr key={tier} className="border-b border-line last:border-b-0">
                    <th scope="row" className="px-4 py-3 font-[700]">{t.tiers[tier]}</th>
                    <td className="px-4 py-3 font-mono text-sm break-all">{model.ref}</td>
                    <td className="px-4 py-3 text-sm break-all">{fallback ? <span className="font-mono">{fallback.ref}</span> : <span className="text-mute">{t.noFallback}</span>}</td>
                    <td className={`px-4 py-3 text-sm ${available ? "" : "text-tomato-ink"}`}>{available ? t.available : t.unavailable}</td>
                    <td className="px-4 py-3 text-right">
                      <form action={testAiConnectionAction}>
                        <input type="hidden" name="tier" value={tier} />
                        <SubmitButton className="btn min-h-10 px-3.5 text-sm whitespace-nowrap" pendingLabel={t.testing} aria-label={t.testLabel(t.tiers[tier])}>
                          {t.test}
                        </SubmitButton>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="spend-title" className="flex flex-col gap-1">
        <h2 id="spend-title" className="text-[1.5rem] font-[750] tracking-[-0.02em]">
          {t.spendTitle}
        </h2>
        <p>{t.spend(euros(usage.spentMicros))}</p>
        <p className="text-sm text-mute">{usage.budgetMicros ? t.globalBudget(euros(usage.budgetMicros), percent) : t.noGlobalBudget}</p>
      </section>
    </main>
  );
}
