import "server-only";

import { requirePagePermission } from "@/server/auth/session";

// Staff reads for the Clients section. Run as the signed-in member under RLS.

// Whether this server can send invites (it has the secret key). Reveals presence only.
export function portalInvitesConfigured(): boolean {
  return Boolean(process.env.SUPABASE_SECRET_KEY);
}

export async function listClientsOverview() {
  const { supabase, member } = await requirePagePermission("records.read");
  const [clients, users, requests, approvals] = await Promise.all([
    supabase
      .from("clients")
      .select("id, name, status, archived_at")
      .eq("workspace_id", member.workspaceId)
      .order("name"),
    supabase
      .from("profiles")
      .select("user_id, client_id")
      .eq("role", "client")
      .not("client_id", "is", null),
    supabase
      .from("client_requests")
      .select("client_id")
      .eq("workspace_id", member.workspaceId)
      .in("status", ["open", "in_progress"]),
    supabase
      .from("approvals")
      .select("client_id")
      .eq("workspace_id", member.workspaceId)
      .eq("approver_type", "client")
      .eq("status", "pending"),
  ]);
  for (const r of [clients, users, requests, approvals]) {
    if (r.error) throw new Error(`Failed to load clients (${r.error.code})`);
  }
  const countBy = (rows: { client_id: string | null }[] | null) => {
    const counts = new Map<string, number>();
    for (const row of rows ?? []) {
      if (row.client_id) counts.set(row.client_id, (counts.get(row.client_id) ?? 0) + 1);
    }
    return counts;
  };
  const userCounts = countBy(users.data);
  const requestCounts = countBy(requests.data);
  const approvalCounts = countBy(approvals.data);
  return (clients.data ?? []).map((c) => ({
    ...c,
    portalUsers: userCounts.get(c.id) ?? 0,
    openRequests: requestCounts.get(c.id) ?? 0,
    pendingApprovals: approvalCounts.get(c.id) ?? 0,
  }));
}

export async function getClientAdmin(clientId: string) {
  const { supabase, member } = await requirePagePermission("records.read");
  const { data: client, error } = await supabase
    .from("clients")
    .select("id, name, status, archived_at")
    .eq("id", clientId)
    .eq("workspace_id", member.workspaceId)
    .maybeSingle();
  if (error) throw new Error(`Failed to load client (${error.code})`);
  if (!client) return null;

  const [users, projects, approvals, files, requests] = await Promise.all([
    supabase
      .from("profiles")
      .select("user_id, display_name, email, created_at")
      .eq("role", "client")
      .eq("client_id", clientId)
      .order("created_at"),
    supabase
      .from("projects")
      .select(
        "id, name, status, current_phase, next_steps, launch_on, start_on, tasks:project_tasks(id, title, phase, status, version, due_on, position)",
      )
      .eq("client_id", clientId)
      .order("created_at", { ascending: false })
      .order("position", { referencedTable: "project_tasks", ascending: true }),
    supabase
      .from("approvals")
      .select(
        "id, title, details, status, version, decision_note, decided_at, decided_in_portal, created_at, project:projects(name)",
      )
      .eq("client_id", clientId)
      .eq("approver_type", "client")
      .order("created_at", { ascending: false }),
    supabase
      .from("client_files")
      .select("id, title, file_name, size_bytes, created_at, project:projects(name)")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false }),
    supabase
      .from("client_requests")
      .select("id, kind, subject, body, status, admin_reply, created_at, project:projects(name)")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false }),
  ]);
  for (const r of [users, projects, approvals, files, requests]) {
    if (r.error) throw new Error(`Failed to load client details (${r.error.code})`);
  }
  return {
    client,
    users: users.data ?? [],
    projects: projects.data ?? [],
    approvals: approvals.data ?? [],
    files: files.data ?? [],
    requests: requests.data ?? [],
  };
}
