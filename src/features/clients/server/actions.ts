"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { clientFormSchema } from "@/features/clients/schemas";
import type { ActionResult } from "@/lib/action-result";
import { authorizeAction } from "@/server/auth/action-context";
import { toUserMessage } from "@/server/db/errors";

// validate → authorize → write (RLS re-checks role + MFA) → revalidate.

export async function createClient(input: unknown): Promise<ActionResult> {
  const parsed = clientFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid" };
  const auth = await authorizeAction("records.write");
  if (!auth.ok) return auth;
  const { supabase, member } = auth.ctx;

  const { data, error } = await supabase
    .from("clients")
    .insert({ ...parsed.data, workspace_id: member.workspaceId })
    .select("id")
    .single();
  if (error) return { ok: false, error: toUserMessage(error, "client.create") };

  revalidatePath("/", "layout");
  redirect(`/clients/${data.id}`);
}

export async function updateClient(id: unknown, input: unknown): Promise<ActionResult> {
  const clientId = z.uuid().safeParse(id);
  const parsed = clientFormSchema.safeParse(input);
  if (!clientId.success || !parsed.success) {
    return { ok: false, error: parsed.error?.issues[0]?.message ?? "Invalid input" };
  }
  const auth = await authorizeAction("records.write");
  if (!auth.ok) return auth;
  const { supabase, member } = auth.ctx;

  const { data, error } = await supabase
    .from("clients")
    .update(parsed.data)
    .eq("id", clientId.data)
    .eq("workspace_id", member.workspaceId)
    .select("id");
  if (error) return { ok: false, error: toUserMessage(error, "client.update") };
  if (data.length === 0) return { ok: false, error: "Client not found." };

  revalidatePath("/", "layout");
  redirect(`/clients/${clientId.data}`);
}

export async function setClientArchived(id: unknown, archived: unknown): Promise<ActionResult> {
  const parsed = z.object({ id: z.uuid(), archived: z.boolean() }).safeParse({ id, archived });
  if (!parsed.success) return { ok: false, error: "Invalid input" };
  const auth = await authorizeAction("records.write");
  if (!auth.ok) return auth;
  const { supabase, member } = auth.ctx;

  const { data, error } = await supabase
    .from("clients")
    .update({ archived_at: parsed.data.archived ? new Date().toISOString() : null })
    .eq("id", parsed.data.id)
    .eq("workspace_id", member.workspaceId)
    .select("id");
  if (error) return { ok: false, error: toUserMessage(error, "client.archive") };
  if (data.length === 0) return { ok: false, error: "Client not found." };

  revalidatePath("/", "layout");
  return { ok: true };
}
