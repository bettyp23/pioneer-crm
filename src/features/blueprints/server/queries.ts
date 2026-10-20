import "server-only";

import { notFound } from "next/navigation";
import { z } from "zod";

import { requireMember } from "@/server/auth/session";

export async function listBlueprints() {
  const { supabase, member } = await requireMember();
  const { data, error } = await supabase
    .from("blueprints")
    .select(
      `id, name, description, archived_at,
       service:services!blueprints_service_fkey(id, name),
       versions:blueprint_versions(id, version_number, status, published_at)`,
    )
    .eq("workspace_id", member.workspaceId)
    .order("name");
  if (error) throw new Error(`Failed to load blueprints (${error.code})`);
  return data.map((bp) => {
    const sorted = [...bp.versions].sort((a, b) => b.version_number - a.version_number);
    return {
      ...bp,
      latestPublished: sorted.find((v) => v.status === "published") ?? null,
      draft: sorted.find((v) => v.status === "draft") ?? null,
    };
  });
}

export async function getBlueprint(id: string) {
  if (!z.uuid().safeParse(id).success) notFound();
  const { supabase, member } = await requireMember();
  const { data, error } = await supabase
    .from("blueprints")
    .select(
      `*, service:services!blueprints_service_fkey(id, name),
       versions:blueprint_versions(id, version_number, status, change_summary, content_hash,
         published_at, published_by, retired_at, created_at)`,
    )
    .eq("id", id)
    .eq("workspace_id", member.workspaceId)
    .maybeSingle();
  if (error) throw new Error(`Failed to load blueprint (${error.code})`);
  if (!data) notFound();
  return {
    ...data,
    versions: [...data.versions].sort((a, b) => b.version_number - a.version_number),
  };
}

export async function getBlueprintVersion(blueprintId: string, versionNumber: string) {
  const number = z.coerce.number().int().min(1).safeParse(versionNumber);
  if (!z.uuid().safeParse(blueprintId).success || !number.success) notFound();
  const { supabase, member } = await requireMember();

  const { data: version, error } = await supabase
    .from("blueprint_versions")
    .select(
      `*, blueprint:blueprints!blueprint_versions_blueprint_fkey(id, name, archived_at),
       tasks:task_templates(id, key, title, description, phase, position, estimated_hours,
         due_offset_days, requires_approval, approval_approver),
       dependencies:task_template_dependencies(task_template_id, depends_on_id),
       inputs:input_templates(id, key, label, description, input_kind, required,
         blocks_task_template_id)`,
    )
    .eq("workspace_id", member.workspaceId)
    .eq("blueprint_id", blueprintId)
    .eq("version_number", number.data)
    .maybeSingle();
  if (error) throw new Error(`Failed to load blueprint version (${error.code})`);
  if (!version || !version.blueprint) notFound();

  let problems: string[] = [];
  if (version.status === "draft") {
    const { data: p, error: pError } = await supabase.rpc("blueprint_version_problems", {
      p_version_id: version.id,
    });
    if (pError) throw new Error(`Failed to validate blueprint version (${pError.code})`);
    problems = p ?? [];
  }

  const tasks = [...version.tasks].sort(
    (a, b) => a.position - b.position || a.key.localeCompare(b.key),
  );
  const inputs = [...version.inputs].sort((a, b) => a.key.localeCompare(b.key));
  return { ...version, blueprint: version.blueprint, tasks, inputs, problems };
}
