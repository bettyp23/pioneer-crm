"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { contactFormSchema } from "@/features/contacts/schemas";
import type { ActionResult } from "@/lib/action-result";
import { authorizeAction } from "@/server/auth/action-context";
import { toUserMessage } from "@/server/db/errors";

export async function createContact(clientId: unknown, input: unknown): Promise<ActionResult> {
  const id = z.uuid().safeParse(clientId);
  const parsed = contactFormSchema.safeParse(input);
  if (!id.success || !parsed.success) {
    return { ok: false, error: parsed.error?.issues[0]?.message ?? "Invalid input" };
  }
  const auth = await authorizeAction("records.write");
  if (!auth.ok) return auth;
  const { supabase, member } = auth.ctx;

  const { error } = await supabase
    .from("contacts")
    .insert({ ...parsed.data, client_id: id.data, workspace_id: member.workspaceId });
  if (error) return { ok: false, error: toUserMessage(error, "contact.create") };

  revalidatePath("/", "layout");
  redirect(`/clients/${id.data}?tab=contacts`);
}

export async function updateContact(contactId: unknown, input: unknown): Promise<ActionResult> {
  const id = z.uuid().safeParse(contactId);
  const parsed = contactFormSchema.safeParse(input);
  if (!id.success || !parsed.success) {
    return { ok: false, error: parsed.error?.issues[0]?.message ?? "Invalid input" };
  }
  const auth = await authorizeAction("records.write");
  if (!auth.ok) return auth;
  const { supabase, member } = auth.ctx;

  const { data, error } = await supabase
    .from("contacts")
    .update(parsed.data)
    .eq("id", id.data)
    .eq("workspace_id", member.workspaceId)
    .select("client_id");
  if (error) return { ok: false, error: toUserMessage(error, "contact.update") };
  const row = data[0];
  if (!row) return { ok: false, error: "Contact not found." };

  revalidatePath("/", "layout");
  redirect(`/clients/${row.client_id}?tab=contacts`);
}

export async function setContactArchived(id: unknown, archived: unknown): Promise<ActionResult> {
  const parsed = z.object({ id: z.uuid(), archived: z.boolean() }).safeParse({ id, archived });
  if (!parsed.success) return { ok: false, error: "Invalid input" };
  const auth = await authorizeAction("records.write");
  if (!auth.ok) return auth;
  const { supabase, member } = auth.ctx;

  const { data, error } = await supabase
    .from("contacts")
    .update(
      parsed.data.archived
        ? { archived_at: new Date().toISOString(), is_primary: false }
        : { archived_at: null },
    )
    .eq("id", parsed.data.id)
    .eq("workspace_id", member.workspaceId)
    .select("id");
  if (error) return { ok: false, error: toUserMessage(error, "contact.archive") };
  if (data.length === 0) return { ok: false, error: "Contact not found." };

  revalidatePath("/", "layout");
  return { ok: true };
}
