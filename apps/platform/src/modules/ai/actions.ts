"use server";

import { AI_TIERS, type AiTier } from "@cubierto/ai";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireSuperadmin } from "@/modules/identity/session";
import { runAiTask } from "./application/run-ai-task";
import { AI_ADMIN_PATH } from "./domain/admin";
import { systemPingV1 } from "./tasks/system-ping/v1";

const tierSchema = z.enum(AI_TIERS);

/** AI-01: "Probar conexión" del nivel elegido. Solo el superadmin; queda como uso interno. */
export async function testAiConnectionAction(formData: FormData) {
  await requireSuperadmin();
  const parsed = tierSchema.safeParse(formData.get("tier"));
  if (!parsed.success) redirect(AI_ADMIN_PATH);
  const tier: AiTier = parsed.data;
  const started = Date.now();
  const result = await runAiTask(null, systemPingV1, {}, { tier });
  const params = new URLSearchParams({ prueba: tier });
  if (result.ok) {
    params.set("modelo", result.usage.model);
    params.set("ms", String(Date.now() - started));
  } else {
    params.set("error", result.code);
  }
  redirect(`${AI_ADMIN_PATH}?${params}`);
}
