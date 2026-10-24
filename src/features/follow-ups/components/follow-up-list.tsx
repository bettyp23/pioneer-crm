import Link from "next/link";

import { ActionButton } from "@/components/forms/action-button";
import { EmptyState } from "@/components/layout/empty-state";
import { Badge } from "@/components/ui/badge";
import { followUpBucket } from "@/features/follow-ups/schemas";
import { setFollowUpStatus } from "@/features/follow-ups/server/actions";
import type { FollowUpRow } from "@/features/follow-ups/server/queries";
import { formatIsoDate } from "@/lib/dates";

const BUCKET_LABEL = { overdue: "Overdue", today: "Due today", upcoming: "Upcoming" } as const;

export function FollowUpList({
  followUps,
  today,
  canWrite,
  showClient = true,
  emptyTitle = "No open follow-ups",
}: {
  followUps: FollowUpRow[];
  today: string;
  canWrite: boolean;
  showClient?: boolean;
  emptyTitle?: string;
}) {
  if (followUps.length === 0) return <EmptyState title={emptyTitle} />;
  return (
    <ul className="divide-y rounded-md border">
      {followUps.map((f) => {
        const bucket = followUpBucket(f.due_on, today);
        return (
          <li key={f.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
            <div className="min-w-0 flex-1">
              <p className="font-medium">{f.title}</p>
              <p className="text-muted-foreground text-xs">
                {showClient && f.client ? (
                  <>
                    <Link href={`/clients/${f.client.id}`} className="underline underline-offset-2">
                      {f.client.name}
                    </Link>
                    {" · "}
                  </>
                ) : null}
                {f.lead ? (
                  <>
                    <Link href={`/leads/${f.lead.id}`} className="underline underline-offset-2">
                      {f.lead.title}
                    </Link>
                    {" · "}
                  </>
                ) : null}
                {f.assignee?.profile?.display_name ?? "Unassigned"}
              </p>
            </div>
            <Badge
              variant={
                bucket === "overdue" ? "destructive" : bucket === "today" ? "default" : "outline"
              }
            >
              {BUCKET_LABEL[bucket]} · {formatIsoDate(f.due_on)}
            </Badge>
            {canWrite ? (
              <div className="flex gap-1">
                <ActionButton
                  size="sm"
                  action={setFollowUpStatus.bind(null, { id: f.id, status: "done" })}
                  successMessage="Follow-up completed"
                  aria-label={`Mark “${f.title}” done`}
                >
                  Done
                </ActionButton>
                <ActionButton
                  size="sm"
                  variant="ghost"
                  action={setFollowUpStatus.bind(null, { id: f.id, status: "cancelled" })}
                  successMessage="Follow-up cancelled"
                  confirmMessage={`Cancel “${f.title}”?`}
                  aria-label={`Cancel “${f.title}”`}
                >
                  Cancel
                </ActionButton>
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
