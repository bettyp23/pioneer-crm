"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { z } from "zod";

import {
  addTaskSchema,
  createApprovalSchema,
  createClientSchema,
  createProjectSchema,
  deleteFileSchema,
  inviteClientUserSchema,
  moveTaskSchema,
  prepareUploadSchema,
  recordUploadSchema,
  removeClientUserSchema,
  safeFileName,
  updateProjectSchema,
  updateRequestSchema,
  withdrawApprovalSchema,
} from "@/features/client-admin/schemas";
import type { ActionResult } from "@/lib/action-result";
import { authorizeAction } from "@/server/auth/action-context";
import type { Permission } from "@/server/auth/permissions";
import { sendPortalInvite } from "@/server/auth/portal-invites";
import type { TablesInsert } from "@/server/db/database.types";
import { toUserMessage } from "@/server/db/errors";

// Staff Server Actions for the client portal. Each one re-checks the session and permission
// (authorizeAction) and re-validates input; the database checks workspace roles again (RLS
// and security-definer functions).

const BUCKET = "client-files";
const clientPath = (clientId: string) => `/dashboard/clients/${clientId}`;

async function run<S extends z.ZodType>(
  schema: S,
  input: FormData | Record<string, unknown>,
  permission: Permission,
) {
  const raw = input instanceof FormData ? Object.fromEntries(input.entries()) : input;
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Check the form" };
  }
  const auth = await authorizeAction(permission);
  if (!auth.ok) return auth;
  return { ok: true as const, data: parsed.data as z.infer<S>, ctx: auth.ctx };
}

export async function createClientRecord(formData: FormData): Promise<ActionResult> {
  const r = await run(createClientSchema, formData, "records.write");
  if (!r.ok) return r;
  const { data, error } = await r.ctx.supabase
    .from("clients")
    .insert({ workspace_id: r.ctx.member.workspaceId, name: r.data.name, status: "active" })
    .select("id")
    .single();
  if (error) return { ok: false, error: toUserMessage(error, "client.create") };
  redirect(clientPath(data.id));
}

// Sends the invite email, then links the new account to this client (owner only, MFA).
export async function inviteClientUser(formData: FormData): Promise<ActionResult> {
  const r = await run(inviteClientUserSchema, formData, "portal.invite");
  if (!r.ok) return r;
  // Confirm the client is in this workspace before an email goes out.
  const { data: client } = await r.ctx.supabase
    .from("clients")
    .select("id")
    .eq("id", r.data.clientId)
    .eq("workspace_id", r.ctx.member.workspaceId)
    .maybeSingle();
  if (!client) return { ok: false, error: "That client wasn't found." };

  const invite = await sendPortalInvite(r.data.email, r.data.displayName);
  if (!invite.ok) return invite;

  const { error } = await r.ctx.supabase.rpc("attach_portal_user", {
    p_user_id: invite.userId,
    p_client_id: r.data.clientId,
    p_display_name: r.data.displayName,
    p_email: r.data.email,
  });
  if (error) return { ok: false, error: toUserMessage(error, "portal.attach") };
  revalidatePath(clientPath(r.data.clientId));
  return { ok: true };
}

export async function removeClientUser(clientId: string, userId: string): Promise<ActionResult> {
  const r = await run(removeClientUserSchema, { userId }, "portal.invite");
  if (!r.ok) return r;
  const { error } = await r.ctx.supabase.rpc("detach_portal_user", { p_user_id: r.data.userId });
  if (error) return { ok: false, error: toUserMessage(error, "portal.detach") };
  revalidatePath(clientPath(clientId));
  return { ok: true };
}

export async function createProject(formData: FormData): Promise<ActionResult> {
  const r = await run(createProjectSchema, formData, "records.write");
  if (!r.ok) return r;
  const { error } = await r.ctx.supabase.rpc("create_portal_project", {
    p_client_id: r.data.clientId,
    p_name: r.data.name,
    p_start_on: r.data.startOn,
    p_launch_on: r.data.launchOn,
  });
  if (error) return { ok: false, error: toUserMessage(error, "project.create") };
  revalidatePath(clientPath(r.data.clientId));
  return { ok: true };
}

export async function updateProject(clientId: string, formData: FormData): Promise<ActionResult> {
  const r = await run(updateProjectSchema, formData, "records.write");
  if (!r.ok) return r;
  const { data, error } = await r.ctx.supabase
    .from("projects")
    .update({
      status: r.data.status,
      current_phase: r.data.currentPhase ?? null,
      next_steps: r.data.nextSteps ?? null,
      launch_on: r.data.launchOn ?? null,
    })
    .eq("id", r.data.projectId)
    .select("id");
  if (error) return { ok: false, error: toUserMessage(error, "project.update") };
  if (!data?.length) return { ok: false, error: "You don't have permission to do that." };
  revalidatePath(clientPath(clientId));
  return { ok: true };
}

export async function addTask(clientId: string, formData: FormData): Promise<ActionResult> {
  const r = await run(addTaskSchema, formData, "records.write");
  if (!r.ok) return r;
  const { error } = await r.ctx.supabase.rpc("add_project_task", {
    p_project_id: r.data.projectId,
    p_title: r.data.title,
    p_phase: r.data.phase,
    p_due_on: r.data.dueOn,
  });
  if (error) return { ok: false, error: toUserMessage(error, "task.create") };
  revalidatePath(clientPath(clientId));
  return { ok: true };
}

export async function moveTask(clientId: string, formData: FormData): Promise<ActionResult> {
  const r = await run(moveTaskSchema, formData, "records.write");
  if (!r.ok) return r;
  const { error } = await r.ctx.supabase.rpc("transition_task", {
    p_task_id: r.data.taskId,
    p_to_status: r.data.status,
    p_expected_version: r.data.version,
  });
  if (error) return { ok: false, error: toUserMessage(error, "task.transition") };
  revalidatePath(clientPath(clientId));
  return { ok: true };
}

export async function createApproval(clientId: string, formData: FormData): Promise<ActionResult> {
  const r = await run(createApprovalSchema, formData, "records.write");
  if (!r.ok) return r;
  const { error } = await r.ctx.supabase.rpc("create_client_approval", {
    p_project_id: r.data.projectId,
    p_title: r.data.title,
    p_details: r.data.details,
  });
  if (error) return { ok: false, error: toUserMessage(error, "approval.create") };
  revalidatePath(clientPath(clientId));
  return { ok: true };
}

export async function withdrawApproval(
  clientId: string,
  formData: FormData,
): Promise<ActionResult> {
  const r = await run(withdrawApprovalSchema, formData, "records.write");
  if (!r.ok) return r;
  const { error } = await r.ctx.supabase.rpc("decide_approval", {
    p_approval_id: r.data.approvalId,
    p_decision: "withdrawn",
    p_expected_version: r.data.version,
    p_note: "Withdrawn by Pioneer Digital AI",
  });
  if (error) return { ok: false, error: toUserMessage(error, "approval.withdraw") };
  revalidatePath(clientPath(clientId));
  return { ok: true };
}

export async function updateRequest(clientId: string, formData: FormData): Promise<ActionResult> {
  const r = await run(updateRequestSchema, formData, "records.write");
  if (!r.ok) return r;
  const { data, error } = await r.ctx.supabase
    .from("client_requests")
    .update({ status: r.data.status, admin_reply: r.data.reply ?? null })
    .eq("id", r.data.requestId)
    .select("id");
  if (error) return { ok: false, error: toUserMessage(error, "request.update") };
  if (!data?.length) return { ok: false, error: "You don't have permission to do that." };
  revalidatePath(clientPath(clientId));
  return { ok: true };
}

// Upload step 1: a one-time signed upload URL for "<client_id>/<random>/<file name>".
// The browser sends the bytes straight to Storage (no size limit from this server), and
// Storage checks the staff insert policy when the URL is created.
export async function prepareFileUpload(
  input: Record<string, unknown>,
): Promise<ActionResult<{ path: string; token: string }>> {
  const r = await run(prepareUploadSchema, input, "records.write");
  if (!r.ok) return r;
  const path = `${r.data.clientId}/${crypto.randomUUID()}/${safeFileName(r.data.fileName)}`;
  const { data, error } = await r.ctx.supabase.storage.from(BUCKET).createSignedUploadUrl(path);
  if (error || !data) {
    console.warn("client_file.prepare_failed", { name: error?.name });
    return { ok: false, error: "Could not start the upload. Try again." };
  }
  return { ok: true, data: { path: data.path, token: data.token } };
}

// Upload step 2: record the file so the client can see it (after the bytes arrived).
export async function recordFileUpload(input: Record<string, unknown>): Promise<ActionResult> {
  const r = await run(recordUploadSchema, input, "records.write");
  if (!r.ok) return r;
  if (!r.data.path.startsWith(`${r.data.clientId}/`)) {
    return { ok: false, error: "That upload doesn't belong to this client." };
  }
  const { data: exists } = await r.ctx.supabase.storage.from(BUCKET).exists(r.data.path);
  if (!exists) return { ok: false, error: "The upload didn't finish. Try again." };

  const row: Omit<TablesInsert<"client_files">, "workspace_id"> = {
    client_id: r.data.clientId,
    project_id: r.data.projectId ?? null,
    title: r.data.title,
    storage_path: r.data.path,
    file_name: r.data.fileName,
    content_type: r.data.contentType || null,
    size_bytes: r.data.size,
  };
  const { error } = await r.ctx.supabase
    .from("client_files")
    .insert(row as TablesInsert<"client_files">);
  if (error) return { ok: false, error: toUserMessage(error, "client_file.record") };
  revalidatePath(clientPath(r.data.clientId));
  return { ok: true };
}

export async function deleteClientFile(clientId: string, fileId: string): Promise<ActionResult> {
  const r = await run(deleteFileSchema, { fileId }, "records.write");
  if (!r.ok) return r;
  const { data: file, error: readError } = await r.ctx.supabase
    .from("client_files")
    .delete()
    .eq("id", r.data.fileId)
    .select("storage_path")
    .maybeSingle();
  if (readError) return { ok: false, error: toUserMessage(readError, "client_file.delete") };
  if (!file) return { ok: false, error: "That file wasn't found." };
  const { error } = await r.ctx.supabase.storage.from(BUCKET).remove([file.storage_path]);
  if (error) console.warn("client_file.object_delete_failed", { name: error.name });
  revalidatePath(clientPath(clientId));
  return { ok: true };
}
