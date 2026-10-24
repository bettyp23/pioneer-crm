import "server-only";

import { requireMember, requirePagePermission } from "@/server/auth/session";

// Reads run through the user-bound client: RLS re-checks membership, role and MFA.

export async function getWorkspace() {
  const { supabase, member } = await requireMember();
  const { data, error } = await supabase
    .from("workspaces")
    .select("id, name, slug, timezone, created_at")
    .eq("id", member.workspaceId)
    .single();
  if (error) throw new Error(`Failed to load workspace (${error.code})`);
  return data;
}

export async function listMembers() {
  const { supabase, member } = await requireMember();
  const { data, error } = await supabase
    .from("workspace_members")
    .select("user_id, role, status, created_at, profile:profiles(display_name)")
    .eq("workspace_id", member.workspaceId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`Failed to load members (${error.code})`);
  return data;
}

export const AUDIT_PAGE_SIZE = 50;

export async function listAuditEvents(page: number) {
  const { supabase, member } = await requirePagePermission("audit.read");
  const from = (page - 1) * AUDIT_PAGE_SIZE;
  const { data, error, count } = await supabase
    .from("audit_events")
    .select("id, occurred_at, actor_type, actor_user_id, action, entity_type, entity_id, changes", {
      count: "exact",
    })
    .eq("workspace_id", member.workspaceId)
    .order("occurred_at", { ascending: false })
    .order("id", { ascending: false })
    .range(from, from + AUDIT_PAGE_SIZE - 1);
  if (error) throw new Error(`Failed to load audit events (${error.code})`);
  return { events: data, total: count ?? 0 };
}
