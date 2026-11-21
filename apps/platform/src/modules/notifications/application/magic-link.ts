import { enqueueAndDispatch, MAGIC_LINK_EVENT, type OutboxDeps } from "./outbox";

/**
 * PLT-02: el enlace de entrada sale por el outbox y se envía al momento; si Resend falla, el cron
 * lo reintenta mientras el enlace no haya caducado (decisión del 22/11/2026).
 */
export function sendMagicLinkEmail(input: { to: string; url: string; expiresAt: Date }, deps?: OutboxDeps) {
  return enqueueAndDispatch(
    {
      tenantId: null,
      type: MAGIC_LINK_EVENT,
      payload: { to: input.to, url: input.url, expiresAt: input.expiresAt.toISOString() },
    },
    deps,
  );
}
