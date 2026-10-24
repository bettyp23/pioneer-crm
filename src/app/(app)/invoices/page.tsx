import type { Metadata } from "next";
import Link from "next/link";

import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { InvoiceTable } from "@/features/operations/components/invoice-table";
import { effectiveInvoiceStatus } from "@/features/operations/schemas";
import { listInvoices } from "@/features/operations/server/queries";
import { dateInZone } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { can } from "@/server/auth/permissions";
import { requireMember } from "@/server/auth/session";

export const metadata: Metadata = { title: "Invoices" };

export default async function InvoicesPage() {
  const { member } = await requireMember();
  const invoices = await listInvoices();
  const today = dateInZone(new Date(), member.workspaceTimezone);
  const sum = (s: string) =>
    invoices
      .filter(
        (i) => effectiveInvoiceStatus(i.status, i.due_on, today) === s && i.currency === "USD",
      )
      .reduce((t, i) => t + i.amount_minor, 0);
  const canWrite = can(member.role, "records.write");

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          title="Invoices"
          description={`Outstanding ${formatMoney(sum("sent"))} · overdue ${formatMoney(sum("overdue"))} · metadata only — invoices live in your accounting tool.`}
        />
        {canWrite ? (
          <Button asChild>
            <Link href="/invoices/new">Record invoice</Link>
          </Button>
        ) : null}
      </div>
      {invoices.length === 0 ? (
        <EmptyState title="No invoices recorded yet" />
      ) : (
        <InvoiceTable invoices={invoices} today={today} canWrite={canWrite} />
      )}
    </>
  );
}
