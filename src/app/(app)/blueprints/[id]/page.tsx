import type { Metadata } from "next";
import Link from "next/link";

import { ActionButton } from "@/components/forms/action-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  createDraft,
  retireVersion,
  setBlueprintArchived,
} from "@/features/blueprints/server/actions";
import { getBlueprint } from "@/features/blueprints/server/queries";
import { formatDateTime } from "@/lib/format";
import { can } from "@/server/auth/permissions";
import { requireMember } from "@/server/auth/session";

export const metadata: Metadata = { title: "Blueprint" };

const STATUS_VARIANT = { draft: "secondary", published: "default", retired: "outline" } as const;

export default async function BlueprintPage({ params }: PageProps<"/blueprints/[id]">) {
  const { member } = await requireMember();
  const bp = await getBlueprint((await params).id);
  const canManage = can(member.role, "catalog.manage");
  const canPublish = can(member.role, "blueprints.publish");
  const draft = bp.versions.find((v) => v.status === "draft");
  const latestPublished = bp.versions.find((v) => v.status === "published");
  const tz = member.workspaceTimezone;

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <p className="text-muted-foreground text-sm">
            <Link href="/blueprints" className="hover:underline">
              Blueprints
            </Link>
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">{bp.name}</h1>
          <p className="text-muted-foreground text-sm">
            {bp.service ? `Delivers ${bp.service.name}` : "No service linked"}
            {bp.archived_at ? " · archived" : ""}
          </p>
        </div>
        {canManage ? (
          <div className="flex flex-wrap gap-2">
            {draft ? (
              <Button asChild>
                <Link href={`/blueprints/${bp.id}/versions/${draft.version_number}`}>
                  Open draft v{draft.version_number}
                </Link>
              </Button>
            ) : !bp.archived_at ? (
              <ActionButton action={createDraft.bind(null, bp.id, latestPublished?.id ?? null)}>
                {latestPublished
                  ? `New draft from v${latestPublished.version_number}`
                  : "New empty draft"}
              </ActionButton>
            ) : null}
            <Button variant="outline" asChild>
              <Link href={`/blueprints/${bp.id}/edit`}>Edit</Link>
            </Button>
            <ActionButton
              variant="ghost"
              action={setBlueprintArchived.bind(null, bp.id, !bp.archived_at)}
              successMessage={bp.archived_at ? "Blueprint restored" : "Blueprint archived"}
            >
              {bp.archived_at ? "Restore" : "Archive"}
            </ActionButton>
          </div>
        ) : null}
      </div>
      {bp.description ? (
        <p className="max-w-2xl text-sm whitespace-pre-wrap">{bp.description}</p>
      ) : null}

      <section className="flex flex-col gap-3">
        <h2 className="font-medium">Versions</h2>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Version</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden md:table-cell">Published</TableHead>
                <TableHead className="hidden lg:table-cell">What changed</TableHead>
                <TableHead className="sr-only">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bp.versions.map((v) => (
                <TableRow key={v.id}>
                  <TableCell className="font-medium">
                    <Link
                      href={`/blueprints/${bp.id}/versions/${v.version_number}`}
                      className="hover:underline"
                    >
                      v{v.version_number}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[v.status]} className="capitalize">
                      {v.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {v.published_at ? formatDateTime(v.published_at, tz) : "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground hidden max-w-sm truncate lg:table-cell">
                    {v.change_summary ?? "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    {canPublish && v.status === "published" ? (
                      <ActionButton
                        size="sm"
                        variant="ghost"
                        action={retireVersion.bind(null, v.id)}
                        confirmMessage={`Retire v${v.version_number}? It can no longer be used for new projects.`}
                        successMessage={`v${v.version_number} retired`}
                      >
                        Retire
                      </ActionButton>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>
    </>
  );
}
