import { Badge } from "@/components/ui/badge";
import {
  AGENT_STATUS_LABELS,
  AUTHOR_NAMES,
  DELIVERY_LABELS,
  linksSchema,
  type AgentStatus,
  type DeliveryStatus,
} from "@/features/agent-chat/schemas";
import type { AgentThreadMessage } from "@/features/agent-chat/server/queries";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

import { SafeMarkdown, safeUrl } from "./safe-markdown";

// A send stuck in "sending" this long likely died with the server; say so instead of spinning.
const STUCK_MS = 2 * 60_000;

function deliveryBadge(m: AgentThreadMessage, now: number) {
  const d = m.delivery;
  if (!d) return null;
  const status = d.status as DeliveryStatus;
  if (status === "sending" && now - new Date(d.updated_at).getTime() > STUCK_MS) {
    return <Badge variant="destructive">Not confirmed</Badge>;
  }
  return (
    <Badge
      variant={
        status === "failed" ? "destructive" : status === "delivered" ? "secondary" : "outline"
      }
    >
      {DELIVERY_LABELS[status]}
    </Badge>
  );
}

export function AgentThread({
  messages,
  timeZone,
  now,
}: {
  messages: AgentThreadMessage[];
  timeZone: string;
  now: number;
}) {
  return (
    <ol className="flex flex-col gap-3" aria-label="Conversation">
      {messages.map((m) => {
        const mine = m.author === "owner";
        const statusLabel = m.agent_status
          ? AGENT_STATUS_LABELS[m.agent_status as AgentStatus]
          : null;
        const links = linksSchema.parse(m.links ?? []).filter((l) => safeUrl(l.url));
        return (
          <li key={m.id} className={cn("flex flex-col gap-1", mine ? "items-end" : "items-start")}>
            <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
              <span className="text-foreground font-medium">
                {AUTHOR_NAMES[m.author] ?? m.author}
              </span>
              <span>{formatDateTime(m.created_at, timeZone)}</span>
              {m.kind === "routed" ? <Badge variant="outline">Routed</Badge> : null}
              {statusLabel ? (
                <Badge variant={m.agent_status === "needs_decision" ? "destructive" : "outline"}>
                  {statusLabel}
                </Badge>
              ) : null}
              {m.flagged ? <Badge variant="outline">Sent after a warning</Badge> : null}
              {mine ? deliveryBadge(m, now) : null}
            </div>
            <div
              className={cn(
                "max-w-[min(42rem,100%)] rounded-lg px-3 py-2 text-sm break-words",
                mine ? "bg-primary text-primary-foreground whitespace-pre-wrap" : "bg-muted",
                m.author === "system" && "italic",
              )}
            >
              {/* Your own text stays plain; agent replies are markdown, rendered safely. */}
              {mine || m.author === "system" ? m.body : <SafeMarkdown>{m.body}</SafeMarkdown>}
              {links.length > 0 ? (
                <ul className="mt-2 flex flex-wrap gap-2">
                  {links.map((l) => (
                    <li key={l.url}>
                      <a
                        href={safeUrl(l.url)}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className="bg-background rounded border px-2 py-0.5 text-xs underline"
                      >
                        {l.label}
                      </a>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            {mine && m.delivery?.status === "failed" && m.delivery.last_error ? (
              <p className="text-destructive text-xs">
                {m.delivery.last_error}. Send it again as a new message.
              </p>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
