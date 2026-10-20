"use server";

import { revalidatePath } from "next/cache";

import { followUpFormSchema, followUpStatusSchema } from "@/features/follow-ups/schemas";
import type { ActionResult } from "@/lib/action-result";
import { authorizeAction } from "@/server/auth/action-context";
import { toUserMessage } from "@/server/db/errors";

export async function createFollowUp(input: unknown): Promise<ActionResult> {
  const parsed = followUpFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid" };
  const auth = await authorizeAction("records.write");
  if (!auth.ok) return auth;
  const { supabase, member } = auth.ctx;

  const { error } = await supabase
    .from("follow_ups")
    .insert({ ...parsed.data, workspace_id: member.workspaceId });
  if (error) return { ok: false, error: toUserMessage(error, "follow_up.create") };

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function setFollowUpStatus(input: unknown): Promise<ActionResult> {
  const parsed = followUpStatusSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" };
  const auth = await authorizeAction("records.write");
  if (!auth.ok) return auth;
  const { supabase, member } = auth.ctx;

  const { data, error } = await supabase
    .from("follow_ups")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.id)
    .eq("workspace_id", member.workspaceId)
    .select("id");
  if (error) return { ok: false, error: toUserMessage(error, "follow_up.status") };
  if (data.length === 0) return { ok: false, error: "Follow-up not found." };

  revalidatePath("/", "layout");
  return { ok: true };
}
