"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import {
  blueprintFormSchema,
  inputTemplateFormSchema,
  publishSchema,
  taskTemplateFormSchema,
} from "@/features/blueprints/schemas";
import type { ActionResult } from "@/lib/action-result";
import { authorizeAction } from "@/server/auth/action-context";
import { toUserMessage } from "@/server/db/errors";
import type { SupabaseServerClient } from "@/server/db/server-client";

// Draft editing: owner/admin (catalog.manage). Publish/retire: blueprints.publish.
// The database enforces immutability of published versions regardless of these checks.

const firstIssue = (e?: z.ZodError) => e?.issues[0]?.message ?? "Invalid input";

async function versionPath(supabase: SupabaseServerClient, versionId: string) {
  const { data } = await supabase
    .from("blueprint_versions")
    .select("blueprint_id, version_number")
    .eq("id", versionId)
    .maybeSingle();
  return data ? `/blueprints/${data.blueprint_id}/versions/${data.version_number}` : "/blueprints";
}

export async function createBlueprint(input: unknown): Promise<ActionResult> {
  const parsed = blueprintFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const auth = await authorizeAction("catalog.manage");
  if (!auth.ok) return auth;
  const { supabase, member } = auth.ctx;

  const { data, error } = await supabase
    .from("blueprints")
    .insert({ ...parsed.data, workspace_id: member.workspaceId })
    .select("id")
    .single();
  if (error) return { ok: false, error: toUserMessage(error, "blueprint.create") };
  const { error: draftError } = await supabase.rpc("create_draft_version", {
    p_blueprint_id: data.id,
  });
  if (draftError) return { ok: false, error: toUserMessage(draftError, "blueprint.create") };

  revalidatePath("/", "layout");
  redirect(`/blueprints/${data.id}/versions/1`);
}

export async function updateBlueprint(id: unknown, input: unknown): Promise<ActionResult> {
  const blueprintId = z.uuid().safeParse(id);
  const parsed = blueprintFormSchema.safeParse(input);
  if (!blueprintId.success || !parsed.success)
    return { ok: false, error: firstIssue(parsed.error) };
  const auth = await authorizeAction("catalog.manage");
  if (!auth.ok) return auth;

  const { error } = await auth.ctx.supabase
    .from("blueprints")
    .update(parsed.data)
    .eq("id", blueprintId.data)
    .eq("workspace_id", auth.ctx.member.workspaceId);
  if (error) return { ok: false, error: toUserMessage(error, "blueprint.update") };
  revalidatePath("/", "layout");
  redirect(`/blueprints/${blueprintId.data}`);
}

export async function setBlueprintArchived(id: unknown, archived: unknown): Promise<ActionResult> {
  const parsed = z.object({ id: z.uuid(), archived: z.boolean() }).safeParse({ id, archived });
  if (!parsed.success) return { ok: false, error: "Invalid input" };
  const auth = await authorizeAction("catalog.manage");
  if (!auth.ok) return auth;

  const { error } = await auth.ctx.supabase
    .from("blueprints")
    .update({ archived_at: parsed.data.archived ? new Date().toISOString() : null })
    .eq("id", parsed.data.id)
    .eq("workspace_id", auth.ctx.member.workspaceId);
  if (error) return { ok: false, error: toUserMessage(error, "blueprint.archive") };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function createDraft(
  blueprintId: unknown,
  fromVersionId: unknown,
): Promise<ActionResult> {
  const parsed = z
    .object({ blueprintId: z.uuid(), fromVersionId: z.uuid().nullable() })
    .safeParse({ blueprintId, fromVersionId: fromVersionId ?? null });
  if (!parsed.success) return { ok: false, error: "Invalid input" };
  const auth = await authorizeAction("catalog.manage");
  if (!auth.ok) return auth;
  const { supabase } = auth.ctx;

  const { data, error } = await supabase.rpc("create_draft_version", {
    p_blueprint_id: parsed.data.blueprintId,
    ...(parsed.data.fromVersionId ? { p_from_version_id: parsed.data.fromVersionId } : {}),
  });
  if (error) return { ok: false, error: toUserMessage(error, "blueprint.draft") };
  revalidatePath("/", "layout");
  redirect(await versionPath(supabase, data));
}

export async function deleteDraft(versionId: unknown): Promise<ActionResult> {
  const id = z.uuid().safeParse(versionId);
  if (!id.success) return { ok: false, error: "Invalid input" };
  const auth = await authorizeAction("catalog.manage");
  if (!auth.ok) return auth;
  const { supabase, member } = auth.ctx;

  const { data, error } = await supabase
    .from("blueprint_versions")
    .delete()
    .eq("id", id.data)
    .eq("workspace_id", member.workspaceId)
    .eq("status", "draft")
    .select("blueprint_id");
  if (error) return { ok: false, error: toUserMessage(error, "blueprint.delete_draft") };
  const row = data[0];
  if (!row) return { ok: false, error: "Draft not found." };
  revalidatePath("/", "layout");
  redirect(`/blueprints/${row.blueprint_id}`);
}

export async function saveTaskTemplate(id: unknown, input: unknown): Promise<ActionResult> {
  const taskId = z
    .uuid()
    .nullable()
    .safeParse(id ?? null);
  const parsed = taskTemplateFormSchema.safeParse(input);
  if (!taskId.success || !parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const auth = await authorizeAction("catalog.manage");
  if (!auth.ok) return auth;
  const { supabase, member } = auth.ctx;
  const { version_id, depends_on, ...columns } = parsed.data;

  let savedId = taskId.data;
  if (savedId) {
    const { error } = await supabase
      .from("task_templates")
      .update(columns)
      .eq("id", savedId)
      .eq("blueprint_version_id", version_id);
    if (error) return { ok: false, error: toUserMessage(error, "task_template.save") };
  } else {
    const { data, error } = await supabase
      .from("task_templates")
      .insert({ ...columns, blueprint_version_id: version_id, workspace_id: member.workspaceId })
      .select("id")
      .single();
    if (error) {
      if (error.code === "23505")
        return { ok: false, error: "Another task already uses that key." };
      return { ok: false, error: toUserMessage(error, "task_template.save") };
    }
    savedId = data.id;
  }

  // Replace prerequisites (draft only; triggers reject published versions).
  const { error: delError } = await supabase
    .from("task_template_dependencies")
    .delete()
    .eq("task_template_id", savedId);
  if (delError) return { ok: false, error: toUserMessage(delError, "task_template.deps") };
  const prerequisites = [...new Set(depends_on)].filter((d) => d !== savedId);
  if (prerequisites.length > 0) {
    const { error: insError } = await supabase.from("task_template_dependencies").insert(
      prerequisites.map((dependsOn) => ({
        workspace_id: member.workspaceId,
        blueprint_version_id: version_id,
        task_template_id: savedId,
        depends_on_id: dependsOn,
      })),
    );
    if (insError) return { ok: false, error: toUserMessage(insError, "task_template.deps") };
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteTaskTemplate(id: unknown): Promise<ActionResult> {
  const taskId = z.uuid().safeParse(id);
  if (!taskId.success) return { ok: false, error: "Invalid input" };
  const auth = await authorizeAction("catalog.manage");
  if (!auth.ok) return auth;
  const { error } = await auth.ctx.supabase
    .from("task_templates")
    .delete()
    .eq("id", taskId.data)
    .eq("workspace_id", auth.ctx.member.workspaceId);
  if (error) return { ok: false, error: toUserMessage(error, "task_template.delete") };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function saveInputTemplate(id: unknown, input: unknown): Promise<ActionResult> {
  const inputId = z
    .uuid()
    .nullable()
    .safeParse(id ?? null);
  const parsed = inputTemplateFormSchema.safeParse(input);
  if (!inputId.success || !parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const auth = await authorizeAction("catalog.manage");
  if (!auth.ok) return auth;
  const { supabase, member } = auth.ctx;
  const { version_id, ...columns } = parsed.data;

  const { error } = inputId.data
    ? await supabase
        .from("input_templates")
        .update(columns)
        .eq("id", inputId.data)
        .eq("blueprint_version_id", version_id)
    : await supabase
        .from("input_templates")
        .insert({ ...columns, blueprint_version_id: version_id, workspace_id: member.workspaceId });
  if (error) {
    if (error.code === "23505") return { ok: false, error: "Another input already uses that key." };
    return { ok: false, error: toUserMessage(error, "input_template.save") };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteInputTemplate(id: unknown): Promise<ActionResult> {
  const inputId = z.uuid().safeParse(id);
  if (!inputId.success) return { ok: false, error: "Invalid input" };
  const auth = await authorizeAction("catalog.manage");
  if (!auth.ok) return auth;
  const { error } = await auth.ctx.supabase
    .from("input_templates")
    .delete()
    .eq("id", inputId.data)
    .eq("workspace_id", auth.ctx.member.workspaceId);
  if (error) return { ok: false, error: toUserMessage(error, "input_template.delete") };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function publishVersion(input: unknown): Promise<ActionResult> {
  const parsed = publishSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const auth = await authorizeAction("blueprints.publish");
  if (!auth.ok) return auth;

  const { error } = await auth.ctx.supabase.rpc("publish_blueprint_version", {
    p_version_id: parsed.data.version_id,
    ...(parsed.data.change_summary ? { p_change_summary: parsed.data.change_summary } : {}),
  });
  if (error) return { ok: false, error: toUserMessage(error, "blueprint.publish") };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function retireVersion(versionId: unknown): Promise<ActionResult> {
  const id = z.uuid().safeParse(versionId);
  if (!id.success) return { ok: false, error: "Invalid input" };
  const auth = await authorizeAction("blueprints.publish");
  if (!auth.ok) return auth;

  const { error } = await auth.ctx.supabase.rpc("retire_blueprint_version", {
    p_version_id: id.data,
  });
  if (error) return { ok: false, error: toUserMessage(error, "blueprint.retire") };
  revalidatePath("/", "layout");
  return { ok: true };
}
