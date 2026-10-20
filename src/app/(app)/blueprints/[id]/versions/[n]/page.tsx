import type { Metadata } from "next";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { DraftEditor, type EditorTask } from "@/features/blueprints/components/draft-editor";
import { VersionView } from "@/features/blueprints/components/version-view";
import { getBlueprintVersion } from "@/features/blueprints/server/queries";
import { listMembers } from "@/features/workspace/server/queries";
import { formatDateTime } from "@/lib/format";
import { can } from "@/server/auth/permissions";
import { requireMember } from "@/server/auth/session";

export const metadata: Metadata = { title: "Blueprint version" };

export default async function BlueprintVersionPage({
  params,
}: PageProps<"/blueprints/[id]/versions/[n]">) {
  const { member } = await requireMember();
  const { id, n } = await params;
  const version = await getBlueprintVersion(id, n);
  const tz = member.workspaceTimezone;

  const deps = new Map<string, string[]>();
  for (const d of version.dependencies) {
    deps.set(d.task_template_id, [...(deps.get(d.task_template_id) ?? []), d.depends_on_id]);
  }
  const tasks: EditorTask[] = version.tasks.map((t) => ({ ...t, dependsOn: deps.get(t.id) ?? [] }));
  const editable = version.status === "draft" && can(member.role, "catalog.manage");

  let publisher: string | null = null;
  if (version.published_by) {
    const members = await listMembers();
    publisher =
      members.find((m) => m.user_id === version.published_by)?.profile?.display_name ??
      "Former member";
  }

  return (
    <>
      <div className="flex flex-col gap-2">
        <p className="text-muted-foreground text-sm">
          <Link href="/blueprints" className="hover:underline">
            Blueprints
          </Link>
          {" · "}
          <Link href={`/blueprints/${version.blueprint.id}`} className="hover:underline">
            {version.blueprint.name}
          </Link>
        </p>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          Version {version.version_number}
          <Badge
            variant={version.status === "published" ? "default" : "secondary"}
            className="capitalize"
          >
            {version.status}
          </Badge>
        </h1>
        {version.status !== "draft" ? (
          <p className="text-muted-foreground text-sm">
            Published {version.published_at ? formatDateTime(version.published_at, tz) : ""}
            {publisher ? ` by ${publisher}` : ""}
            {version.retired_at ? ` · retired ${formatDateTime(version.retired_at, tz)}` : ""}
            {version.change_summary ? ` · ${version.change_summary}` : ""}
          </p>
        ) : (
          <p className="text-muted-foreground text-sm">
            Draft — editable until published. Projects can only use published versions.
          </p>
        )}
        {version.content_hash ? (
          <p className="text-muted-foreground font-mono text-xs break-all">
            Content hash {version.content_hash}
          </p>
        ) : null}
      </div>

      {editable ? (
        <DraftEditor
          versionId={version.id}
          tasks={tasks}
          inputs={version.inputs}
          problems={version.problems}
          canPublish={can(member.role, "blueprints.publish")}
        />
      ) : (
        <VersionView tasks={tasks} inputs={version.inputs} />
      )}
    </>
  );
}
