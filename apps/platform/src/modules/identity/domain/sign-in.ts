import { z } from "zod";

/** Email del formulario de entrada (PLT-02), normalizado como lo guarda la plataforma. */
export const signInEmailSchema = z.string().trim().toLowerCase().max(254).pipe(z.email());

/** No se manda otro enlace al mismo email antes de este tiempo (protección frente a abusos). */
export const SIGN_IN_THROTTLE_MS = 60 * 1000;

export type RequestSignInLinkResult = { ok: true } | { ok: false; code: "SEND_FAILED" };
