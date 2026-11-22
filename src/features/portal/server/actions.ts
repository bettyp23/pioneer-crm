"use server";

import { revalidatePath } from "next/cache";

import { respondToApprovalSchema, submitRequestSchema } from "@/features/portal/schemas";
import type { ActionResult } from "@/lib/action-result";
import { requireClient } from "@/server/auth/session";
import type { TablesInsert } from "@/server/db/database.types";
import { toUserMessage } from "@/server/db/errors";

// Server Actions are public HTTP endpoints: each one re-checks the session (requireClient)
// and re-validates input. The database independently limits clients to their own client_id.

// workspace_id (and client_id for responses) are filled in by database triggers from the
// approval or client record; clients have no privilege to send them.
type ResponseInsert = Omit<TablesInsert<"approval_responses">, "workspace_id" | "client_id">;
type RequestInsert = Omit<TablesInsert<"client_requests">, "workspace_id">;

const fields = (formData: FormData) => Object.fromEntries(formData.entries());
const firstIssue = (issues: { message: string }[]) => issues[0]?.message ?? "Check the form";

export async function respondToApproval(formData: FormData): Promise<ActionResult> {
  const parsed = respondToApprovalSchema.safeParse(fields(formData));
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error.issues) };
  const { supabase } = await requireClient();

  const row: ResponseInsert = {
    approval_id: parsed.data.approvalId,
    decision: parsed.data.decision,
    comment: parsed.data.comment || null,
  };
  const { error } = await supabase
    .from("approval_responses")
    .insert(row as TablesInsert<"approval_responses">);
  if (error) return { ok: false, error: toUserMessage(error, "portal.approval_response") };
  revalidatePath("/portal", "layout");
  return { ok: true };
}

export async function submitRequest(formData: FormData): Promise<ActionResult> {
  const parsed = submitRequestSchema.safeParse(fields(formData));
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error.issues) };
  const { supabase, user } = await requireClient();

  const row: RequestInsert = {
    client_id: user.client.id,
    project_id: parsed.data.projectId ?? null,
    kind: parsed.data.kind,
    subject: parsed.data.subject,
    body: parsed.data.body,
  };
  const { error } = await supabase
    .from("client_requests")
    .insert(row as TablesInsert<"client_requests">);
  if (error) return { ok: false, error: toUserMessage(error, "portal.request") };
  revalidatePath("/portal", "layout");
  return { ok: true };
}
