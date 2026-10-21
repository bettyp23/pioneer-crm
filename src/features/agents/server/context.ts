import "server-only";

import { CONTEXT_SECTIONS, type ContextSection } from "@/features/agents/schemas";
import { scanForSensitiveContent, type SensitivityFlag } from "@/lib/ai/sensitivity";
import { formatMoney } from "@/lib/money";
import type { SupabaseServerClient } from "@/server/db/server-client";

// Builds the curated, frozen context for a work item (security.md §7: chosen by a human, not
// a live query for the agent). Reads run as the signed-in user, so RLS applies.
export async function buildContextSnapshot(
  supabase: SupabaseServerClient,
  workspaceId: string,
  scope: { clientId: string | null; projectId: string | null },
  options: Record<ContextSection, boolean>,
): Promise<{ snapshot: string; flags: SensitivityFlag[] }> {
  const parts: string[] = [];
  const { clientId, projectId } = scope;

  if (clientId && options.client) {
    const { data: c } = await supabase
      .from("clients")
      .select("name, kind, status, industry, website_url")
      .eq("workspace_id", workspaceId)
      .eq("id", clientId)
      .maybeSingle();
    if (c) {
      parts.push(
        `## Client\n- Name: ${c.name}\n- Type: ${c.kind}\n- Status: ${c.status}` +
          (c.industry ? `\n- Industry: ${c.industry}` : "") +
          (c.website_url ? `\n- Website: ${c.website_url}` : ""),
      );
    }
  }
  if (clientId && options.leads) {
    const { data: leads } = await supabase
      .from("leads")
      .select("title, stage:pipeline_stages!leads_stage_fkey(name)")
      .eq("workspace_id", workspaceId)
      .eq("client_id", clientId)
      .is("archived_at", null);
    if (leads?.length) {
      parts.push(
        `## Open leads\n${leads.map((l) => `- ${l.title} (${l.stage?.name ?? "?"})`).join("\n")}`,
      );
    }
  }
  if (projectId && options.project) {
    const [{ data: p }, { data: pr }] = await Promise.all([
      supabase
        .from("projects")
        .select("name, status, start_on, target_end_on")
        .eq("id", projectId)
        .maybeSingle(),
      supabase
        .from("project_progress")
        .select("percent_done, done_tasks, total_tasks")
        .eq("project_id", projectId)
        .maybeSingle(),
    ]);
    if (p) {
      parts.push(
        `## Project\n- Name: ${p.name}\n- Status: ${p.status}\n- Started: ${p.start_on}` +
          (p.target_end_on ? `\n- Target end: ${p.target_end_on}` : "") +
          (pr
            ? `\n- Progress: ${pr.percent_done}% (${pr.done_tasks}/${pr.total_tasks} tasks)`
            : ""),
      );
    }
  }
  if (projectId && options.tasks) {
    const { data: tasks } = await supabase
      .from("project_tasks")
      .select("title, status, due_on, phase")
      .eq("project_id", projectId)
      .order("position");
    if (tasks?.length) {
      parts.push(
        `## Tasks\n${tasks.map((t) => `- [${t.status}] ${t.title}${t.due_on ? ` (due ${t.due_on})` : ""}`).join("\n")}`,
      );
    }
  }
  if (projectId && options.inputs) {
    const { data: inputs } = await supabase
      .from("client_input_requests")
      .select("label, status")
      .eq("project_id", projectId)
      .not("status", "in", "(accepted,waived)");
    if (inputs?.length) {
      parts.push(
        `## Waiting on the client\n${inputs.map((i) => `- ${i.label} (${i.status})`).join("\n")}`,
      );
    }
  }

  // Opt-in sections (D-22): included only when ticked, and always flagged for review.
  const optInFlags: SensitivityFlag[] = [];
  if (clientId && options.contacts) {
    const { data: contacts } = await supabase
      .from("contacts")
      .select("first_name, last_name, job_title, email, phone")
      .eq("client_id", clientId)
      .is("archived_at", null);
    parts.push(
      `## Contacts\n${(contacts ?? [])
        .map(
          (c) =>
            `- ${[c.first_name, c.last_name].filter(Boolean).join(" ")}${c.job_title ? `, ${c.job_title}` : ""}${c.email ? `, ${c.email}` : ""}${c.phone ? `, ${c.phone}` : ""}`,
        )
        .join("\n")}`,
    );
    optInFlags.push({ kind: "opt_in_section", sample: CONTEXT_SECTIONS.contacts.label });
  }
  if (clientId && options.notes) {
    const [{ data: c }, { data: acts }] = await Promise.all([
      supabase.from("clients").select("notes").eq("id", clientId).maybeSingle(),
      supabase
        .from("activities")
        .select("type, subject, body, occurred_at")
        .eq("client_id", clientId)
        .order("occurred_at", { ascending: false })
        .limit(10),
    ]);
    parts.push(
      `## Notes and recent activity\n${c?.notes ? `${c.notes}\n` : ""}${(acts ?? [])
        .map(
          (a) =>
            `- ${a.occurred_at.slice(0, 10)} ${a.type}: ${a.subject}${a.body ? ` — ${a.body}` : ""}`,
        )
        .join("\n")}`,
    );
    optInFlags.push({ kind: "opt_in_section", sample: CONTEXT_SECTIONS.notes.label });
  }
  if (clientId && options.sows) {
    const { data: sows } = await supabase
      .from("sow_documents")
      .select("title, version_label, status, scope_summary")
      .eq("client_id", clientId);
    parts.push(
      `## SOWs\n${(sows ?? [])
        .map(
          (s) =>
            `- ${s.title}${s.version_label ? ` (${s.version_label})` : ""} — ${s.status}${s.scope_summary ? `: ${s.scope_summary}` : ""}`,
        )
        .join("\n")}`,
    );
    optInFlags.push({ kind: "opt_in_section", sample: CONTEXT_SECTIONS.sows.label });
  }
  if (clientId && options.invoices) {
    const { data: invoices } = await supabase
      .from("invoices")
      .select("external_number, amount_minor, currency, status, due_on")
      .eq("client_id", clientId);
    parts.push(
      `## Invoices\n${(invoices ?? [])
        .map(
          (i) =>
            `- ${i.external_number}: ${formatMoney(i.amount_minor, i.currency)} (${i.status}${i.due_on ? `, due ${i.due_on}` : ""})`,
        )
        .join("\n")}`,
    );
    optInFlags.push({ kind: "opt_in_section", sample: CONTEXT_SECTIONS.invoices.label });
  }

  const snapshot = parts.join("\n\n");
  return { snapshot, flags: [...optInFlags, ...scanForSensitiveContent(snapshot)] };
}
