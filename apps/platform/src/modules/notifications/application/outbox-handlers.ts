import { INVITATION_EVENT, invitationHandler } from "./handlers/invitation";
import type { OutboxHandler } from "./outbox-handler";

/**
 * Tipos de evento del outbox y cómo se entrega cada uno (PLT-08). Un tipo que no esté aquí
 * queda FAILED al enviarse. El enlace de entrada no va por el outbox (PLT-02).
 *
 * Siguientes: los de reservas en F3 (`reservation.created`, RES-03 y RES-04;
 * `reservation.reminder`, RES-05).
 */
export const OUTBOX_HANDLERS: Readonly<Record<string, OutboxHandler>> = {
  [INVITATION_EVENT]: invitationHandler,
};
