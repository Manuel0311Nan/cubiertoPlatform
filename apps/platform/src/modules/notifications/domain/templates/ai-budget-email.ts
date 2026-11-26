import { es } from "@/i18n/es";
import type { EmailMessage } from "../email";
import { actionEmailHtml } from "./layout";

const euros = (micros: number) =>
  new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(micros / 1_000_000);

/** AI-04: el gasto de IA de la plataforma llega al 80 % o al 100 % del tope del mes. */
export function aiBudgetEmail(input: { to: string; month: string; threshold: number; spentMicros: number; budgetMicros: number; url: string }): EmailMessage {
  const t = es.email.aiBudget;
  const title = t.title(input.threshold);
  const body = t.body(euros(input.spentMicros), euros(input.budgetMicros), input.month, input.threshold >= 100);
  const text = [title, "", body, "", input.url].join("\n");
  const html = actionEmailHtml({ title, body, cta: t.cta, url: input.url, fallback: t.fallback, footer: t.footer });
  return { to: input.to, subject: t.subject(input.threshold), text, html };
}
