export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface EmailSender {
  /** `idempotencyKey` evita enviar dos veces el mismo evento si un reintento repite el envío. */
  send(message: EmailMessage, options: { idempotencyKey: string }): Promise<void>;
}
