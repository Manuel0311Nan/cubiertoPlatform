import { randomBytes } from "node:crypto";

/**
 * Token del QR de una mesa (PLT-05): aleatorio y no adivinable, 128 bits en 22 caracteres para que
 * el QR sea sencillo. Solo servidor: aparte de `tables.ts`, que también usa el navegador.
 */
export function newQrToken(): string {
  return randomBytes(16).toString("base64url");
}
