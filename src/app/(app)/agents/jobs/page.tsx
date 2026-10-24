import type { Metadata } from "next";

import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AgentTabs } from "@/features/agents/components/agent-tabs";
import { JobControls } from "@/features/agents/components/job-controls";
import { JOB_STATUS_LABELS } from "@/features/agents/schemas";
import { listJobs } from "@/features/agents/server/queries";
import { formatDateTime } from "@/lib/format";
import { can } from "@/server/auth/permissions";
import { requireMember } from "@/server/auth/session";

export const metadata: Metadata = { title: "Jobs" };

const STATUS_VARIANT = {
  queued: "secondary",
  running: "default",
  waiting_external: "secondary",
  succeeded: "outline",
  failed: "destructive",
  dead: "destructive",
  cancelled: "outline",
} as const;

export default async function JobsPage() {
  const { member } = await requireMember();
  const jobs = await listJobs();
  const canManage = can(member.role, "jobs.manage");
  return (
    <>
      <PageHeader
        title="AI Command Center"
        description="Background jobs run by the Pioneer worker on your Mac. Failed jobs retry with growing delays, except sends to Pioneer (Claude) and Michael Scott: those go out at most once and stop here for you to retry or cancel."
      />
      <AgentTabs active="jobs" />
      {jobs.length === 0 ? (
        <EmptyState title="No jobs yet">
          <p>Jobs appear here when you write to Pioneer and the worker picks them up.</p>
        </EmptyState>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Job</TableHead>
                <TableHead>Agent</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Attempts</TableHead>
                <TableHead>When</TableHead>
                <TableHead>Last error</TableHead>
                {canManage ? <TableHead className="sr-only">Actions</TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.map((j) => (
                <TableRow key={j.id}>
                  <TableCell className="font-mono text-xs">{j.kind}</TableCell>
                  <TableCell>{j.agent?.name ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[j.status]}>{JOB_STATUS_LABELS[j.status]}</Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {j.attempts}/{j.max_attempts}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                    {j.finished_at
                      ? `Finished ${formatDateTime(j.finished_at, member.workspaceTimezone)}`
                      : j.waiting_until
                        ? `Reply due by ${formatDateTime(j.waiting_until, member.workspaceTimezone)}`
                        : `Runs ${formatDateTime(j.run_after, member.workspaceTimezone)}`}
                  </TableCell>
                  <TableCell className="text-muted-foreground max-w-xs text-xs whitespace-normal">
                    {j.last_error ?? ""}
                  </TableCell>
                  {canManage ? (
                    <TableCell className="text-right">
                      <JobControls id={j.id} status={j.status} />
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
