import { es } from "@/i18n/es";
import type { EmailMessage } from "../email";
import { actionEmailHtml } from "./layout";

/** Email con el enlace de entrada (PLT-02). */
export function magicLinkEmail({ to, url }: { to: string; url: string }): EmailMessage {
  const t = es.email.magicLink;
  const text = [t.title, "", t.body, "", url, "", t.ignore].join("\n");
  const html = actionEmailHtml({ title: t.title, body: t.body, cta: t.cta, url, fallback: t.fallback, footer: t.ignore });
  return { to, subject: t.subject, text, html };
}
