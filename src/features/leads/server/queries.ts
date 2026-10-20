import "server-only";

import { notFound } from "next/navigation";
import { z } from "zod";

import { requireMember } from "@/server/auth/session";

const LEAD_COLUMNS = `
  id, title, source, stage_id, primary_contact_id, estimated_value_minor, currency, expected_close_on,
  owner_user_id, lost_reason, closed_at, archived_at, created_at, updated_at, client_id,
  client:clients!leads_client_fkey(id, name),
  contact:contacts!leads_primary_contact_fkey(id, first_name, last_name),
  owner:workspace_members!leads_owner_fkey(profile:profiles(display_name))
`;

export async function listStages() {
  const { supabase, member } = await requireMember();
  const { data, error } = await supabase
    .from("pipeline_stages")
    .select("id, name, position, kind")
    .eq("workspace_id", member.workspaceId)
    .order("position");
  if (error) throw new Error(`Failed to load stages (${error.code})`);
  return data;
}

export async function listLeads(filter: { clientId?: string } = {}) {
  const { supabase, member } = await requireMember();
  let query = supabase
    .from("leads")
    .select(LEAD_COLUMNS)
    .eq("workspace_id", member.workspaceId)
    .is("archived_at", null)
    .order("updated_at", { ascending: false })
    .limit(500);
  if (filter.clientId) query = query.eq("client_id", filter.clientId);
  const { data, error } = await query;
  if (error) throw new Error(`Failed to load leads (${error.code})`);
  return data;
}

export type LeadRow = Awaited<ReturnType<typeof listLeads>>[number];

export async function getLead(id: string) {
  if (!z.uuid().safeParse(id).success) notFound();
  const { supabase, member } = await requireMember();
  const { data, error } = await supabase
    .from("leads")
    .select(LEAD_COLUMNS)
    .eq("id", id)
    .eq("workspace_id", member.workspaceId)
    .maybeSingle();
  if (error) throw new Error(`Failed to load lead (${error.code})`);
  if (!data) notFound();
  return data;
}

// Active members for owner/assignee pickers.
export async function listMemberOptions() {
  const { supabase, member } = await requireMember();
  const { data, error } = await supabase
    .from("workspace_members")
    .select("user_id, profile:profiles(display_name)")
    .eq("workspace_id", member.workspaceId)
    .eq("status", "active")
    .in("role", ["owner", "admin", "member"]);
  if (error) throw new Error(`Failed to load members (${error.code})`);
  return data
    .map((m) => ({ id: m.user_id, name: m.profile?.display_name ?? "Unknown" }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
