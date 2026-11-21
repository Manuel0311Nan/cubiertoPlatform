import type { EmailMessage, EmailSender } from "../domain/email";

const RESEND_API_URL = "https://api.resend.com/emails";

/** Resend por su API HTTP: no hace falta su SDK para enviar un email (CLAUDE.md §11, dependencias). */
export class ResendEmailSender implements EmailSender {
  constructor(
    private readonly apiKey: string,
    private readonly from: string,
  ) {}

  async send(message: EmailMessage, { idempotencyKey }: { idempotencyKey: string }): Promise<void> {
    const response = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify({
        from: this.from,
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      throw new Error(`Resend respondió ${response.status}`);
    }
  }
}

/** En local, sin RESEND_API_KEY: el email (y el enlace de entrada) sale en la consola (00-necesidades §3). */
export class ConsoleEmailSender implements EmailSender {
  async send(message: EmailMessage): Promise<void> {
    console.info(`\n[email] Para: ${message.to}\n[email] Asunto: ${message.subject}\n${message.text}\n`);
  }
}

export function getEmailSender(): EmailSender {
  const apiKey = process.env.RESEND_API_KEY;
  if (apiKey) {
    const from = process.env.EMAIL_FROM;
    if (!from) throw new Error("Falta EMAIL_FROM para enviar emails con Resend.");
    return new ResendEmailSender(apiKey, from);
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("Falta RESEND_API_KEY: en producción los emails no pueden salir por la consola.");
  }
  return new ConsoleEmailSender();
}
