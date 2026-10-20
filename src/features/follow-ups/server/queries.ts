import "server-only";

import { dateInZone } from "@/lib/dates";
import { requireMember } from "@/server/auth/session";

export async function listOpenFollowUps(filter: {
  scope?: "mine" | "all";
  clientId?: string;
  leadId?: string;
}) {
  const { supabase, member } = await requireMember();
  let query = supabase
    .from("follow_ups")
    .select(
      `id, title, due_on, status, assignee_user_id, client_id,
       client:clients!follow_ups_client_fkey(id, name),
       lead:leads!follow_ups_lead_fkey(id, title),
       assignee:workspace_members!follow_ups_assignee_fkey(profile:profiles(display_name))`,
    )
    .eq("workspace_id", member.workspaceId)
    .eq("status", "open")
    .order("due_on")
    .limit(500);
  if (filter.clientId) query = query.eq("client_id", filter.clientId);
  if (filter.leadId) query = query.eq("lead_id", filter.leadId);
  // "Mine" includes unassigned follow-ups so nothing falls through the cracks.
  if (filter.scope === "mine") {
    query = query.or(`assignee_user_id.eq.${member.userId},assignee_user_id.is.null`);
  }
  const { data, error } = await query;
  if (error) throw new Error(`Failed to load follow-ups (${error.code})`);
  return { followUps: data, today: dateInZone(new Date(), member.workspaceTimezone) };
}

export type FollowUpRow = Awaited<ReturnType<typeof listOpenFollowUps>>["followUps"][number];
