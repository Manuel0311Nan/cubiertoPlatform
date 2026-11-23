import { processDueOutboxEvents } from "@/modules/notifications/application/outbox";

export const dynamic = "force-dynamic";

/**
 * PLT-08: barrido del outbox, protegido con `Authorization: Bearer <CRON_SECRET>`.
 *
 * Sin programar en vercel.json desde el 22/11/2026: el login ya no usa el outbox y no hay otros
 * eventos hasta F3. Con reservas lo llamará el cron diario como red de seguridad (PLT-08, "Envíos
 * sin cron cada minuto"); mientras, se puede llamar a mano con el secreto.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  return Response.json(await processDueOutboxEvents());
}
