import type { OutboxHandler } from "./outbox";

/**
 * Tipos de evento del outbox y cómo se entrega cada uno (PLT-08).
 *
 * Vacío hasta F3: los primeros serán los de reservas (`reservation.created`, RES-03 y RES-04;
 * `reservation.reminder`, RES-05). El enlace de entrada no va por el outbox (PLT-02).
 */
export const OUTBOX_HANDLERS: Readonly<Record<string, OutboxHandler>> = {};
