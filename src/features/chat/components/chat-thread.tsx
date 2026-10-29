import { Badge } from "@/components/ui/badge";
import { JOB_STATUS_LABELS, type JobStatus } from "@/features/agents/schemas";
import {
  AUTHOR_LABELS,
  MESSAGE_KIND_LABELS,
  type Author,
  type MessageKind,
} from "@/features/chat/schemas";
import type { listMessages } from "@/features/chat/server/queries";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

type Message = Awaited<ReturnType<typeof listMessages>>[number];

const OPEN_STATUSES: JobStatus[] = ["queued", "running", "waiting_external"];
export const isOpen = (m: Message) => m.job !== null && OPEN_STATUSES.includes(m.job.status);

// Replies are shown as plain text (React escapes them); nothing in them is ever run or linked.
export function ChatThread({ messages, timeZone }: { messages: Message[]; timeZone: string }) {
  return (
    <ol className="flex flex-col gap-3" aria-label="Conversation">
      {messages.map((m) => {
        const mine = m.author === "owner";
        const kindLabel = MESSAGE_KIND_LABELS[m.kind as MessageKind];
        return (
          <li key={m.id} className={cn("flex flex-col gap-1", mine ? "items-end" : "items-start")}>
            <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
              <span className="text-foreground font-medium">
                {AUTHOR_LABELS[m.author as Author]}
              </span>
              <span>{formatDateTime(m.created_at, timeZone)}</span>
              {kindLabel ? <Badge variant="outline">{kindLabel}</Badge> : null}
              {m.flagged ? <Badge variant="outline">Sent after a warning</Badge> : null}
              {mine && m.job ? (
                <Badge
                  variant={
                    m.job.status === "failed" || m.job.status === "dead"
                      ? "destructive"
                      : "secondary"
                  }
                >
                  {JOB_STATUS_LABELS[m.job.status]}
                </Badge>
              ) : null}
            </div>
            <div
              className={cn(
                "max-w-[min(42rem,100%)] rounded-lg px-3 py-2 text-sm break-words whitespace-pre-wrap",
                mine
                  ? "bg-primary text-primary-foreground"
                  : m.author === "system"
                    ? "bg-muted italic"
                    : "bg-muted",
              )}
            >
              {m.body}
            </div>
            {mine && m.job?.last_error ? (
              <p className="text-destructive text-xs">{m.job.last_error}</p>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
