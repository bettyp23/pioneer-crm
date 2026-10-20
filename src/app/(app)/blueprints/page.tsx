import type { Metadata } from "next";
import Link from "next/link";

import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
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
import { listBlueprints } from "@/features/blueprints/server/queries";
import { formatDate } from "@/lib/format";
import { can } from "@/server/auth/permissions";
import { requireMember } from "@/server/auth/session";

export const metadata: Metadata = { title: "Blueprints" };

export default async function BlueprintsPage() {
  const { member } = await requireMember();
  const blueprints = await listBlueprints();

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          title="Blueprints"
          description="Versioned delivery templates. Published versions never change."
        />
        {can(member.role, "catalog.manage") ? (
          <Button asChild>
            <Link href="/blueprints/new">New blueprint</Link>
          </Button>
        ) : null}
      </div>
      {blueprints.length === 0 ? (
        <EmptyState title="No blueprints yet" />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Blueprint</TableHead>
                <TableHead className="hidden md:table-cell">Service</TableHead>
                <TableHead>Published</TableHead>
                <TableHead>Draft</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {blueprints.map((bp) => (
                <TableRow key={bp.id}>
                  <TableCell className="font-medium">
                    <Link href={`/blueprints/${bp.id}`} className="hover:underline">
                      {bp.name}
                    </Link>{" "}
                    {bp.archived_at ? <Badge variant="outline">Archived</Badge> : null}
                  </TableCell>
                  <TableCell className="text-muted-foreground hidden md:table-cell">
                    {bp.service?.name ?? "—"}
                  </TableCell>
                  <TableCell>
                    {bp.latestPublished?.published_at ? (
                      <span>
                        v{bp.latestPublished.version_number}{" "}
                        <span className="text-muted-foreground text-xs">
                          {formatDate(bp.latestPublished.published_at, member.workspaceTimezone)}
                        </span>
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Not published</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {bp.draft ? (
                      <Link href={`/blueprints/${bp.id}/versions/${bp.draft.version_number}`}>
                        <Badge variant="secondary">Draft v{bp.draft.version_number}</Badge>
                      </Link>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
