"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import {
  agentFormSchema,
  aiPauseSchema,
  budgetSchema,
  decideActionSchema,
  jobCommandSchema,
  proposedActionSchema,
  usageSchema,
  workItemFormSchema,
  workTransitionSchema,
} from "@/features/agents/schemas";
import { buildContextSnapshot } from "@/features/agents/server/context";
import type { ActionResult } from "@/lib/action-result";
import { scanForSensitiveContent } from "@/lib/ai/sensitivity";
import { authorizeAction } from "@/server/auth/action-context";
import { toUserMessage } from "@/server/db/errors";

// Rule-bearing changes (status, dispatch, review, approval) go through database functions that
// re-check role, MFA and state; nothing here reaches an outside AI service (manual hand-off, D-10).

const firstIssue = (e?: z.ZodError) => e?.issues[0]?.message ?? "Invalid input";

// Saves a draft and (re)builds its frozen context snapshot + sensitivity flags.
export async function saveWorkItem(id: unknown, input: unknown): Promise<ActionResult> {
  const itemId = z
    .uuid()
    .nullable()
    .safeParse(id ?? null);
  const parsed = workItemFormSchema.safeParse(input);
  if (!itemId.success || !parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const auth = await authorizeAction("records.write");
  if (!auth.ok) return auth;
  const { supabase, member } = auth.ctx;
  const v = parsed.data;
  if (v.project_id && !v.client_id) return { ok: false, error: "Choose the project's client too." };

  const { snapshot, flags } = await buildContextSnapshot(
    supabase,
    member.workspaceId,
    { clientId: v.client_id, projectId: v.project_id },
    v.context_options,
  );
  // The task text goes to the agent too, so it is scanned as well.
  const allFlags = [...flags, ...scanForSensitiveContent(`${v.title}\n${v.instructions}`)];
  const columns = { ...v, context_snapshot: snapshot, sensitivity_flags: allFlags };

  if (itemId.data) {
    const { data, error } = await supabase
      .from("agent_work_items")
      .update(columns)
      .eq("id", itemId.data)
      .eq("workspace_id", member.workspaceId)
      .eq("status", "draft")
      .select("id");
    if (error) return { ok: false, error: toUserMessage(error, "work_item.update") };
    if (data.length === 0) return { ok: false, error: "Only drafts can be edited." };
    revalidatePath("/", "layout");
    redirect(`/agents/queue/${itemId.data}`);
  }
  const { data, error } = await supabase
    .from("agent_work_items")
    .insert({ ...columns, workspace_id: member.workspaceId })
    .select("id")
    .single();
  if (error) return { ok: false, error: toUserMessage(error, "work_item.create") };
  revalidatePath("/", "layout");
  redirect(`/agents/queue/${data.id}`);
}

export async function transitionWorkItem(input: unknown): Promise<ActionResult> {
  const parsed = workTransitionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const auth = await authorizeAction("records.write");
  if (!auth.ok) return auth;
  const v = parsed.data;
  const { error } = await auth.ctx.supabase.rpc("transition_work_item", {
    p_id: v.id,
    p_to: v.to,
    p_expected_version: v.expected_version,
    ...(v.override_reason ? { p_override_reason: v.override_reason } : {}),
    ...(v.output_text ? { p_output_text: v.output_text } : {}),
    ...(v.output_url ? { p_output_url: v.output_url } : {}),
    ...(v.review_note ? { p_review_note: v.review_note } : {}),
  });
  if (error) return { ok: false, error: toUserMessage(error, "work_item.transition") };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function proposeAction(input: unknown): Promise<ActionResult> {
  const parsed = proposedActionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const auth = await authorizeAction("records.write");
  if (!auth.ok) return auth;
  const { error } = await auth.ctx.supabase
    .from("proposed_actions")
    .insert({ ...parsed.data, workspace_id: auth.ctx.member.workspaceId });
  if (error) return { ok: false, error: toUserMessage(error, "action.propose") };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function decideAction(input: unknown): Promise<ActionResult> {
  const parsed = decideActionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const auth = await authorizeAction("agents.dispatch");
  if (!auth.ok) return auth;
  const v = parsed.data;
  const { error } = await auth.ctx.supabase.rpc("decide_action", {
    p_id: v.id,
    p_decision: v.decision,
    p_expected_version: v.expected_version,
    ...(v.note ? { p_note: v.note } : {}),
  });
  if (error) return { ok: false, error: toUserMessage(error, "action.decide") };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function markActionExecuted(
  id: unknown,
  version: unknown,
  note: unknown,
): Promise<ActionResult> {
  const parsed = z
    .object({ id: z.uuid(), version: z.number().int().min(1), note: z.string().max(2000) })
    .safeParse({ id, version, note });
  if (!parsed.success) return { ok: false, error: "Invalid input" };
  const auth = await authorizeAction("agents.dispatch");
  if (!auth.ok) return auth;
  const { error } = await auth.ctx.supabase.rpc("mark_action_executed", {
    p_id: parsed.data.id,
    p_expected_version: parsed.data.version,
    ...(parsed.data.note.trim() ? { p_note: parsed.data.note } : {}),
  });
  if (error) return { ok: false, error: toUserMessage(error, "action.executed") };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function updateAgent(id: unknown, input: unknown): Promise<ActionResult> {
  const agentId = z.uuid().safeParse(id);
  const parsed = agentFormSchema.safeParse(input);
  if (!agentId.success || !parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const auth = await authorizeAction("agents.dispatch");
  if (!auth.ok) return auth;
  const { data, error } = await auth.ctx.supabase
    .from("agents")
    .update(parsed.data)
    .eq("id", agentId.data)
    .eq("workspace_id", auth.ctx.member.workspaceId)
    .select("id");
  if (error) return { ok: false, error: toUserMessage(error, "agent.update") };
  if (data.length === 0) return { ok: false, error: "Agent not found." };
  revalidatePath("/", "layout");
  redirect("/agents/roster");
}

export async function recordUsage(input: unknown): Promise<ActionResult> {
  const parsed = usageSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const auth = await authorizeAction("records.write");
  if (!auth.ok) return auth;
  const { cost, ...rest } = parsed.data;
  const { error } = await auth.ctx.supabase
    .from("ai_usage")
    .insert({ ...rest, cost_microusd: cost, workspace_id: auth.ctx.member.workspaceId });
  if (error) return { ok: false, error: toUserMessage(error, "ai_usage.record") };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function setBudget(input: unknown): Promise<ActionResult> {
  const parsed = budgetSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const auth = await authorizeAction("workspace.manage");
  if (!auth.ok) return auth;
  const { data, error } = await auth.ctx.supabase
    .from("ai_budgets")
    .update({ monthly_cap_minor: parsed.data.cap })
    .eq("workspace_id", auth.ctx.member.workspaceId)
    .eq("provider", parsed.data.provider)
    .select("provider");
  if (error) return { ok: false, error: toUserMessage(error, "ai_budget.update") };
  if (data.length === 0) return { ok: false, error: "No budget for that provider." };
  revalidatePath("/", "layout");
  return { ok: true };
}

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

export async function commandJob(input: unknown): Promise<ActionResult> {
  const parsed = jobCommandSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const auth = await authorizeAction("jobs.manage");
  if (!auth.ok) return auth;
  const { error } =
    parsed.data.command === "retry"
      ? await auth.ctx.supabase.rpc("retry_job", { p_id: parsed.data.id })
      : await auth.ctx.supabase.rpc("cancel_job", { p_id: parsed.data.id });
  if (error) return { ok: false, error: toUserMessage(error, `job.${parsed.data.command}`) };
  revalidatePath("/", "layout");
  return { ok: true };
}
