"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { leadFormSchema, moveLeadSchema, stageNameSchema } from "@/features/leads/schemas";
import type { ActionResult } from "@/lib/action-result";
import { authorizeAction } from "@/server/auth/action-context";
import { toUserMessage } from "@/server/db/errors";

function toLeadColumns(values: z.output<typeof leadFormSchema>) {
  const { estimated_value, ...rest } = values;
  return { ...rest, estimated_value_minor: estimated_value, currency: "USD" };
}

export async function createLead(clientId: unknown, input: unknown): Promise<ActionResult> {
  const id = z.uuid().safeParse(clientId);
  const parsed = leadFormSchema.safeParse(input);
  if (!id.success || !parsed.success) {
    return { ok: false, error: parsed.error?.issues[0]?.message ?? "Choose a client" };
  }
  const auth = await authorizeAction("records.write");
  if (!auth.ok) return auth;
  const { supabase, member } = auth.ctx;

  const { data, error } = await supabase
    .from("leads")
    .insert({ ...toLeadColumns(parsed.data), client_id: id.data, workspace_id: member.workspaceId })
    .select("id")
    .single();
  if (error) return { ok: false, error: toUserMessage(error, "lead.create") };

  revalidatePath("/", "layout");
  redirect(`/leads/${data.id}`);
}

export async function updateLead(leadId: unknown, input: unknown): Promise<ActionResult> {
  const id = z.uuid().safeParse(leadId);
  const parsed = leadFormSchema.safeParse(input);
  if (!id.success || !parsed.success) {
    return { ok: false, error: parsed.error?.issues[0]?.message ?? "Invalid input" };
  }
  const auth = await authorizeAction("records.write");
  if (!auth.ok) return auth;
  const { supabase, member } = auth.ctx;

  // Stage changes go through moveLead (they may need a lost reason).
  const columns: Partial<ReturnType<typeof toLeadColumns>> = toLeadColumns(parsed.data);
  delete columns.stage_id;
  const { data, error } = await supabase
    .from("leads")
    .update(columns)
    .eq("id", id.data)
    .eq("workspace_id", member.workspaceId)
    .select("id");
  if (error) return { ok: false, error: toUserMessage(error, "lead.update") };
  if (data.length === 0) return { ok: false, error: "Lead not found." };

  revalidatePath("/", "layout");
  redirect(`/leads/${id.data}`);
}

// Stage change (audited by trigger). Lost stages require a reason (DB-enforced too).
export async function moveLead(input: unknown): Promise<ActionResult> {
  const parsed = moveLeadSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid" };
  const auth = await authorizeAction("records.write");
  if (!auth.ok) return auth;
  const { supabase, member } = auth.ctx;

  const { data, error } = await supabase
    .from("leads")
    .update({ stage_id: parsed.data.stage_id, lost_reason: parsed.data.lost_reason })
    .eq("id", parsed.data.lead_id)
    .eq("workspace_id", member.workspaceId)
    .select("id");
  if (error) return { ok: false, error: toUserMessage(error, "lead.move") };
  if (data.length === 0) return { ok: false, error: "Lead not found." };

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function setLeadArchived(id: unknown, archived: unknown): Promise<ActionResult> {
  const parsed = z.object({ id: z.uuid(), archived: z.boolean() }).safeParse({ id, archived });
  if (!parsed.success) return { ok: false, error: "Invalid input" };
  const auth = await authorizeAction("records.write");
  if (!auth.ok) return auth;
  const { supabase, member } = auth.ctx;

  const { data, error } = await supabase
    .from("leads")
    .update({ archived_at: parsed.data.archived ? new Date().toISOString() : null })
    .eq("id", parsed.data.id)
    .eq("workspace_id", member.workspaceId)
    .select("id");
  if (error) return { ok: false, error: toUserMessage(error, "lead.archive") };
  if (data.length === 0) return { ok: false, error: "Lead not found." };

  revalidatePath("/", "layout");
  return { ok: true };
}

// ── Pipeline configuration (owner/admin) ─────────────────────────────────────

export async function renameStage(id: unknown, name: unknown): Promise<ActionResult> {
  const stageId = z.uuid().safeParse(id);
  const stageName = stageNameSchema.safeParse(name);
  if (!stageId.success || !stageName.success) {
    return { ok: false, error: stageName.error?.issues[0]?.message ?? "Invalid input" };
  }
  const auth = await authorizeAction("pipeline.configure");
  if (!auth.ok) return auth;
  const { supabase, member } = auth.ctx;

  const { data, error } = await supabase
    .from("pipeline_stages")
    .update({ name: stageName.data })
    .eq("id", stageId.data)
    .eq("workspace_id", member.workspaceId)
    .select("id");
  if (error) return { ok: false, error: toUserMessage(error, "stage.rename") };
  if (data.length === 0) return { ok: false, error: "Stage not found." };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function addStage(name: unknown): Promise<ActionResult> {
  const stageName = stageNameSchema.safeParse(name);
  if (!stageName.success) return { ok: false, error: stageName.error.issues[0]?.message ?? "" };
  const auth = await authorizeAction("pipeline.configure");
  if (!auth.ok) return auth;
  const { supabase, member } = auth.ctx;

  // New open stages go before the first closed (won/lost) stage.
  const { data: stages, error: listError } = await supabase
    .from("pipeline_stages")
    .select("id, position, kind")
    .eq("workspace_id", member.workspaceId)
    .order("position");
  if (listError) return { ok: false, error: toUserMessage(listError, "stage.add") };
  const maxPosition = stages.at(-1)?.position ?? 0;

  const { data: created, error } = await supabase
    .from("pipeline_stages")
    .insert({ workspace_id: member.workspaceId, name: stageName.data, position: maxPosition + 1 })
    .select("id")
    .single();
  if (error) return { ok: false, error: toUserMessage(error, "stage.add") };

  const closedCount = stages.filter((s) => s.kind !== "open").length;
  for (let i = 0; i < closedCount; i++) {
    const { error: moveError } = await supabase.rpc("move_pipeline_stage", {
      stage_id: created.id,
      direction: -1,
    });
    if (moveError) return { ok: false, error: toUserMessage(moveError, "stage.add") };
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function moveStage(id: unknown, direction: unknown): Promise<ActionResult> {
  const parsed = z
    .object({ id: z.uuid(), direction: z.union([z.literal(-1), z.literal(1)]) })
    .safeParse({ id, direction });
  if (!parsed.success) return { ok: false, error: "Invalid input" };
  const auth = await authorizeAction("pipeline.configure");
  if (!auth.ok) return auth;

  const { error } = await auth.ctx.supabase.rpc("move_pipeline_stage", {
    stage_id: parsed.data.id,
    direction: parsed.data.direction,
  });
  if (error) return { ok: false, error: toUserMessage(error, "stage.move") };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteStage(id: unknown): Promise<ActionResult> {
  const stageId = z.uuid().safeParse(id);
  if (!stageId.success) return { ok: false, error: "Invalid input" };
  const auth = await authorizeAction("pipeline.configure");
  if (!auth.ok) return auth;
  const { supabase, member } = auth.ctx;

  const { data, error } = await supabase
    .from("pipeline_stages")
    .delete()
    .eq("id", stageId.data)
    .eq("workspace_id", member.workspaceId)
    .select("id");
  if (error) return { ok: false, error: toUserMessage(error, "stage.delete") };
  if (data.length === 0) return { ok: false, error: "Won and Lost stages can't be deleted." };
  revalidatePath("/", "layout");
  return { ok: true };
}
