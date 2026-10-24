"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { resumeConnectionSchema, sendMessageSchema } from "@/features/chat/schemas";
import type { ActionResult } from "@/lib/action-result";
import { SENSITIVITY_LABELS, scanForSensitiveContent } from "@/lib/ai/sensitivity";
import { authorizeAction } from "@/server/auth/action-context";
import { toUserMessage } from "@/server/db/errors";

const firstIssue = (e?: z.ZodError) => e?.issues[0]?.message ?? "Invalid input";

// The message leaves Pioneer (to Claude or Michael Scott), so it is scanned first. Flagged text
// is only sent after the owner sees the warning and confirms; the database records that it was
// flagged. The send itself happens in the worker, never here.
export async function sendMessage(
  input: unknown,
): Promise<ActionResult<{ sent: boolean; warnings: string[] }>> {
  const parsed = sendMessageSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const auth = await authorizeAction("agents.dispatch");
  if (!auth.ok) return auth;
  const { body, recipient, confirmFlagged } = parsed.data;

  const warnings = [
    ...new Set(scanForSensitiveContent(body).map((f) => SENSITIVITY_LABELS[f.kind])),
  ];
  if (warnings.length > 0 && !confirmFlagged) return { ok: true, data: { sent: false, warnings } };

  const { error } = await auth.ctx.supabase.rpc("send_message", {
    p_workspace_id: auth.ctx.member.workspaceId,
    p_body: body,
    p_recipient: recipient,
    p_flagged: warnings.length > 0,
  });
  if (error) return { ok: false, error: toUserMessage(error, "message.send") };
  revalidatePath("/pioneer");
  return { ok: true, data: { sent: true, warnings } };
}

// Loop brake (D-33): only the owner resumes a paused connection; the database re-checks.
export async function resumeConnection(input: unknown): Promise<ActionResult> {
  const parsed = resumeConnectionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const auth = await authorizeAction("agents.kill_switch");
  if (!auth.ok) return auth;
  const { error } = await auth.ctx.supabase.rpc("resume_connection", {
    p_workspace_id: auth.ctx.member.workspaceId,
    p_connection: parsed.data.connection,
  });
  if (error) return { ok: false, error: toUserMessage(error, "connection.resume") };
  revalidatePath("/", "layout");
  return { ok: true };
}
