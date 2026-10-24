"use server";

import { revalidatePath } from "next/cache";

import { updateWorkspaceSchema } from "@/features/workspace/schemas";
import { ForbiddenError, requireRole } from "@/server/auth/session";

export type UpdateWorkspaceResult = { ok: true } | { ok: false; error: string };

// validate → authorize → write (RLS re-checks owner + MFA) → revalidate.
// The audit event is written by the database trigger.
export async function updateWorkspace(input: unknown): Promise<UpdateWorkspaceResult> {
  const parsed = updateWorkspaceSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  let ctx;
  try {
    ctx = await requireRole("workspace.manage");
  } catch (e) {
    if (e instanceof ForbiddenError) {
      return { ok: false, error: "Only the workspace owner can change these settings." };
    }
    throw e;
  }

  const { data, error } = await ctx.supabase
    .from("workspaces")
    .update(parsed.data)
    .eq("id", ctx.member.workspaceId)
    .select("id");
  if (error?.code === "23514") {
    return { ok: false, error: "Choose a valid timezone and a non-blank name." };
  }
  if (error) {
    console.error("workspace.update_failed", { code: error.code });
    return { ok: false, error: "Could not save settings. Try again." };
  }
  if (data.length === 0) {
    return { ok: false, error: "Only the workspace owner can change these settings." };
  }

  revalidatePath("/", "layout");
  return { ok: true };
}
