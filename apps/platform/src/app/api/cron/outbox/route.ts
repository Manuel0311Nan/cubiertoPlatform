import { processDueOutboxEvents } from "@/modules/notifications/application/outbox";

export const dynamic = "force-dynamic";

/** PLT-08: Vercel Cron lo llama cada minuto (vercel.json) con `Authorization: Bearer <CRON_SECRET>`. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  return Response.json(await processDueOutboxEvents());
}
