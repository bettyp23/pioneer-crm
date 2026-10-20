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
import type { LeadRow } from "@/features/leads/server/queries";
import { formatIsoDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";

type Stage = { id: string; name: string; kind: "open" | "won" | "lost" };

export function StageBadge({ stage }: { stage: Stage | undefined }) {
  if (!stage) return null;
  const variant =
    stage.kind === "won" ? "default" : stage.kind === "lost" ? "outline" : "secondary";
  return <Badge variant={variant}>{stage.name}</Badge>;
}

export function LeadTable({
  leads,
  stages,
  showClient = true,
}: {
  leads: LeadRow[];
  stages: Stage[];
  showClient?: boolean;
}) {
  if (leads.length === 0) return <EmptyState title="No leads yet" />;
  const byId = new Map(stages.map((s) => [s.id, s]));
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Lead</TableHead>
            {showClient ? <TableHead>Client</TableHead> : null}
            <TableHead>Stage</TableHead>
            <TableHead className="text-right">Value</TableHead>
            <TableHead className="hidden md:table-cell">Expected close</TableHead>
            <TableHead className="hidden lg:table-cell">Owner</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {leads.map((lead) => (
            <TableRow key={lead.id}>
              <TableCell className="font-medium">
                <Link href={`/leads/${lead.id}`} className="hover:underline">
                  {lead.title}
                </Link>
              </TableCell>
              {showClient ? (
                <TableCell>
                  {lead.client ? (
                    <Link href={`/clients/${lead.client.id}`} className="hover:underline">
                      {lead.client.name}
                    </Link>
                  ) : null}
                </TableCell>
              ) : null}
              <TableCell>
                <StageBadge stage={byId.get(lead.stage_id)} />
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatMoney(lead.estimated_value_minor, lead.currency)}
              </TableCell>
              <TableCell className="hidden md:table-cell">
                {lead.expected_close_on ? formatIsoDate(lead.expected_close_on) : "—"}
              </TableCell>
              <TableCell className="text-muted-foreground hidden lg:table-cell">
                {lead.owner?.profile?.display_name ?? "Unassigned"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
