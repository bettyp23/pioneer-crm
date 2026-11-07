"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { aiPauseSchema } from "@/features/agents/schemas";
import type { ActionResult } from "@/lib/action-result";
import { authorizeAction } from "@/server/auth/action-context";
import { toUserMessage } from "@/server/db/errors";

const firstIssue = (e?: z.ZodError) => e?.issues[0]?.message ?? "Invalid input";

// Kill switch (D-26): owner only; the database re-checks role and MFA and audits the change.
export async function setAiPaused(input: unknown): Promise<ActionResult> {
  const parsed = aiPauseSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const auth = await authorizeAction("agents.kill_switch");
  if (!auth.ok) return auth;
  const { error } = await auth.ctx.supabase.rpc("set_ai_paused", {
    p_workspace_id: auth.ctx.member.workspaceId,
    p_paused: parsed.data.paused,
    p_reason: parsed.data.reason ?? undefined,
  });
  if (error) return { ok: false, error: toUserMessage(error, "ai.pause") };
  revalidatePath("/", "layout");
  return { ok: true };
}
