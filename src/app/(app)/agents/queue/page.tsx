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
import { AgentTabs } from "@/features/agents/components/agent-tabs";
import { WORK_STATUS_LABELS, WORK_TYPE_LABELS } from "@/features/agents/schemas";
import { listWorkItems } from "@/features/agents/server/queries";
import { formatDateTime } from "@/lib/format";
import { can } from "@/server/auth/permissions";
import { requireMember } from "@/server/auth/session";

export const metadata: Metadata = { title: "AI Command Center" };

const OPEN = new Set(["draft", "ready", "dispatched", "returned"]);

export default async function QueuePage() {
  const { member } = await requireMember();
  const items = await listWorkItems();
  const open = items.filter((i) => OPEN.has(i.status));
  const closed = items.filter((i) => !OPEN.has(i.status));

  const table = (rows: typeof items) => (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Work item</TableHead>
            <TableHead>Agent</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="hidden md:table-cell">Updated</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((i) => (
            <TableRow key={i.id}>
              <TableCell className="font-medium">
                <Link href={`/agents/queue/${i.id}`} className="hover:underline">
                  {i.title}
                </Link>
                <span className="text-muted-foreground block text-xs font-normal">
                  {WORK_TYPE_LABELS[i.work_type]}
                  {i.client ? ` · ${i.client.name}` : ""}
                </span>
              </TableCell>
              <TableCell>{i.agent?.name}</TableCell>
              <TableCell>
                <Badge variant={i.status === "returned" ? "default" : "secondary"}>
                  {WORK_STATUS_LABELS[i.status]}
                </Badge>
              </TableCell>
              <TableCell className="text-muted-foreground hidden md:table-cell">
                {formatDateTime(i.updated_at, member.workspaceTimezone)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          title="AI Command Center"
          description="Hand work to your agents with curated context; review what comes back."
        />
        {can(member.role, "records.write") ? (
          <Button asChild>
            <Link href="/agents/queue/new">New work item</Link>
          </Button>
        ) : null}
      </div>
      <AgentTabs active="queue" />
      <section className="flex flex-col gap-2">
        <h2 className="font-medium">In progress ({open.length})</h2>
        {open.length === 0 ? <EmptyState title="Nothing in progress" /> : table(open)}
      </section>
      {closed.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="font-medium">Finished ({closed.length})</h2>
          {table(closed)}
        </section>
      ) : null}
    </>
  );
}
