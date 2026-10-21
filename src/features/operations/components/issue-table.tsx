import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ISSUE_STATUS_LABELS } from "@/features/operations/schemas";
import type { listIssues } from "@/features/operations/server/queries";

type Issue = Awaited<ReturnType<typeof listIssues>>[number];

export const SEVERITY_VARIANT = {
  low: "outline",
  medium: "secondary",
  high: "default",
  critical: "destructive",
} as const;

export function IssueTable({
  issues,
  showClient = true,
}: {
  issues: Issue[];
  showClient?: boolean;
}) {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Issue</TableHead>
            {showClient ? <TableHead>Client</TableHead> : null}
            <TableHead>Severity</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {issues.map((i) => (
            <TableRow key={i.id}>
              <TableCell className="font-medium">
                <Link href={`/issues/${i.id}`} className="hover:underline">
                  {i.title}
                </Link>
                {i.diagnostic ? (
                  <span className="text-muted-foreground block text-xs font-normal">
                    From {i.diagnostic.diagnostic_type}
                  </span>
                ) : null}
              </TableCell>
              {showClient ? <TableCell>{i.client?.name}</TableCell> : null}
              <TableCell>
                <Badge variant={SEVERITY_VARIANT[i.severity]} className="capitalize">
                  {i.severity}
                </Badge>
              </TableCell>
              <TableCell>{ISSUE_STATUS_LABELS[i.status]}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
