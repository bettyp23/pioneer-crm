import { ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RunActions } from "@/features/operations/components/run-actions";
import { describeCadence } from "@/features/operations/schemas";
import { ensureRoutineRuns, getRoutine } from "@/features/operations/server/queries";
import { listMembers } from "@/features/workspace/server/queries";
import { formatIsoDate } from "@/lib/dates";
import { can } from "@/server/auth/permissions";
import { requireMember } from "@/server/auth/session";

export const metadata: Metadata = { title: "Routine" };

const RUN_VARIANT = {
  pending: "outline",
  done: "default",
  skipped: "secondary",
  failed: "destructive",
} as const;

export default async function RoutinePage({ params }: PageProps<"/routines/[id]">) {
  const { member } = await requireMember();
  const today = await ensureRoutineRuns();
  const [routine, members] = await Promise.all([getRoutine((await params).id), listMembers()]);
  const names = new Map(members.map((m) => [m.user_id, m.profile?.display_name ?? "Unknown"]));
  const canWrite = can(member.role, "records.write");

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <p className="text-muted-foreground text-sm">
            <Link href="/routines" className="hover:underline">
              Routines
            </Link>
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">{routine.name}</h1>
          <p className="text-muted-foreground text-sm">
            {describeCadence(routine.cadence, routine.interval_count)} from{" "}
            {formatIsoDate(routine.anchor_on)} ·{" "}
            {routine.client ? (
              <Link href={`/clients/${routine.client.id}`} className="underline underline-offset-2">
                {routine.client.name}
              </Link>
            ) : (
              "Internal"
            )}
            {routine.is_active ? "" : " · paused"}
          </p>
          {routine.runbook_url ? (
            <a
              href={routine.runbook_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm underline underline-offset-2"
            >
              Runbook <ExternalLink className="size-3" />
            </a>
          ) : null}
        </div>
        {canWrite ? (
          <Button variant="outline" asChild>
            <Link href={`/routines/${routine.id}/edit`}>Edit</Link>
          </Button>
        ) : null}
      </div>
      {routine.description ? (
        <p className="max-w-2xl text-sm whitespace-pre-wrap">{routine.description}</p>
      ) : null}

      <section className="flex flex-col gap-2">
        <h2 className="font-medium">Occurrences</h2>
        {routine.runs.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            The first occurrence will appear on{" "}
            {routine.next_due_on ? formatIsoDate(routine.next_due_on) : "its start date"}.
          </p>
        ) : (
          <ul className="divide-y rounded-md border">
            {routine.runs.map((run) => (
              <li key={run.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
                <span className="w-28 tabular-nums">{formatIsoDate(run.scheduled_for)}</span>
                <Badge
                  variant={
                    run.status === "pending" && run.scheduled_for < today
                      ? "destructive"
                      : RUN_VARIANT[run.status]
                  }
                  className="capitalize"
                >
                  {run.status === "pending" && run.scheduled_for < today ? "missed" : run.status}
                </Badge>
                <span className="text-muted-foreground min-w-0 flex-1 text-xs">
                  {run.completed_by ? `${names.get(run.completed_by) ?? "Former member"}` : ""}
                  {run.notes ? ` · ${run.notes}` : ""}
                </span>
                {canWrite && run.status === "pending" ? (
                  <RunActions runId={run.id} label={`${routine.name} (${run.scheduled_for})`} />
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
