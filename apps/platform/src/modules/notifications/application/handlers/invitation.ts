import { invitationEmail, type InvitationRole } from "../../domain/templates/invitation-email";
import { NonRetryableError, requireString, type OutboxHandler } from "../outbox-handler";

/** PLT-01 y PLT-02: el email con el enlace para aceptar una invitación al panel de un local. */
export const INVITATION_EVENT = "invitation.created";

/** Lo que guarda el evento hasta enviarse. `url` lleva el token: se borra al enviar o fallar. */
export interface InvitationEventPayload {
  invitationId: string;
  to: string;
  tenantName: string;
  role: InvitationRole;
  url: string;
  expiresAt: string;
}

function roleOf(value: string): InvitationRole {
  if (value === "OWNER" || value === "STAFF") return value;
  throw new NonRetryableError(`Papel desconocido en la invitación: ${value}`);
}

export const invitationHandler: OutboxHandler = {
  async deliver(payload, { eventId, email, now }) {
    // Una invitación caducada no se manda: el enlace ya no serviría (PLT-02).
    if (now().getTime() >= Date.parse(requireString(payload, "expiresAt"))) {
      throw new NonRetryableError("La invitación ha caducado");
    }
    const message = invitationEmail({
      to: requireString(payload, "to"),
      tenantName: requireString(payload, "tenantName"),
      role: roleOf(requireString(payload, "role")),
      url: requireString(payload, "url"),
    });
    await email.send(message, { idempotencyKey: eventId });
  },
  redact: (payload) => ({
    invitationId: typeof payload.invitationId === "string" ? payload.invitationId : null,
    to: typeof payload.to === "string" ? payload.to : null,
    redacted: true,
  }),
};
