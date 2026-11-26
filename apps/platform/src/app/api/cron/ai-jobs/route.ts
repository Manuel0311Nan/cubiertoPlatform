import { processDueAiJobs } from "@/modules/ai/application/jobs";

export const dynamic = "force-dynamic";
// Un trabajo de IA puede tardar: hasta 5 minutos en Vercel Pro.
export const maxDuration = 300;

/**
 * AI-05: barrido de los trabajos de IA pendientes o que quedaron a medias, protegido con
 * `Authorization: Bearer <CRON_SECRET>`. Como el outbox (PLT-08), sin cron cada minuto: lo
 * programará el cron diario cuando haya trabajos reales (MENU-07, F2).
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  return Response.json(await processDueAiJobs());
}
