"use server";

import { revalidatePath } from "next/cache";

import { activityFormSchema } from "@/features/activities/schemas";
import type { ActionResult } from "@/lib/action-result";
import { zonedLocalToUtc } from "@/lib/dates";
import { authorizeAction } from "@/server/auth/action-context";
import { toUserMessage } from "@/server/db/errors";

export async function logActivity(input: unknown): Promise<ActionResult> {
  const parsed = activityFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid" };
  const auth = await authorizeAction("records.write");
  if (!auth.ok) return auth;
  const { supabase, member } = auth.ctx;

  const { occurred_at_local, ...rest } = parsed.data;
  const occurredAt = zonedLocalToUtc(occurred_at_local, member.workspaceTimezone);
  if (!occurredAt) return { ok: false, error: "Choose a valid date and time" };

  const { error } = await supabase.from("activities").insert({
    ...rest,
    occurred_at: occurredAt.toISOString(),
    workspace_id: member.workspaceId,
  });
  if (error) return { ok: false, error: toUserMessage(error, "activity.create") };

  revalidatePath("/", "layout");
  return { ok: true };
}
