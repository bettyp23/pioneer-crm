import "server-only";

import { notFound } from "next/navigation";
import { z } from "zod";

import { requireMember } from "@/server/auth/session";

export async function listClientContacts(clientId: string, includeArchived = false) {
  const { supabase, member } = await requireMember();
  let query = supabase
    .from("contacts")
    .select("id, first_name, last_name, email, phone, job_title, is_primary, archived_at")
    .eq("workspace_id", member.workspaceId)
    .eq("client_id", clientId)
    .order("is_primary", { ascending: false })
    .order("first_name");
  if (!includeArchived) query = query.is("archived_at", null);
  const { data, error } = await query;
  if (error) throw new Error(`Failed to load contacts (${error.code})`);
  return data;
}

export const CONTACT_PAGE_SIZE = 50;

export async function listAllContacts(params: { q: string; page: number }) {
  const { supabase, member } = await requireMember();
  let query = supabase
    .from("contacts")
    .select(
      "id, first_name, last_name, email, phone, job_title, is_primary, client:clients!contacts_client_fkey(id, name)",
      { count: "exact" },
    )
    .eq("workspace_id", member.workspaceId)
    .is("archived_at", null)
    .order("first_name")
    .range((params.page - 1) * CONTACT_PAGE_SIZE, params.page * CONTACT_PAGE_SIZE - 1);
  if (params.q) {
    const term = params.q.replace(/[\\%_,()*]/g, " ").trim();
    if (term) {
      query = query.or(
        `first_name.ilike.*${term}*,last_name.ilike.*${term}*,email.ilike.*${term}*`,
      );
    }
  }
  const { data, error, count } = await query;
  if (error) throw new Error(`Failed to load contacts (${error.code})`);
  return { contacts: data, total: count ?? 0 };
}

export async function getContact(id: string) {
  if (!z.uuid().safeParse(id).success) notFound();
  const { supabase, member } = await requireMember();
  const { data, error } = await supabase
    .from("contacts")
    .select("*, client:clients!contacts_client_fkey(id, name)")
    .eq("id", id)
    .eq("workspace_id", member.workspaceId)
    .maybeSingle();
  if (error) throw new Error(`Failed to load contact (${error.code})`);
  if (!data) notFound();
  return data;
}

// Lightweight options for pickers (contact must belong to the chosen client).
export async function listContactOptions() {
  const { supabase, member } = await requireMember();
  const { data, error } = await supabase
    .from("contacts")
    .select("id, first_name, last_name, client_id")
    .eq("workspace_id", member.workspaceId)
    .is("archived_at", null)
    .order("first_name")
    .limit(5000);
  if (error) throw new Error(`Failed to load contacts (${error.code})`);
  return data.map((c) => ({
    id: c.id,
    clientId: c.client_id,
    name: [c.first_name, c.last_name].filter(Boolean).join(" "),
  }));
}
