"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import {
  decideApprovalSchema,
  generateProjectSchema,
  inputStatusSchema,
  projectStatusSchema,
  signSowSchema,
  sowFormSchema,
  sowStatusSchema,
  taskDetailsSchema,
  transitionSchema,
} from "@/features/projects/schemas";
import type { ActionResult } from "@/lib/action-result";
import { authorizeAction } from "@/server/auth/action-context";
import { toUserMessage } from "@/server/db/errors";

// Rule-bearing changes go through database functions (transition_task, decide_approval, …),
// which re-check role, MFA and state; these actions validate input and map errors.

const firstIssue = (e?: z.ZodError) => e?.issues[0]?.message ?? "Invalid input";

// ── SOWs ────────────────────────────────────────────────────────────────────

export async function createSow(input: unknown): Promise<ActionResult> {
  const parsed = sowFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const auth = await authorizeAction("records.write");
  if (!auth.ok) return auth;
  const { error } = await auth.ctx.supabase
    .from("sow_documents")
    .insert({ ...parsed.data, workspace_id: auth.ctx.member.workspaceId });
  if (error) return { ok: false, error: toUserMessage(error, "sow.create") };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function signSow(input: unknown): Promise<ActionResult> {
  const parsed = signSowSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const auth = await authorizeAction("sow.record_signed");
  if (!auth.ok) return auth;
  const { id, ...fields } = parsed.data;
  const { data, error } = await auth.ctx.supabase
    .from("sow_documents")
    .update({ ...fields, status: "signed" })
    .eq("id", id)
    .eq("workspace_id", auth.ctx.member.workspaceId)
    .select("id");
  if (error) return { ok: false, error: toUserMessage(error, "sow.sign") };
  if (data.length === 0) return { ok: false, error: "SOW not found." };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function setSowStatus(input: unknown): Promise<ActionResult> {
  const parsed = sowStatusSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" };
  const auth = await authorizeAction("records.write");
  if (!auth.ok) return auth;
  const { data, error } = await auth.ctx.supabase
    .from("sow_documents")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.id)
    .eq("workspace_id", auth.ctx.member.workspaceId)
    .select("id");
  if (error) return { ok: false, error: toUserMessage(error, "sow.status") };
  if (data.length === 0) return { ok: false, error: "SOW not found." };
  revalidatePath("/", "layout");
  return { ok: true };
}

// ── Projects ────────────────────────────────────────────────────────────────

export async function generateProject(input: unknown): Promise<ActionResult> {
  const parsed = generateProjectSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const auth = await authorizeAction("projects.generate");
  if (!auth.ok) return auth;
  const v = parsed.data;

  const { data, error } = await auth.ctx.supabase.rpc("generate_project", {
    p_client_id: v.client_id,
    p_blueprint_version_id: v.blueprint_version_id,
    p_name: v.name,
    p_start_on: v.start_on,
    p_idempotency_key: v.idempotency_key,
    ...(v.pilot ? { p_no_sow_reason: v.no_sow_reason ?? "" } : { p_sow_id: v.sow_id ?? "" }),
    ...(v.lead_id ? { p_lead_id: v.lead_id } : {}),
  });
  if (error) return { ok: false, error: toUserMessage(error, "project.generate") };
  revalidatePath("/", "layout");
  redirect(`/projects/${data}`);
}

export async function setProjectStatus(input: unknown): Promise<ActionResult> {
  const parsed = projectStatusSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" };
  const auth = await authorizeAction("records.write");
  if (!auth.ok) return auth;
  const { data, error } = await auth.ctx.supabase
    .from("projects")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.project_id)
    .eq("workspace_id", auth.ctx.member.workspaceId)
    .select("id");
  if (error) return { ok: false, error: toUserMessage(error, "project.status") };
  if (data.length === 0) return { ok: false, error: "Project not found." };
  revalidatePath("/", "layout");
  return { ok: true };
}

// ── Tasks ───────────────────────────────────────────────────────────────────

export type TransitionResult =
  { ok: true } | { ok: false; error: string; needsConfirmation?: boolean };

export async function transitionTask(input: unknown): Promise<TransitionResult> {
  const parsed = transitionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const auth = await authorizeAction("records.write");
  if (!auth.ok) return auth;
  const v = parsed.data;

  const { error } = await auth.ctx.supabase.rpc("transition_task", {
    p_task_id: v.task_id,
    p_to_status: v.to_status,
    p_expected_version: v.expected_version,
    ...(v.reason ? { p_reason: v.reason } : {}),
    p_confirm_unblock: v.confirm_unblock,
  });
  if (error) {
    const message = toUserMessage(error, "task.transition");
    return {
      ok: false,
      error: message,
      needsConfirmation: message.startsWith("Cancelling unblocks"),
    };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function updateTaskDetails(input: unknown): Promise<ActionResult> {
  const parsed = taskDetailsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const auth = await authorizeAction("records.write");
  if (!auth.ok) return auth;
  const { task_id, ...fields } = parsed.data;
  const { data, error } = await auth.ctx.supabase
    .from("project_tasks")
    .update(fields)
    .eq("id", task_id)
    .eq("workspace_id", auth.ctx.member.workspaceId)
    .select("id");
  if (error) return { ok: false, error: toUserMessage(error, "task.update") };
  if (data.length === 0) return { ok: false, error: "Task not found." };
  revalidatePath("/", "layout");
  return { ok: true };
}

// ── Client inputs and approvals ─────────────────────────────────────────────

export async function setInputStatus(input: unknown): Promise<ActionResult> {
  const parsed = inputStatusSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const auth = await authorizeAction("records.write");
  if (!auth.ok) return auth;
  const v = parsed.data;
  if (v.to_status === "waived" && !v.waive_reason) {
    return { ok: false, error: "Give a reason for waiving this input." };
  }
  const { error } = await auth.ctx.supabase.rpc("set_input_request_status", {
    p_request_id: v.request_id,
    p_to_status: v.to_status,
    p_expected_version: v.expected_version,
    ...(v.drive_url ? { p_drive_url: v.drive_url } : {}),
    ...(v.response_text ? { p_response_text: v.response_text } : {}),
    ...(v.waive_reason ? { p_waive_reason: v.waive_reason } : {}),
  });
  if (error) return { ok: false, error: toUserMessage(error, "input.status") };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function requestApproval(taskId: unknown): Promise<ActionResult> {
  const id = z.uuid().safeParse(taskId);
  if (!id.success) return { ok: false, error: "Invalid input" };
  const auth = await authorizeAction("records.write");
  if (!auth.ok) return auth;
  const { error } = await auth.ctx.supabase.rpc("request_approval", { p_task_id: id.data });
  if (error) {
    if (error.code === "23505") return { ok: false, error: "An approval is already pending." };
    return { ok: false, error: toUserMessage(error, "approval.request") };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function decideApproval(input: unknown): Promise<ActionResult> {
  const parsed = decideApprovalSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const auth = await authorizeAction("records.write");
  if (!auth.ok) return auth;
  const v = parsed.data;
  const { error } = await auth.ctx.supabase.rpc("decide_approval", {
    p_approval_id: v.approval_id,
    p_decision: v.decision,
    p_expected_version: v.expected_version,
    ...(v.note ? { p_note: v.note } : {}),
    ...(v.evidence_url ? { p_evidence_url: v.evidence_url } : {}),
    ...(v.client_contact_id ? { p_client_contact_id: v.client_contact_id } : {}),
  });
  if (error) return { ok: false, error: toUserMessage(error, "approval.decide") };
  revalidatePath("/", "layout");
  return { ok: true };
}
