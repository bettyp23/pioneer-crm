import "server-only";

import { requireClient } from "@/server/auth/session";

// Every portal read runs as the signed-in client: RLS returns only their own client's rows.
// The explicit client_id filters below are belt-and-braces, not the security boundary.

export async function listPortalProjects() {
  const { supabase, user } = await requireClient();
  const { data, error } = await supabase
    .from("projects")
    .select(
      "id, name, status, current_phase, next_steps, launch_on, start_on, tasks:project_tasks(id, title, phase, status, position, due_on)",
    )
    .eq("client_id", user.client.id)
    .order("created_at", { ascending: false })
    .order("position", { referencedTable: "project_tasks", ascending: true });
  if (error) throw new Error(`Failed to load projects (${error.code})`);
  return data ?? [];
}

export async function listPortalApprovals() {
  const { supabase, user } = await requireClient();
  const { data, error } = await supabase
    .from("approvals")
    .select(
      "id, title, details, status, decision_note, decided_at, created_at, project:projects(name)",
    )
    .eq("client_id", user.client.id)
    .eq("approver_type", "client")
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Failed to load approvals (${error.code})`);
  return data ?? [];
}

export async function listPortalFiles() {
  const { supabase, user } = await requireClient();
  const { data, error } = await supabase
    .from("client_files")
    .select("id, title, file_name, size_bytes, created_at, project:projects(name)")
    .eq("client_id", user.client.id)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Failed to load files (${error.code})`);
  return data ?? [];
}

export async function listPortalRequests() {
  const { supabase, user } = await requireClient();
  const { data, error } = await supabase
    .from("client_requests")
    .select(
      "id, kind, subject, body, status, admin_reply, created_at, updated_at, project:projects(name)",
    )
    .eq("client_id", user.client.id)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Failed to load requests (${error.code})`);
  return data ?? [];
}

export async function countPendingApprovals() {
  const { supabase, user } = await requireClient();
  const { count, error } = await supabase
    .from("approvals")
    .select("id", { count: "exact", head: true })
    .eq("client_id", user.client.id)
    .eq("approver_type", "client")
    .eq("status", "pending");
  if (error) throw new Error(`Failed to count approvals (${error.code})`);
  return count ?? 0;
}
