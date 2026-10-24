import type { Metadata } from "next";

import { formatDate } from "@/lib/format";
import { WorkspaceSettingsForm } from "@/features/workspace/components/workspace-settings-form";
import { getWorkspace } from "@/features/workspace/server/queries";
import { can } from "@/server/auth/permissions";
import { requireMember } from "@/server/auth/session";

export const metadata: Metadata = { title: "Workspace settings" };

export default async function WorkspaceSettingsPage() {
  const { member } = await requireMember();
  const workspace = await getWorkspace();
  const canEdit = can(member.role, "workspace.manage");

  return (
    <section className="flex flex-col gap-6">
      {canEdit ? (
        <WorkspaceSettingsForm
          defaultValues={{ name: workspace.name, timezone: workspace.timezone }}
          timeZones={Intl.supportedValuesOf("timeZone")}
        />
      ) : (
        <dl className="grid max-w-md grid-cols-[8rem_1fr] gap-y-2 text-sm">
          <dt className="text-muted-foreground">Name</dt>
          <dd>{workspace.name}</dd>
          <dt className="text-muted-foreground">Timezone</dt>
          <dd>{workspace.timezone}</dd>
        </dl>
      )}
      <dl className="text-muted-foreground grid max-w-md grid-cols-[8rem_1fr] gap-y-2 text-sm">
        <dt>Slug</dt>
        <dd className="font-mono">{workspace.slug}</dd>
        <dt>Created</dt>
        <dd>{formatDate(workspace.created_at, workspace.timezone)}</dd>
      </dl>
    </section>
  );
}
