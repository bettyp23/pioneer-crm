import "server-only";

import { notFound } from "next/navigation";
import { z } from "zod";

import { requireMember } from "@/server/auth/session";

export async function listAgents() {
  const { supabase, member } = await requireMember();
  const { data, error } = await supabase
    .from("agents")
    .select("*")
    .eq("workspace_id", member.workspaceId)
    .order("is_active", { ascending: false })
    .order("name");
  if (error) throw new Error(`Failed to load agents (${error.code})`);
  return data;
}

export async function getAgent(id: string) {
  if (!z.uuid().safeParse(id).success) notFound();
  const { supabase, member } = await requireMember();
  const { data, error } = await supabase
    .from("agents")
    .select("*")
    .eq("id", id)
    .eq("workspace_id", member.workspaceId)
    .maybeSingle();
  if (error) throw new Error(`Failed to load agent (${error.code})`);
  if (!data) notFound();
  return data;
}

export async function listWorkItems() {
  const { supabase, member } = await requireMember();
  const { data, error } = await supabase
    .from("agent_work_items")
    .select(
      "id, title, status, work_type, created_at, updated_at, agent:agents!agent_work_items_agent_fkey(id, name), client:clients!agent_work_items_client_fkey(id, name)",
    )
    .eq("workspace_id", member.workspaceId)
    .order("updated_at", { ascending: false })
    .limit(300);
  if (error) throw new Error(`Failed to load work items (${error.code})`);
  return data;
}

export async function getWorkItem(id: string) {
  if (!z.uuid().safeParse(id).success) notFound();
  const { supabase, member } = await requireMember();
  const { data, error } = await supabase
    .from("agent_work_items")
    .select(
      "*, agent:agents!agent_work_items_agent_fkey(id, name, instructions, provider, allowed_work_types), client:clients!agent_work_items_client_fkey(id, name), project:projects!agent_work_items_project_fkey(id, name)",
    )
    .eq("id", id)
    .eq("workspace_id", member.workspaceId)
    .maybeSingle();
  if (error) throw new Error(`Failed to load work item (${error.code})`);
  if (!data) notFound();
  const [{ data: actions }, { data: usage }] = await Promise.all([
    supabase
      .from("proposed_actions")
      .select("id, title, action_type, status")
      .eq("work_item_id", id)
      .order("created_at"),
    supabase
      .from("ai_usage")
      .select("id, provider, cost_microusd, note, occurred_at")
      .eq("work_item_id", id)
      .order("occurred_at"),
  ]);
  return { ...data, actions: actions ?? [], usage: usage ?? [] };
}

export async function listActions(filter: { status?: "pending" } = {}) {
  const { supabase, member } = await requireMember();
  let query = supabase
    .from("proposed_actions")
    .select(
      "*, client:clients!proposed_actions_client_fkey(id, name), work_item:agent_work_items!proposed_actions_work_item_fkey(id, title)",
    )
    .eq("workspace_id", member.workspaceId)
    .order("created_at", { ascending: false })
    .limit(300);
  if (filter.status) query = query.eq("status", filter.status);
  const { data, error } = await query;
  if (error) throw new Error(`Failed to load actions (${error.code})`);
  return data;
}

export async function getUsageSummary() {
  const { supabase, member } = await requireMember();
  const [spend, ledger] = await Promise.all([
    supabase.from("ai_spend_this_month").select("*").eq("workspace_id", member.workspaceId),
    supabase
      .from("ai_usage")
      .select("id, provider, cost_microusd, note, occurred_at, work_item_id")
      .eq("workspace_id", member.workspaceId)
      .order("occurred_at", { ascending: false })
      .limit(100),
  ]);
  if (spend.error) throw new Error(`Failed to load spend (${spend.error.code})`);
  if (ledger.error) throw new Error(`Failed to load usage (${ledger.error.code})`);
  return { spend: spend.data, ledger: ledger.data };
}
