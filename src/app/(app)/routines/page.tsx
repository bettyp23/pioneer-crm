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
import { RunActions } from "@/features/operations/components/run-actions";
import { describeCadence } from "@/features/operations/schemas";
import { ensureRoutineRuns, listDueRuns, listRoutines } from "@/features/operations/server/queries";
import { formatIsoDate } from "@/lib/dates";
import { can } from "@/server/auth/permissions";
import { requireMember } from "@/server/auth/session";

export const metadata: Metadata = { title: "Routines" };

export default async function RoutinesPage() {
  const { member } = await requireMember();
  const canWrite = can(member.role, "records.write");
  const today = await ensureRoutineRuns();
  const [routines, due] = await Promise.all([listRoutines(), listDueRuns(today)]);

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader title="Routines" description="Recurring work, internal or per client." />
        {canWrite ? (
          <Button asChild>
            <Link href="/routines/new">New routine</Link>
          </Button>
        ) : null}
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="font-medium">
          Due now <span className="text-muted-foreground font-normal">({due.length})</span>
        </h2>
        {due.length === 0 ? (
          <EmptyState title="Nothing due — all caught up" />
        ) : (
          <ul className="divide-y rounded-md border">
            {due.map((run) => (
              <li key={run.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/routines/${run.routine?.id}`}
                    className="font-medium hover:underline"
                  >
                    {run.routine?.name}
                  </Link>
                  <p className="text-muted-foreground text-xs">
                    {run.routine?.client?.name ?? "Internal"} · scheduled{" "}
                    {formatIsoDate(run.scheduled_for)}
                  </p>
                </div>
                {run.scheduled_for < today ? (
                  <Badge variant="destructive">Missed</Badge>
                ) : (
                  <Badge>Today</Badge>
                )}
                {canWrite ? (
                  <RunActions
                    runId={run.id}
                    label={`${run.routine?.name} (${run.scheduled_for})`}
                  />
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-medium">All routines</h2>
        {routines.length === 0 ? (
          <EmptyState title="No routines yet" />
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Routine</TableHead>
                  <TableHead>Schedule</TableHead>
                  <TableHead className="hidden md:table-cell">Next due</TableHead>
                  <TableHead className="hidden md:table-cell">Owner</TableHead>
                  <TableHead>90-day compliance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {routines.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">
                      <Link href={`/routines/${r.id}`} className="hover:underline">
                        {r.name}
                      </Link>{" "}
                      {r.is_active ? null : <Badge variant="outline">Paused</Badge>}
                      <span className="text-muted-foreground block text-xs font-normal">
                        {r.client?.name ?? "Internal"}
                      </span>
                    </TableCell>
                    <TableCell>{describeCadence(r.cadence, r.interval_count)}</TableCell>
                    <TableCell className="hidden md:table-cell">
                      {r.next_due_on ? formatIsoDate(r.next_due_on) : "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground hidden md:table-cell">
                      {r.owner?.profile?.display_name ?? "Unassigned"}
                    </TableCell>
                    <TableCell>
                      {r.compliance?.compliance_percent === null ||
                      r.compliance?.compliance_percent === undefined
                        ? "—"
                        : `${r.compliance.compliance_percent}%`}
                      {(r.compliance?.missed_runs ?? 0) > 0 ? (
                        <span className="text-destructive ml-1 text-xs">
                          ({r.compliance?.missed_runs} missed)
                        </span>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </>
  );
}
