export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface EmailSender {
  /** `idempotencyKey` evita enviar dos veces el mismo email si un reintento repite el envío. */
  send(message: EmailMessage, options: { idempotencyKey: string }): Promise<void>;
}

/**
 * Fallo al enviar un email. `retryable` dice si vale la pena repetir el envío: sí ante una caída
 * de red, un timeout, un 429 o un 5xx; no ante un 4xx (API key mala, remitente sin verificar…).
 */
export class EmailDeliveryError extends Error {
  override name = "EmailDeliveryError";

  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
  }
}

/** Un error desconocido (sin `retryable`) se reintenta: lo normal es que sea de red. */
export function isRetryableEmailError(error: unknown): boolean {
  return error instanceof EmailDeliveryError ? error.retryable : true;
}
