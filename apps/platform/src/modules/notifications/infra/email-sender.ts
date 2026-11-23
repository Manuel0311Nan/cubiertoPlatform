import { EmailDeliveryError, type EmailMessage, type EmailSender } from "../domain/email";

const RESEND_API_URL = "https://api.resend.com/emails";

/** Resend por su API HTTP: no hace falta su SDK para enviar un email (CLAUDE.md §11, dependencias). */
export class ResendEmailSender implements EmailSender {
  constructor(
    private readonly apiKey: string,
    private readonly from: string,
  ) {}

  async send(message: EmailMessage, { idempotencyKey }: { idempotencyKey: string }): Promise<void> {
    let response: Response;
    try {
      response = await fetch(RESEND_API_URL, {
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
    } catch (error) {
      // Caída de red o timeout: puede ir bien al repetir.
      const reason = error instanceof Error ? error.name : "error de red";
      throw new EmailDeliveryError(`No se pudo contactar con Resend (${reason})`, true);
    }
    if (!response.ok) {
      // 429 y 5xx son pasajeros; un 4xx (API key, remitente, datos) no se arregla repitiendo.
      const retryable = response.status === 429 || response.status >= 500;
      throw new EmailDeliveryError(`Resend respondió ${response.status}`, retryable);
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
