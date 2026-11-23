import { es } from "@/i18n/es";
import type { EmailMessage } from "../email";
import { actionEmailHtml } from "./layout";

export type InvitationRole = "OWNER" | "STAFF";

/** Email de invitación al panel de un local (PLT-01, PLT-02 y PLT-03). */
export function invitationEmail(input: { to: string; tenantName: string; role: InvitationRole; url: string }): EmailMessage {
  const t = es.email.invitation;
  const title = t.title(input.tenantName);
  const body = t.body(input.tenantName, t.roles[input.role]);
  const text = [title, "", body, "", input.url, "", t.ignore].join("\n");
  const html = actionEmailHtml({ title, body, cta: t.cta, url: input.url, fallback: t.fallback, footer: t.ignore });
  return { to: input.to, subject: t.subject(input.tenantName), text, html };
}
