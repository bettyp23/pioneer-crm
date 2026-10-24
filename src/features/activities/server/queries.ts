import "server-only";

import { requireMember } from "@/server/auth/session";

export async function listActivities(filter: { clientId?: string; leadId?: string }) {
  const { supabase, member } = await requireMember();
  let query = supabase
    .from("activities")
    .select(
      `id, type, subject, body, occurred_at, created_by,
       lead:leads!activities_lead_fkey(id, title),
       contact:contacts!activities_contact_fkey(id, first_name, last_name)`,
    )
    .eq("workspace_id", member.workspaceId)
    .order("occurred_at", { ascending: false })
    .limit(200);
  if (filter.clientId) query = query.eq("client_id", filter.clientId);
  if (filter.leadId) query = query.eq("lead_id", filter.leadId);
  const { data, error } = await query;
  if (error) throw new Error(`Failed to load activities (${error.code})`);
  return data;
}
