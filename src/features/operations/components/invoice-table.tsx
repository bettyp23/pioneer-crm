import { ExternalLink } from "lucide-react";
import Link from "next/link";

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
import {
  effectiveInvoiceStatus,
  INVOICE_STATUS_LABELS,
  INVOICE_SYSTEM_LABELS,
} from "@/features/operations/schemas";
import type { listInvoices } from "@/features/operations/server/queries";
import { formatIsoDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";

import { MarkPaid } from "./mark-paid";

type Invoice = Awaited<ReturnType<typeof listInvoices>>[number];

const VARIANT = {
  draft: "outline",
  sent: "secondary",
  paid: "default",
  overdue: "destructive",
  void: "outline",
} as const;

export function InvoiceTable({
  invoices,
  today,
  canWrite,
  showClient = true,
}: {
  invoices: Invoice[];
  today: string;
  canWrite: boolean;
  showClient?: boolean;
}) {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Invoice</TableHead>
            {showClient ? <TableHead>Client</TableHead> : null}
            <TableHead className="text-right">Amount</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="hidden md:table-cell">Due</TableHead>
            {canWrite ? <TableHead className="sr-only">Actions</TableHead> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {invoices.map((inv) => {
            const status = effectiveInvoiceStatus(inv.status, inv.due_on, today);
            return (
              <TableRow key={inv.id}>
                <TableCell className="font-medium">
                  {inv.external_number}
                  {inv.external_url ? (
                    <a
                      href={inv.external_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-1 inline-flex align-middle"
                      aria-label={`Open ${inv.external_number} in ${INVOICE_SYSTEM_LABELS[inv.external_system]}`}
                    >
                      <ExternalLink className="size-3" />
                    </a>
                  ) : null}
                  <span className="text-muted-foreground block text-xs font-normal">
                    {INVOICE_SYSTEM_LABELS[inv.external_system]} · issued{" "}
                    {formatIsoDate(inv.issued_on)}
                    {inv.project ? ` · ${inv.project.name}` : ""}
                  </span>
                </TableCell>
                {showClient ? (
                  <TableCell>
                    <Link
                      href={`/clients/${inv.client?.id}?tab=invoices`}
                      className="hover:underline"
                    >
                      {inv.client?.name}
                    </Link>
                  </TableCell>
                ) : null}
                <TableCell className="text-right tabular-nums">
                  {formatMoney(inv.amount_minor, inv.currency)}
                </TableCell>
                <TableCell>
                  <Badge variant={VARIANT[status]}>{INVOICE_STATUS_LABELS[status]}</Badge>
                  {inv.paid_on ? (
                    <span className="text-muted-foreground block text-xs">
                      {formatIsoDate(inv.paid_on)}
                    </span>
                  ) : null}
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  {inv.due_on ? formatIsoDate(inv.due_on) : "—"}
                </TableCell>
                {canWrite ? (
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      {inv.status === "sent" || inv.status === "overdue" ? (
                        <MarkPaid invoiceId={inv.id} number={inv.external_number} today={today} />
                      ) : null}
                      <Button variant="ghost" size="sm" asChild>
                        <Link
                          href={`/invoices/${inv.id}/edit`}
                          aria-label={`Edit ${inv.external_number}`}
                        >
                          Edit
                        </Link>
                      </Button>
                    </div>
                  </TableCell>
                ) : null}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
