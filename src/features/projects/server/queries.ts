import "server-only";

import { notFound } from "next/navigation";
import { z } from "zod";

import { requireMember } from "@/server/auth/session";

export async function listClientSows(clientId: string) {
  const { supabase, member } = await requireMember();
  const { data, error } = await supabase
    .from("sow_documents")
    .select("*")
    .eq("workspace_id", member.workspaceId)
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Failed to load SOWs (${error.code})`);
  return data;
}

export async function listProjects(filter: { clientId?: string } = {}) {
  const { supabase, member } = await requireMember();
  let query = supabase
    .from("projects")
    .select(
      `id, name, status, start_on, target_end_on, sow_id, no_sow_reason, client_id,
       client:clients!projects_client_fkey(id, name),
       version:blueprint_versions!projects_blueprint_version_fkey(version_number,
         blueprint:blueprints!blueprint_versions_blueprint_fkey(name))`,
    )
    .eq("workspace_id", member.workspaceId)
    .order("created_at", { ascending: false })
    .limit(500);
  if (filter.clientId) query = query.eq("client_id", filter.clientId);
  const [{ data, error }, { data: progress, error: progressError }] = await Promise.all([
    query,
    supabase.from("project_progress").select("*").eq("workspace_id", member.workspaceId),
  ]);
  if (error) throw new Error(`Failed to load projects (${error.code})`);
  if (progressError) throw new Error(`Failed to load progress (${progressError.code})`);
  const byProject = new Map(progress.map((p) => [p.project_id, p]));
  return data.map((p) => ({ ...p, progress: byProject.get(p.id) ?? null }));
}

export async function getProject(id: string) {
  if (!z.uuid().safeParse(id).success) notFound();
  const { supabase, member } = await requireMember();
  const { data: project, error } = await supabase
    .from("projects")
    .select(
      `*, client:clients!projects_client_fkey(id, name),
       sow:sow_documents!projects_sow_fkey(id, title, version_label, drive_url, signed_on, client_signatory, status),
       lead:leads!projects_lead_fkey(id, title),
       version:blueprint_versions!projects_blueprint_version_fkey(version_number, blueprint_id,
         blueprint:blueprints!blueprint_versions_blueprint_fkey(name))`,
    )
    .eq("id", id)
    .eq("workspace_id", member.workspaceId)
    .maybeSingle();
  if (error) throw new Error(`Failed to load project (${error.code})`);
  if (!project) notFound();

  const [tasks, readiness, deps, inputs, approvals, progress] = await Promise.all([
    supabase
      .from("project_tasks")
      .select(
        "id, key, title, description, phase, position, status, assignee_user_id, due_on, estimated_hours, requires_approval, approval_approver, cancel_reason, version",
      )
      .eq("project_id", id)
      .order("position"),
    supabase.from("task_readiness").select("*").eq("project_id", id),
    supabase.from("task_dependencies").select("task_id, depends_on_task_id").eq("project_id", id),
    supabase.from("client_input_requests").select("*").eq("project_id", id).order("label"),
    supabase
      .from("approvals")
      .select("*, contact:contacts!approvals_client_contact_fkey(first_name, last_name)")
      .eq("project_id", id)
      .order("created_at", { ascending: false }),
    supabase.from("project_progress").select("*").eq("project_id", id).maybeSingle(),
  ]);
  for (const r of [tasks, readiness, deps, inputs, approvals, progress]) {
    if (r.error) throw new Error(`Failed to load project details (${r.error.code})`);
  }
  const readinessByTask = new Map((readiness.data ?? []).map((r) => [r.task_id, r]));
  return {
    project,
    tasks: (tasks.data ?? []).map((t) => ({ ...t, readiness: readinessByTask.get(t.id) ?? null })),
    dependencies: deps.data ?? [],
    inputs: inputs.data ?? [],
    approvals: approvals.data ?? [],
    progress: progress.data,
  };
}

export type ProjectDetail = Awaited<ReturnType<typeof getProject>>;

// Options for the generation form.
export async function getGenerationOptions() {
  const { supabase, member } = await requireMember();
  const [clients, sows, versions, leads] = await Promise.all([
    supabase
      .from("clients")
      .select("id, name")
      .eq("workspace_id", member.workspaceId)
      .is("archived_at", null)
      .order("name"),
    supabase
      .from("sow_documents")
      .select("id, client_id, title, version_label, signed_on")
      .eq("workspace_id", member.workspaceId)
      .eq("status", "signed")
      .order("signed_on", { ascending: false }),
    supabase
      .from("blueprint_versions")
      .select(
        "id, version_number, blueprint:blueprints!blueprint_versions_blueprint_fkey(name, archived_at), tasks:task_templates(count)",
      )
      .eq("workspace_id", member.workspaceId)
      .eq("status", "published")
      .order("version_number", { ascending: false }),
    supabase
      .from("leads")
      .select("id, client_id, title")
      .eq("workspace_id", member.workspaceId)
      .is("archived_at", null)
      .order("title"),
  ]);
  for (const r of [clients, sows, versions, leads]) {
    if (r.error) throw new Error(`Failed to load generation options (${r.error.code})`);
  }
  return {
    clients: clients.data ?? [],
    sows: (sows.data ?? []).map((s) => ({
      id: s.id,
      clientId: s.client_id,
      name: `${s.title}${s.version_label ? ` (${s.version_label})` : ""} — signed ${s.signed_on}`,
    })),
    versions: (versions.data ?? [])
      .filter((v) => v.blueprint && !v.blueprint.archived_at)
      .map((v) => ({
        id: v.id,
        name: `${v.blueprint?.name} v${v.version_number} (${v.tasks[0]?.count ?? 0} tasks)`,
      })),
    leads: (leads.data ?? []).map((l) => ({ id: l.id, clientId: l.client_id, name: l.title })),
  };
}

export async function listPendingApprovals() {
  const { supabase, member } = await requireMember();
  const { data, error } = await supabase
    .from("approvals")
    .select(
      `*, project:projects!approvals_project_fkey(id, name, client:clients!projects_client_fkey(id, name)),
       task:project_tasks!approvals_task_fkey(title, status)`,
    )
    .eq("workspace_id", member.workspaceId)
    .eq("status", "pending")
    .order("created_at");
  if (error) throw new Error(`Failed to load approvals (${error.code})`);
  return data;
}

// Tasks that can start now (dashboard). Readiness comes from the task_readiness view.
export async function listReadyTasks(limit = 8) {
  const { supabase, member } = await requireMember();
  const { data, error } = await supabase
    .from("task_readiness")
    .select("task_id")
    .eq("workspace_id", member.workspaceId)
    .eq("status", "todo")
    .eq("can_start", true)
    .limit(200);
  if (error) throw new Error(`Failed to load ready tasks (${error.code})`);
  const ids = data.map((r) => r.task_id).filter((x): x is string => x !== null);
  if (ids.length === 0) return [];
  const { data: tasks, error: taskError } = await supabase
    .from("project_tasks")
    .select(
      "id, title, due_on, assignee_user_id, project:projects!project_tasks_project_fkey(id, name, status)",
    )
    .in("id", ids)
    .order("due_on", { ascending: true, nullsFirst: false })
    .limit(limit * 2);
  if (taskError) throw new Error(`Failed to load ready tasks (${taskError.code})`);
  return tasks.filter((t) => t.project?.status === "active").slice(0, limit);
}
