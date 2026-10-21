import Link from "next/link";

import { EmptyState } from "@/components/layout/empty-state";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { listProjects } from "@/features/projects/server/queries";
import { PROJECT_STATUS_LABELS } from "@/features/projects/transitions";
import { formatIsoDate } from "@/lib/dates";

type Project = Awaited<ReturnType<typeof listProjects>>[number];

export function ProjectTable({
  projects,
  showClient = true,
}: {
  projects: Project[];
  showClient?: boolean;
}) {
  if (projects.length === 0) return <EmptyState title="No projects yet" />;
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Project</TableHead>
            {showClient ? <TableHead>Client</TableHead> : null}
            <TableHead>Status</TableHead>
            <TableHead>Progress</TableHead>
            <TableHead className="hidden md:table-cell">Overdue</TableHead>
            <TableHead className="hidden lg:table-cell">Blueprint</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {projects.map((p) => (
            <TableRow key={p.id}>
              <TableCell className="font-medium">
                <Link href={`/projects/${p.id}`} className="hover:underline">
                  {p.name}
                </Link>
                <span className="text-muted-foreground block text-xs font-normal">
                  Started {formatIsoDate(p.start_on)}
                  {p.sow_id ? "" : " · pilot (no SOW)"}
                </span>
              </TableCell>
              {showClient ? (
                <TableCell>
                  {p.client ? (
                    <Link href={`/clients/${p.client.id}`} className="hover:underline">
                      {p.client.name}
                    </Link>
                  ) : null}
                </TableCell>
              ) : null}
              <TableCell>
                <Badge variant={p.status === "active" ? "default" : "secondary"}>
                  {PROJECT_STATUS_LABELS[p.status]}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <div
                    className="bg-muted h-2 w-20 overflow-hidden rounded-full"
                    role="progressbar"
                    aria-valuenow={p.progress?.percent_done ?? 0}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`${p.name} progress`}
                  >
                    <div
                      className="bg-primary h-full"
                      style={{ width: `${p.progress?.percent_done ?? 0}%` }}
                    />
                  </div>
                  <span className="text-muted-foreground text-xs tabular-nums">
                    {p.progress?.done_tasks ?? 0}/{p.progress?.total_tasks ?? 0}
                  </span>
                </div>
              </TableCell>
              <TableCell className="hidden md:table-cell">
                {(p.progress?.overdue_tasks ?? 0) > 0 ? (
                  <Badge variant="destructive">{p.progress?.overdue_tasks}</Badge>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell className="text-muted-foreground hidden lg:table-cell">
                {p.version?.blueprint?.name} v{p.version?.version_number}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
