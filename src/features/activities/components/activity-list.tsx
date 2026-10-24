import Link from "next/link";

import { EmptyState } from "@/components/layout/empty-state";
import { Badge } from "@/components/ui/badge";
import { ACTIVITY_TYPE_LABELS, type ActivityType } from "@/features/activities/schemas";
import type { listActivities } from "@/features/activities/server/queries";
import { contactName } from "@/features/contacts/schemas";
import { formatDateTime } from "@/lib/format";

type Activity = Awaited<ReturnType<typeof listActivities>>[number];

export function ActivityList({
  activities,
  timezone,
  names,
  showLead = true,
}: {
  activities: Activity[];
  timezone: string;
  names: Map<string, string>;
  showLead?: boolean;
}) {
  if (activities.length === 0) {
    return <EmptyState title="No activity yet">Log calls, emails, meetings and notes.</EmptyState>;
  }
  return (
    <ol className="flex flex-col gap-3">
      {activities.map((a) => (
        <li key={a.id} className="rounded-md border p-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{ACTIVITY_TYPE_LABELS[a.type as ActivityType]}</Badge>
            <span className="font-medium">{a.subject}</span>
          </div>
          <p className="text-muted-foreground mt-1 text-xs">
            {formatDateTime(a.occurred_at, timezone)} · {names.get(a.created_by) ?? "Former member"}
            {a.contact ? ` · with ${contactName(a.contact)}` : ""}
            {showLead && a.lead ? (
              <>
                {" · "}
                <Link href={`/leads/${a.lead.id}`} className="underline underline-offset-2">
                  {a.lead.title}
                </Link>
              </>
            ) : null}
          </p>
          {a.body ? <p className="mt-2 whitespace-pre-wrap">{a.body}</p> : null}
        </li>
      ))}
    </ol>
  );
}
