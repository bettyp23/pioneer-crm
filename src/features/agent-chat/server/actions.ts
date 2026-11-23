"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";

import { sendAgentMessageSchema } from "@/features/agent-chat/schemas";
import type { ActionResult } from "@/lib/action-result";
import { SENSITIVITY_LABELS, scanForSensitiveContent } from "@/lib/ai/sensitivity";
import { authorizeAction } from "@/server/auth/action-context";
import { dispatchAgentMessage } from "@/server/agents/dispatch";
import { toUserMessage } from "@/server/db/errors";

// Saves the owner's message (database checks role, MFA and the kill switch), then sends it after
// the response: to Michael's webhook, or to Hermes. The chat updates live as replies arrive.
// The message leaves Pioneer, so it is scanned first; flagged text needs the owner's confirmation.
export async function sendAgentMessage(
  input: unknown,
): Promise<ActionResult<{ sent: boolean; warnings: string[] }>> {
  const parsed = sendAgentMessageSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const auth = await authorizeAction("agents.dispatch");
  if (!auth.ok) return auth;
  const { agent, body, confirmFlagged } = parsed.data;

  const warnings = [
    ...new Set(scanForSensitiveContent(body).map((f) => SENSITIVITY_LABELS[f.kind])),
  ];
  if (warnings.length > 0 && !confirmFlagged) return { ok: true, data: { sent: false, warnings } };

  const { data, error } = await auth.ctx.supabase
    .rpc("send_agent_message", {
      p_workspace_id: auth.ctx.member.workspaceId,
      p_agent: agent,
      p_body: body,
      p_flagged: warnings.length > 0,
    })
    .single();
  if (error || !data) return { ok: false, error: toUserMessage(error, "message.send") };

  after(() => dispatchAgentMessage(agent, data.message_id));
  revalidatePath("/dashboard");
  return { ok: true, data: { sent: true, warnings } };
}
