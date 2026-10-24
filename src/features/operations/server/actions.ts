"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import {
  diagnosticFormSchema,
  invoiceFormSchema,
  issueFormSchema,
  issueStatusSchema,
  routineFormSchema,
  routineRunSchema,
} from "@/features/operations/schemas";
import type { ActionResult } from "@/lib/action-result";
import { authorizeAction } from "@/server/auth/action-context";
import { toUserMessage } from "@/server/db/errors";

const firstIssue = (e?: z.ZodError) => e?.issues[0]?.message ?? "Invalid input";
const optionalId = (id: unknown) =>
  z
    .uuid()
    .nullable()
    .safeParse(id ?? null);

export async function saveRoutine(id: unknown, input: unknown): Promise<ActionResult> {
  const routineId = optionalId(id);
  const parsed = routineFormSchema.safeParse(input);
  if (!routineId.success || !parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const auth = await authorizeAction("records.write");
  if (!auth.ok) return auth;
  const { supabase, member } = auth.ctx;

  if (routineId.data) {
    const { error } = await supabase
      .from("routines")
      .update(parsed.data)
      .eq("id", routineId.data)
      .eq("workspace_id", member.workspaceId);
    if (error) return { ok: false, error: toUserMessage(error, "routine.update") };
    revalidatePath("/", "layout");
    redirect(`/routines/${routineId.data}`);
  }
  const { data, error } = await supabase
    .from("routines")
    .insert({ ...parsed.data, workspace_id: member.workspaceId })
    .select("id")
    .single();
  if (error) return { ok: false, error: toUserMessage(error, "routine.create") };
  revalidatePath("/", "layout");
  redirect(`/routines/${data.id}`);
}

export async function setRoutineRunStatus(input: unknown): Promise<ActionResult> {
  const parsed = routineRunSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const auth = await authorizeAction("records.write");
  if (!auth.ok) return auth;
  const { data, error } = await auth.ctx.supabase
    .from("routine_runs")
    .update({ status: parsed.data.status, notes: parsed.data.notes })
    .eq("id", parsed.data.run_id)
    .eq("workspace_id", auth.ctx.member.workspaceId)
    .select("id");
  if (error) return { ok: false, error: toUserMessage(error, "routine_run.update") };
  if (data.length === 0) return { ok: false, error: "Occurrence not found." };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function createDiagnostic(input: unknown): Promise<ActionResult> {
  const parsed = diagnosticFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const auth = await authorizeAction("records.write");
  if (!auth.ok) return auth;
  const { error } = await auth.ctx.supabase
    .from("diagnostics")
    .insert({ ...parsed.data, workspace_id: auth.ctx.member.workspaceId });
  if (error) return { ok: false, error: toUserMessage(error, "diagnostic.create") };
  revalidatePath("/", "layout");
  redirect("/diagnostics");
}

export async function createIssue(input: unknown): Promise<ActionResult> {
  const parsed = issueFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const auth = await authorizeAction("records.write");
  if (!auth.ok) return auth;
  const { data, error } = await auth.ctx.supabase
    .from("issues")
    .insert({ ...parsed.data, workspace_id: auth.ctx.member.workspaceId })
    .select("id")
    .single();
  if (error) return { ok: false, error: toUserMessage(error, "issue.create") };
  revalidatePath("/", "layout");
  redirect(`/issues/${data.id}`);
}

export async function updateIssue(id: unknown, input: unknown): Promise<ActionResult> {
  const issueId = z.uuid().safeParse(id);
  const parsed = issueFormSchema.safeParse(input);
  if (!issueId.success || !parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const auth = await authorizeAction("records.write");
  if (!auth.ok) return auth;
  const { client_id: _client, diagnostic_id: _diagnostic, ...fields } = parsed.data;
  void _client;
  void _diagnostic;
  const { error } = await auth.ctx.supabase
    .from("issues")
    .update(fields)
    .eq("id", issueId.data)
    .eq("workspace_id", auth.ctx.member.workspaceId);
  if (error) return { ok: false, error: toUserMessage(error, "issue.update") };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function setIssueStatus(input: unknown): Promise<ActionResult> {
  const parsed = issueStatusSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const auth = await authorizeAction("records.write");
  if (!auth.ok) return auth;
  const closing = ["resolved", "wont_fix"].includes(parsed.data.status);
  const { data, error } = await auth.ctx.supabase
    .from("issues")
    .update({ status: parsed.data.status, resolution: closing ? parsed.data.resolution : null })
    .eq("id", parsed.data.issue_id)
    .eq("workspace_id", auth.ctx.member.workspaceId)
    .select("id");
  if (error) return { ok: false, error: toUserMessage(error, "issue.status") };
  if (data.length === 0) return { ok: false, error: "Issue not found." };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function saveInvoice(id: unknown, input: unknown): Promise<ActionResult> {
  const invoiceId = optionalId(id);
  const parsed = invoiceFormSchema.safeParse(input);
  if (!invoiceId.success || !parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const auth = await authorizeAction("records.write");
  if (!auth.ok) return auth;
  const { supabase, member } = auth.ctx;
  const { amount, client_id, ...rest } = parsed.data;
  const columns = {
    ...rest,
    amount_minor: amount,
    currency: "USD",
    paid_on: rest.status === "paid" ? rest.paid_on : null,
  };

  const { error } = invoiceId.data
    ? await supabase
        .from("invoices")
        .update(columns)
        .eq("id", invoiceId.data)
        .eq("workspace_id", member.workspaceId)
    : await supabase
        .from("invoices")
        .insert({ ...columns, client_id, workspace_id: member.workspaceId });
  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: "That invoice number is already recorded for this system." };
    }
    return { ok: false, error: toUserMessage(error, "invoice.save") };
  }
  revalidatePath("/", "layout");
  redirect("/invoices");
}

export async function markInvoicePaid(id: unknown, paidOn: unknown): Promise<ActionResult> {
  const parsed = z
    .object({ id: z.uuid(), paidOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) })
    .safeParse({ id, paidOn });
  if (!parsed.success) return { ok: false, error: "Choose the paid date" };
  const auth = await authorizeAction("records.write");
  if (!auth.ok) return auth;
  const { data, error } = await auth.ctx.supabase
    .from("invoices")
    .update({ status: "paid", paid_on: parsed.data.paidOn })
    .eq("id", parsed.data.id)
    .eq("workspace_id", auth.ctx.member.workspaceId)
    .select("id");
  if (error) return { ok: false, error: toUserMessage(error, "invoice.paid") };
  if (data.length === 0) return { ok: false, error: "Invoice not found." };
  revalidatePath("/", "layout");
  return { ok: true };
}
