import "server-only";

import { notFound } from "next/navigation";
import { z } from "zod";

import { dateInZone } from "@/lib/dates";
import { requireMember } from "@/server/auth/session";

// Creates any due routine occurrences (idempotent; members only — D-15 until cron in M7).
export async function ensureRoutineRuns() {
  const { supabase, member } = await requireMember();
  const today = dateInZone(new Date(), member.workspaceTimezone);
  const { error } = await supabase.rpc("generate_routine_runs", {
    p_workspace_id: member.workspaceId,
    p_through: today,
  });
  if (error) console.error("routine_runs.generate_failed", { code: error.code });
  return today;
}

export async function listRoutines() {
  const { supabase, member } = await requireMember();
  const [{ data, error }, { data: compliance, error: cError }] = await Promise.all([
    supabase
      .from("routines")
      .select(
        "*, client:clients!routines_client_fkey(id, name), owner:workspace_members!routines_owner_fkey(profile:profiles(display_name))",
      )
      .eq("workspace_id", member.workspaceId)
      .order("is_active", { ascending: false })
      .order("next_due_on", { ascending: true, nullsFirst: false }),
    supabase.from("routine_compliance").select("*").eq("workspace_id", member.workspaceId),
  ]);
  if (error) throw new Error(`Failed to load routines (${error.code})`);
  if (cError) throw new Error(`Failed to load compliance (${cError.code})`);
  const byId = new Map(compliance.map((c) => [c.routine_id, c]));
  return data.map((r) => ({ ...r, compliance: byId.get(r.id) ?? null }));
}

export async function listDueRuns(through: string) {
  const { supabase, member } = await requireMember();
  const { data, error } = await supabase
    .from("routine_runs")
    .select(
      "id, scheduled_for, status, routine:routines!routine_runs_routine_fkey(id, name, client:clients!routines_client_fkey(name))",
    )
    .eq("workspace_id", member.workspaceId)
    .eq("status", "pending")
    .lte("scheduled_for", through)
    .order("scheduled_for");
  if (error) throw new Error(`Failed to load routine runs (${error.code})`);
  return data;
}

export async function getRoutine(id: string) {
  if (!z.uuid().safeParse(id).success) notFound();
  const { supabase, member } = await requireMember();
  const { data, error } = await supabase
    .from("routines")
    .select(
      "*, client:clients!routines_client_fkey(id, name), runs:routine_runs(id, scheduled_for, status, notes, completed_at, completed_by)",
    )
    .eq("id", id)
    .eq("workspace_id", member.workspaceId)
    .maybeSingle();
  if (error) throw new Error(`Failed to load routine (${error.code})`);
  if (!data) notFound();
  return {
    ...data,
    runs: [...data.runs].sort((a, b) => b.scheduled_for.localeCompare(a.scheduled_for)),
  };
}

export async function listDiagnostics(filter: { clientId?: string } = {}) {
  const { supabase, member } = await requireMember();
  let query = supabase
    .from("diagnostics")
    .select(
      "*, client:clients!diagnostics_client_fkey(id, name), issues:issues!issues_diagnostic_fkey(count)",
    )
    .eq("workspace_id", member.workspaceId)
    .order("performed_on", { ascending: false })
    .limit(300);
  if (filter.clientId) query = query.eq("client_id", filter.clientId);
  const { data, error } = await query;
  if (error) throw new Error(`Failed to load diagnostics (${error.code})`);
  return data;
}

export async function listIssues(filter: { clientId?: string; open?: boolean } = {}) {
  const { supabase, member } = await requireMember();
  let query = supabase
    .from("issues")
    .select(
      "*, client:clients!issues_client_fkey(id, name), diagnostic:diagnostics!issues_diagnostic_fkey(id, diagnostic_type, performed_on)",
    )
    .eq("workspace_id", member.workspaceId)
    .order("opened_at", { ascending: false })
    .limit(500);
  if (filter.clientId) query = query.eq("client_id", filter.clientId);
  if (filter.open) query = query.not("status", "in", "(resolved,wont_fix)");
  const { data, error } = await query;
  if (error) throw new Error(`Failed to load issues (${error.code})`);
  return data;
}

export async function getIssue(id: string) {
  if (!z.uuid().safeParse(id).success) notFound();
  const { supabase, member } = await requireMember();
  const { data, error } = await supabase
    .from("issues")
    .select(
      "*, client:clients!issues_client_fkey(id, name), diagnostic:diagnostics!issues_diagnostic_fkey(id, diagnostic_type, performed_on)",
    )
    .eq("id", id)
    .eq("workspace_id", member.workspaceId)
    .maybeSingle();
  if (error) throw new Error(`Failed to load issue (${error.code})`);
  if (!data) notFound();
  return data;
}

export async function listInvoices(filter: { clientId?: string } = {}) {
  const { supabase, member } = await requireMember();
  let query = supabase
    .from("invoices")
    .select(
      "*, client:clients!invoices_client_fkey(id, name), project:projects!invoices_project_fkey(id, name)",
    )
    .eq("workspace_id", member.workspaceId)
    .order("issued_on", { ascending: false })
    .limit(500);
  if (filter.clientId) query = query.eq("client_id", filter.clientId);
  const { data, error } = await query;
  if (error) throw new Error(`Failed to load invoices (${error.code})`);
  return data;
}

export async function getInvoice(id: string) {
  if (!z.uuid().safeParse(id).success) notFound();
  const { supabase, member } = await requireMember();
  const { data, error } = await supabase
    .from("invoices")
    .select("*")
    .eq("id", id)
    .eq("workspace_id", member.workspaceId)
    .maybeSingle();
  if (error) throw new Error(`Failed to load invoice (${error.code})`);
  if (!data) notFound();
  return data;
}

export async function listProjectOptions() {
  const { supabase, member } = await requireMember();
  const { data, error } = await supabase
    .from("projects")
    .select("id, name, client_id")
    .eq("workspace_id", member.workspaceId)
    .order("name");
  if (error) throw new Error(`Failed to load projects (${error.code})`);
  return data.map((p) => ({ id: p.id, name: p.name, clientId: p.client_id }));
}

export async function getReports() {
  const { supabase, member } = await requireMember();
  const ws = member.workspaceId;
  const [pipeline, health, overdue, compliance, issues, receivables] = await Promise.all([
    supabase.from("pipeline_summary").select("*").eq("workspace_id", ws).order("position"),
    supabase
      .from("project_health")
      .select("*")
      .eq("workspace_id", ws)
      .eq("status", "active")
      .order("name"),
    supabase
      .from("overdue_tasks")
      .select("*")
      .eq("workspace_id", ws)
      .order("days_overdue", { ascending: false })
      .limit(50),
    supabase
      .from("routine_compliance")
      .select("*")
      .eq("workspace_id", ws)
      .eq("is_active", true)
      .order("name"),
    supabase.from("open_issues_by_severity").select("*").eq("workspace_id", ws),
    supabase.from("receivables_by_status").select("*").eq("workspace_id", ws),
  ]);
  for (const r of [pipeline, health, overdue, compliance, issues, receivables]) {
    if (r.error) throw new Error(`Failed to load reports (${r.error.code})`);
  }
  return {
    pipeline: pipeline.data ?? [],
    health: health.data ?? [],
    overdue: overdue.data ?? [],
    compliance: compliance.data ?? [],
    issues: issues.data ?? [],
    receivables: receivables.data ?? [],
  };
}
