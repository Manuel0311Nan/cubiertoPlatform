import { es } from "@/i18n/es";
import type { EmailMessage } from "../email";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/** Email con el enlace de entrada (PLT-02). Colores de la marca Cubierto (specs/diseno/README.md §2). */
export function magicLinkEmail({ to, url }: { to: string; url: string }): EmailMessage {
  const t = es.email.magicLink;
  const href = escapeHtml(url);

  const text = [t.title, "", t.body, "", url, "", t.ignore].join("\n");

  const html = `<!doctype html>
<html lang="es">
<body style="margin:0;background:#F7F8F5;font-family:'Bricolage Grotesque',Helvetica,Arial,sans-serif;color:#14281F">
  <div style="max-width:480px;margin:0 auto;padding:32px 20px">
    <div style="background:#FFFFFF;border:1px solid #C9D6CF;border-radius:16px;padding:32px">
      <p style="margin:0 0 24px;font-size:20px;font-weight:800;letter-spacing:-0.03em;color:#1D4A3A">cubierto</p>
      <h1 style="margin:0 0 12px;font-size:26px;line-height:1.1;letter-spacing:-0.03em">${escapeHtml(t.title)}</h1>
      <p style="margin:0 0 24px;font-size:16px;line-height:1.5">${escapeHtml(t.body)}</p>
      <p style="margin:0 0 24px"><a href="${href}" style="display:inline-block;background:#E8A317;color:#14281F;font-weight:700;font-size:17px;padding:15px 24px;border-radius:999px;text-decoration:none">${escapeHtml(t.cta)}</a></p>
      <p style="margin:0 0 6px;font-size:13px;line-height:1.4;color:#4B6158">${escapeHtml(t.fallback)}</p>
      <p style="margin:0 0 24px;font-size:13px;line-height:1.4;word-break:break-all"><a href="${href}" style="color:#1D4A3A">${href}</a></p>
      <p style="margin:0;font-size:13px;line-height:1.4;color:#4B6158">${escapeHtml(t.ignore)}</p>
    </div>
  </div>
</body>
</html>`;

  return { to, subject: t.subject, text, html };
}
