import type { EmailSender } from "../domain/email";
import { sendWithRetry } from "../domain/retry";
import { magicLinkEmail } from "../domain/templates/magic-link-email";
import { getEmailSender } from "../infra/email-sender";

/**
 * PLT-02: el enlace de entrada se envía directo, sin outbox ni cron (decisión del 22/11/2026).
 *
 * Es la excepción a CLAUDE.md §6.5: no acompaña a ningún cambio de datos propio (el token lo guarda
 * Better Auth) y caduca en 15 minutos, así que un reintento minutos después ya no sirve. Se repite
 * un par de veces al momento si el fallo es pasajero; si aun así no sale, lanza: la persona ve
 * "No hemos podido enviar el enlace" y pide otro. El enlace no se guarda en ninguna tabla nuestra.
 */
export async function sendMagicLinkEmail(
  input: { to: string; url: string },
  deps: { email?: EmailSender; sleep?: (ms: number) => Promise<void> } = {},
): Promise<void> {
  await sendWithRetry(deps.email ?? getEmailSender(), magicLinkEmail(input), {
    // Una clave por enlace: si un intento llegó a Resend aunque no contestara, no se duplica.
    idempotencyKey: `magic-link/${crypto.randomUUID()}`,
    sleep: deps.sleep,
  });
}
